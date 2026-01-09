import { LintResult, LinterOptions } from "./linter";
import type { PerformanceRecorder } from "./performance-diagnostics";
export interface ProjectLinterOptions extends LinterOptions {
    crossComponentAnalysis?: boolean;
    crossComponentDepth?: number;
    perf?: PerformanceRecorder;
    rootDir?: string;
}
export declare class ProjectLinter {
    private analyzer;
    private opts;
    constructor(options?: ProjectLinterOptions);
    clear(): void;
    lintFile(filePath: string, content?: string): Promise<Map<string, LintResult[]>>;
    lintFiles(filePaths: string[]): Promise<Map<string, LintResult[]>>;
}
