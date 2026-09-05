import { LintResult, LinterOptions } from './linter';
import type { SemanticGraph, SemanticUnknown } from './semantic-graph';
interface PerformanceRecorder {
    record(filePath: string, timings: Record<string, number>): void;
}
interface ComponentReference {
    name: string;
    path: string | null;
    rawImportPath: string | null;
    importKind?: 'default' | 'named';
    importedName?: string;
    importLocation?: {
        line: number;
        column: number;
    };
    sourceLocation: {
        line: number;
        column: number;
    };
    usageLocations: Array<{
        line: number;
        column: number;
        inListDirect?: boolean;
        inSection?: boolean;
        renderGroup?: string;
        /** Original branch group before rule-specific Vue exclusivity merging. */
        semanticRenderGroup?: string;
        /** True only when the usage is a statically observed component render root. */
        isRenderRoot?: boolean;
        sectionAncestors?: Array<{
            line: number;
            column: number;
        }>;
    }>;
}
interface NativeElementInfo {
    tagName: string;
    line: number;
    column: number;
    renderGroup?: string;
    isRenderRoot: boolean;
    sectionAncestors: Array<{
        line: number;
        column: number;
    }>;
}
interface UnknownRenderRootInfo {
    reason: SemanticUnknown['reason'];
    line: number;
    column: number;
    message: string;
}
interface HeadingInfo {
    level: number;
    line: number;
    column: number;
    filePath: string;
}
interface IdInfo {
    id: string;
    tagName: string;
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
interface SectionInfo {
    filePath: string;
    line: number;
    column: number;
    hasLocalHeading: boolean;
    childComponents: ComponentReference[];
}
interface ListItemInfo {
    filePath: string;
    line: number;
    column: number;
    nesting: 'root' | 'inList' | 'inOther';
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
    sections: SectionInfo[];
    hasHeadingOutsideSection: boolean;
    listItems: ListItemInfo[];
    nativeElements: NativeElementInfo[];
    unknownRenderRoots: UnknownRenderRootInfo[];
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
        rootDir?: string;
    }, perf?: PerformanceRecorder);
    analyzeFile(filePath: string): Promise<ComponentDefinition | null>;
    private extractComponentInfo;
    private extractVueComponentInfo;
    private resolveComponentPath;
    registerComponent(component: ComponentDefinition, issues: LintResult[]): void;
    /**
     * Return a deterministic semantic graph for the components analyzed by this
     * instance. This is additive to the existing rule-oriented traversal.
     */
    buildSemanticGraph(): SemanticGraph;
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
    private findCrossComponentListNestingIssues;
    private checkNavs;
    private navHasLink;
    private componentHasAnchor;
    getListNestingSuppressions(): Map<string, Set<string>>;
    getSectionHeadingSuppressions(): Map<string, Set<string>>;
    private findEntryPoints;
    private findComponentsWithRule;
}
export {};
