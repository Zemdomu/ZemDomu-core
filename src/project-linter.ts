import * as fs from "fs/promises";
import { lint, LintResult, LinterOptions } from "./linter";
import { ComponentAnalyzer } from "./component-analyzer";
import type { PerformanceRecorder } from "./performance-diagnostics";
import { collectLocalDeps } from "./utils/collectLocalDeps";
import path from "path";

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
    const results = lint(content, { ...this.opts, filePath });
    const byFile = new Map<string, LintResult[]>();
    byFile.set(filePath, [...results]);
    const xmlMode = /\.(jsx|tsx)$/.test(filePath);
    if (xmlMode) {
      const component = await this.analyzer.analyzeFile(filePath);
      if (component) {
        this.analyzer.registerComponent(component, results);
      }
      if (this.opts.crossComponentAnalysis) {
        const cross = this.analyzer.analyzeComponentTree();
        for (const r of cross) {
          if (!r.filePath) continue;
          if (!byFile.has(r.filePath)) byFile.set(r.filePath, []);
          byFile.get(r.filePath)!.push(r);
        }
      }
    }
    return byFile;
  }

  async lintFiles(filePaths: string[]): Promise<Map<string, LintResult[]>> {
    const root = this.opts.rootDir ?? process.cwd();
    const targets = this.opts.crossComponentAnalysis
      ? collectLocalDeps(filePaths, root, this.opts.crossComponentDepth)
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
