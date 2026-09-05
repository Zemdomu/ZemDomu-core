import { LintResult, LinterOptions } from "./linter";
import type { PerformanceRecorder } from "./performance-diagnostics";
import type { SemanticGraph } from "./semantic-graph";
import type { ZemDomuDiagnostic } from "./diagnostics";
import type { SemanticPageConfiguration, SemanticPageModel, SemanticRouteAdapter } from "./page-model";
export interface ProjectLinterOptions extends LinterOptions {
    crossComponentAnalysis?: boolean;
    crossComponentDepth?: number;
    perf?: PerformanceRecorder;
    rootDir?: string;
    pages?: readonly SemanticPageConfiguration[];
    routeAdapters?: readonly SemanticRouteAdapter[];
}
export declare class ProjectLinter {
    private analyzer;
    private opts;
    constructor(options?: ProjectLinterOptions);
    clear(): void;
    lintFile(filePath: string, content?: string): Promise<Map<string, LintResult[]>>;
    lintFiles(filePaths: string[]): Promise<Map<string, LintResult[]>>;
    /**
     * Analyze the supplied entries and their supported local dependencies into
     * the public semantic graph without running or changing lint rules.
     */
    buildSemanticGraph(filePaths: string[]): Promise<SemanticGraph>;
    /** Compose configured or adapter-discovered pages from the public graph. */
    buildPageModel(filePaths: string[]): Promise<SemanticPageModel>;
    /**
     * Lint a composed page and return canonical diagnostics enriched with page,
     * component-path, related-location, and conservative suggestion context.
     * Existing lintFile/lintFiles return values remain unchanged.
     */
    lintPageDiagnostics(filePaths: string[]): Promise<ZemDomuDiagnostic[]>;
    private pageModelAdapters;
    private resolveTargets;
    private applyListNestingSuppressions;
    private applySectionHeadingSuppressions;
    private applyInlineDisableDirectives;
    private applyInlineDisableDirectivesForFiles;
}
