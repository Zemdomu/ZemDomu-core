import * as fs from "fs/promises";
import path from "path";
import * as ts from "typescript";
import {
  applyInlineDisableDirectives,
  lint,
  LintResult,
  LinterOptions,
} from "./linter";
import { ComponentAnalyzer } from "./component-analyzer";
import type { PerformanceRecorder } from "./performance-diagnostics";
import { collectLocalDeps } from "./utils/collectLocalDeps";
import { extractVueTemplate, isHtmlVueTemplate } from "./utils/vue-sfc";
import { applyRuleCode } from "./rule-codes";
import type { SemanticGraph } from "./semantic-graph";
import {
  composeSemanticPageModel,
  createConfiguredRouteAdapter,
} from "./page-model";
import type {
  SemanticPageConfiguration,
  SemanticPageModel,
  SemanticRouteAdapter,
} from "./page-model";

const FRAMEWORK_HOST_DOCUMENT_RULES = [
  "requireHtmlLang",
  "requireDocumentTitle",
  "requireSingleMain",
];

function isHtmlFile(filePath: string): boolean {
  return /\.(html|htm)$/i.test(filePath);
}

function buildLineIndex(content: string): number[] {
  const lines = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") lines.push(i + 1);
  }
  return lines;
}

function locationAt(lineIndex: number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = lineIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  const line = Math.max(0, high);
  return { line, column: offset - lineIndex[line] };
}

function rebaseVueResult(
  result: LintResult,
  templateContent: string,
  templateStart: number,
  documentContent: string
): LintResult {
  const templateLines = buildLineIndex(templateContent);
  const relativeOffset = result.offset ??
    (templateLines[result.line] ?? 0) + result.column;
  const offset = templateStart + relativeOffset;
  return { ...result, ...locationAt(buildLineIndex(documentContent), offset), offset };
}

function getHtmlTagAttribute(tag: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  ).exec(tag);
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
}

