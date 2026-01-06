import * as fs from "fs/promises";
import path from "path";
import * as ts from "typescript";
import { lint, LintResult, LinterOptions } from "./linter";
import { ComponentAnalyzer } from "./component-analyzer";
import { ComponentPathResolver } from "./component-path-resolver";
import type { PerformanceRecorder } from "./performance-diagnostics";
import { collectLocalDeps } from "./utils/collectLocalDeps";
import { extractVueTemplate, isHtmlVueTemplate } from "./utils/vue-sfc";
import { applyRuleCode } from "./rule-codes";

export interface ProjectLinterOptions extends LinterOptions {
  crossComponentAnalysis?: boolean;
  crossComponentDepth?: number;
  perf?: PerformanceRecorder;
  rootDir?: string;
}

export class ProjectLinter {
  private analyzer: ComponentAnalyzer;
  private opts: ProjectLinterOptions;

  constructor(options: ProjectLinterOptions = {}) {
    this.opts = options;
    const rootDir = this.opts.rootDir ?? process.cwd();
    ComponentPathResolver.setRootDir(rootDir);
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

    const isVue = path.extname(filePath).toLowerCase() === ".vue";
    let lintContent = content;
    if (isVue) {
      const template = extractVueTemplate(content);
      lintContent = isHtmlVueTemplate(template) ? template.content : "";
    }

    const results = lint(lintContent, {
      ...this.opts,
      filePath,
      forceHtml: isVue || this.opts.forceHtml,
    });
    const byFile = new Map<string, LintResult[]>();
    byFile.set(filePath, [...results]);

    const xmlMode = /\.(jsx|tsx)$/.test(filePath) || isVue;
    if (xmlMode) {
      const component = await this.analyzer.analyzeFile(filePath);
      if (component) this.analyzer.registerComponent(component, results);

      if (this.opts.crossComponentAnalysis) {
        const cross = this.analyzer.analyzeComponentTree();
        for (const r of cross) {
          if (!r.filePath) continue;
          if (!byFile.has(r.filePath)) byFile.set(r.filePath, []);
          byFile.get(r.filePath)!.push(applyRuleCode(r));
        }
      }
    }

    return byFile;
  }

  async lintFiles(filePaths: string[]): Promise<Map<string, LintResult[]>> {
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

    const targets = this.opts.crossComponentAnalysis
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

    const aggregated = new Map<string, LintResult[]>();
    for (const filePath of uniqueTargets) {
      const fileMap = await this.lintFile(filePath);
      for (const [fp, res] of fileMap.entries()) {
        if (!aggregated.has(fp)) aggregated.set(fp, []);
        aggregated.get(fp)!.push(...res);
      }
    }
    return aggregated;
  }
}
