import { LintResult, LinterOptions } from './linter';
interface PerformanceRecorder {
    record(filePath: string, timings: Record<string, number>): void;
}
interface ComponentReference {
    name: string;
    path: string | null;
    rawImportPath: string | null;
    sourceLocation: {
        line: number;
        column: number;
    };
    usageLocations: Array<{
        line: number;
        column: number;
    }>;
}
interface HeadingInfo {
    level: number;
    line: number;
    column: number;
    filePath: string;
}
interface IdInfo {
    id: string;
    line: number;
    column: number;
    filePath: string;
}
interface NavInfo {
    filePath: string;
    line: number;
    column: number;
    hasLocalLink: boolean;
    childComponents: ComponentReference[];
}
interface ComponentDefinition {
    name: string;
    filePath: string;
    issues: Map<string, LintResult[]>;
    usesComponents: ComponentReference[];
    headings: HeadingInfo[];
    ids: IdInfo[];
    navs: NavInfo[];
    hasLocalAnchor: boolean;
}
export declare class ComponentAnalyzer {
    private componentRegistry;
    private importToComponentMap;
    private options;
    private processingComponentStack;
    private perf?;
    private resolver;
    private maxDepth;
    constructor(options: LinterOptions & {
        crossComponentAnalysis?: boolean;
        crossComponentDepth?: number;
    }, perf?: PerformanceRecorder);
    analyzeFile(filePath: string): Promise<ComponentDefinition | null>;
    private extractComponentInfo;
    private extractVueComponentInfo;
    private resolveComponentPath;
    registerComponent(component: ComponentDefinition, issues: LintResult[]): void;
    private getRuleType;
    analyzeComponentTree(): LintResult[];
    private findCrossComponentH1Issues;
    /**
     * Improved implementation to find heading order issues across components
     */
    private findCrossComponentHeadingOrderIssues;
    /**
     * Collects all headings from a component and its children in document order
     * and checks for heading level issues
     */
    private analyzeHeadingHierarchy;
    /**
     * Collects all headings from a component and its children in document order
     */
    private collectHeadingsInDocumentOrder;
    private findCrossComponentDuplicateIds;
    private collectIds;
    private findCrossComponentNavLinks;
    private checkNavs;
    private navHasLink;
    private componentHasAnchor;
    private findEntryPoints;
    private findComponentsWithRule;
}
export {};