function hasFrameworkMountPoint(content: string): boolean {
  return /<[a-z][\w:-]*\b(?=[^>]*\bid\s*=\s*["'](?:app|root|app-root|mount|__nuxt|__next|svelte)["'])[^>]*>/i.test(
    content
  );
}

function isFrameworkEntrySrc(src: string): boolean {
  const normalized = src.replace(/[?#].*$/, "").replace(/\\/g, "/");
  return /(?:^|\/)(?:src\/)?(?:main|index|app)\.(?:[cm]?[jt]sx?|vue)$/i.test(
    normalized
  );
}

function hasFrameworkModuleEntry(content: string): boolean {
  const scriptRe = /<script\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(content))) {
    const tag = match[0];
    const type = getHtmlTagAttribute(tag, "type");
    if (!type || type.toLowerCase() !== "module") continue;
    const src = getHtmlTagAttribute(tag, "src");
    if (src && isFrameworkEntrySrc(src)) return true;
  }

  return /<script\b(?=[^>]*\btype\s*=\s*["']?module["']?)[^>]*>[\s\S]*?\b(?:createApp|createRoot|ReactDOM\.render|new\s+Vue)\s*\(/i.test(
    content
  );
}

function isFrameworkHostHtml(filePath: string, content: string): boolean {
  if (path.basename(filePath).toLowerCase() !== "index.html") return false;
  if (!hasFrameworkMountPoint(content)) return false;
  return hasFrameworkModuleEntry(content);
}

function suppressRules(
  options: ProjectLinterOptions,
  ruleNames: string[]
): ProjectLinterOptions {
  const rules = { ...(options.rules ?? {}) };
  for (const ruleName of ruleNames) {
    rules[ruleName] = "off";
  }
  return { ...options, rules };
}

export interface ProjectLinterOptions extends LinterOptions {
  crossComponentAnalysis?: boolean;
  crossComponentDepth?: number;
  perf?: PerformanceRecorder;
  rootDir?: string;
  pages?: readonly SemanticPageConfiguration[];
  routeAdapters?: readonly SemanticRouteAdapter[];
}

export class ProjectLinter {
  private analyzer: ComponentAnalyzer;
  private opts: ProjectLinterOptions;

  constructor(options: ProjectLinterOptions = {}) {
    this.opts = options;
    this.analyzer = new ComponentAnalyzer(this.opts, options.perf);
  }

  clear(): void {
    this.analyzer = new ComponentAnalyzer(this.opts, this.opts.perf);
  }

  async lintFile(
    filePath: string,
    content?: string
  ): Promise<Map<string, LintResult[]>> {
    if (!content) {
      content = await fs.readFile(filePath, "utf8");
    }

    const ext = path.extname(filePath).toLowerCase();
    const isVue = ext === ".vue";
    const isHtml = isHtmlFile(filePath);
    let lintContent = content;
    let vueTemplateStart: number | undefined;
    if (isVue) {
      const template = extractVueTemplate(content);
      lintContent = isHtmlVueTemplate(template) ? template.content : "";
      vueTemplateStart = isHtmlVueTemplate(template) ? template.start : undefined;
    }

    const lintOptions = isHtml && isFrameworkHostHtml(filePath, content)
      ? suppressRules(this.opts, FRAMEWORK_HOST_DOCUMENT_RULES)
      : this.opts;
    const results = lint(lintContent, {
      ...lintOptions,
      filePath,
      forceHtml: isHtml || isVue || this.opts.forceHtml,
    });
    const resolvedResults = results.map((result) => {
      const rebased = isVue && vueTemplateStart !== undefined
        ? rebaseVueResult(result, lintContent, vueTemplateStart, content)
        : result;
      return rebased.filePath ? rebased : { ...rebased, filePath };
    });
    const byFile = new Map<string, LintResult[]>();
    byFile.set(filePath, [...resolvedResults]);

    const xmlMode = /\.(jsx|tsx)$/.test(filePath) || isVue;
    if (xmlMode) {
      const component = await this.analyzer.analyzeFile(filePath);
      if (component) this.analyzer.registerComponent(component, resolvedResults);

      if (this.opts.crossComponentAnalysis) {
        const cross = this.analyzer.analyzeComponentTree();
        for (const r of cross) {
          if (!r.filePath) continue;
          if (!byFile.has(r.filePath)) byFile.set(r.filePath, []);
          byFile.get(r.filePath)!.push(applyRuleCode(r));
        }
      }
    }

    this.applyListNestingSuppressions(byFile);
    this.applySectionHeadingSuppressions(byFile);
    await this.applyInlineDisableDirectives(byFile, filePath, content);
    return byFile;
  }

  async lintFiles(filePaths: string[]): Promise<Map<string, LintResult[]>> {
    const uniqueTargets = this.resolveTargets(
      filePaths,
      Boolean(this.opts.crossComponentAnalysis)
    );

    const aggregated = new Map<string, LintResult[]>();
    for (const filePath of uniqueTargets) {
      const fileMap = await this.lintFile(filePath);
      for (const [fp, res] of fileMap.entries()) {
        if (!aggregated.has(fp)) aggregated.set(fp, []);
        aggregated.get(fp)!.push(...res);
      }
    }
    this.applyListNestingSuppressions(aggregated);
    this.applySectionHeadingSuppressions(aggregated);
    return aggregated;
  }

  /**
   * Analyze the supplied entries and their supported local dependencies into
   * the public semantic graph without running or changing lint rules.
   */
  async buildSemanticGraph(filePaths: string[]): Promise<SemanticGraph> {
    this.clear();
    const targets = this.resolveTargets(filePaths, true);
    for (const filePath of targets) {
      await this.analyzer.analyzeFile(filePath);
    }
    return this.analyzer.buildSemanticGraph();
  }

  /** Compose configured or adapter-discovered pages from the public graph. */
  async buildPageModel(filePaths: string[]): Promise<SemanticPageModel> {
    const graph = await this.buildSemanticGraph(filePaths);
    const adapters = [
      ...(this.opts.pages?.length
        ? [createConfiguredRouteAdapter(this.opts.pages)]
        : []),
      ...(this.opts.routeAdapters ?? []),
    ];
    return composeSemanticPageModel(graph, adapters);
  }

  private resolveTargets(
    filePaths: string[],
    includeDependencies: boolean
  ): string[] {
    const root = this.opts.rootDir ?? process.cwd();

    const configPath = ts.findConfigFile(
      root,
      ts.sys.fileExists,
      "tsconfig.json"
    );
    let baseUrl: string | undefined;
    let paths: Record<string, string[]> | undefined;

    if (configPath) {
      const cfg = ts.readConfigFile(configPath, ts.sys.readFile).config;
      const cfgDir = path.dirname(configPath);
      baseUrl = cfg?.compilerOptions?.baseUrl
        ? path.resolve(cfgDir, cfg.compilerOptions.baseUrl)
        : undefined;
      paths = cfg?.compilerOptions?.paths;
    }

    const targets = includeDependencies
      ? collectLocalDeps(filePaths, {
          rootDir: root,
          baseUrl,
          paths,
          maxDepth: this.opts.crossComponentDepth,
        })
      : filePaths;

    const uniqueTargets = Array.from(
      new Set(targets.map((p) => path.resolve(p)))
    );
    return uniqueTargets;
  }

  private applyListNestingSuppressions(results: Map<string, LintResult[]>): void {
    if (!this.opts.crossComponentAnalysis) return;
    const rules = this.opts.rules || {};
    if (!rules.enforceListNesting) return;
    const suppressions = this.analyzer.getListNestingSuppressions();
    if (!suppressions.size) return;
    for (const [filePath, entries] of results.entries()) {
      const suppressSet = suppressions.get(filePath);
      if (!suppressSet || suppressSet.size === 0) continue;
      results.set(
        filePath,
        entries.filter(
          (r) =>
            r.rule !== "enforceListNesting" ||
            !suppressSet.has(`${r.line}:${r.column}`)
        )
      );
    }
  }

  private applySectionHeadingSuppressions(results: Map<string, LintResult[]>): void {
    if (!this.opts.crossComponentAnalysis) return;
    const rules = this.opts.rules || {};
    if (!rules.requireSectionHeading) return;
    const suppressions = this.analyzer.getSectionHeadingSuppressions();
    if (!suppressions.size) return;
    for (const [filePath, entries] of results.entries()) {
      const suppressSet = suppressions.get(filePath);
      if (!suppressSet || suppressSet.size === 0) continue;
      results.set(
        filePath,
        entries.filter(
          (r) =>
            r.rule !== "requireSectionHeading" ||
            !suppressSet.has(`${r.line}:${r.column}`)
        )
      );
    }
  }

  private async applyInlineDisableDirectives(
    results: Map<string, LintResult[]>,
    currentFilePath: string,
    currentContent: string
  ): Promise<void> {
    const currentResolved = path.resolve(currentFilePath);
    for (const [resultFilePath, entries] of results.entries()) {
      let source: string;
      if (path.resolve(resultFilePath) === currentResolved) {
        source = currentContent;
      } else {
        try {
          source = await fs.readFile(resultFilePath, "utf8");
        } catch {
          continue;
        }
      }
      results.set(resultFilePath, applyInlineDisableDirectives(source, entries));
    }
  }
}
