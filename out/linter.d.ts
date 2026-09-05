import { Node } from "./simpleHtmlParser";
import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { PerformanceRecorder } from "./performance-diagnostics";
import type { SemanticComponentId, SemanticCompositionId, SemanticGraph } from "./semantic-graph";
import type { SemanticPageDocument } from "./page-model";
export type RuleSeverity = "error" | "warning" | "off";
export interface LinterOptions {
    rules?: Record<string, RuleSeverity>;
    customRules?: Rule[];
    /** Optional file path for better error messages */
    filePath?: string;
    /** Force HTML parsing instead of JSX/TSX parsing */
    forceHtml?: boolean;
    /** Optional performance recorder */
    perf?: PerformanceRecorder;
}
export interface LintResult {
    line: number;
    column: number;
    /** Zero-based absolute source offset for reliable editor actions. */
    offset?: number;
    message: string;
    rule: string;
    code?: string;
    severity?: RuleSeverity;
    filePath?: string;
    /** Internal page identity used by composed-page analysis. */
    pageId?: string;
    /** Internal resolved component instance used by composed-page analysis. */
    pageComponentPath?: SemanticComponentId[];
    pageCompositionPath?: SemanticCompositionId[];
    /** Internal marker: page analysis proved the matching file finding invalid. */
    pageSuppression?: boolean;
    /** False when editing the shared source cannot fix an instance-level conflict. */
    pageEditSafe?: boolean;
    related?: Array<{
        filePath: string;
        line: number;
        column: number;
        message?: string;
    }>;
}
export interface Rule {
    name: string;
    /** Called before traversal begins */
    init?: () => void;
    setHtmlContext?: (ctx: {
        content: string;
        lineIndex: number[];
    }) => void;
    enterHtml?: (node: Node) => LintResult[];
    exitHtml?: (node: Node) => LintResult[];
    enterJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
    exitJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
    /** Called after traversal finishes */
    end?: () => LintResult[];
    /** Analyze one resolved composed page using the same registered rule. */
    analyzePage?: (context: PageRuleContext) => LintResult[];
    test?: (node: Node | t.Node) => boolean;
    message?: string;
}
export interface PageRuleContext {
    page: SemanticPageDocument;
    graph: SemanticGraph;
    /** File-level results are available for conservative candidate refinement. */
    fileResults: ReadonlyMap<string, readonly LintResult[]>;
}
export declare function createActiveRules(options?: LinterOptions): Array<{
    rule: Rule;
    severity: RuleSeverity;
}>;
export declare function applyInlineDisableDirectives(content: string, results: LintResult[]): LintResult[];
/**
 * Lint HTML/JSX/TSX content.
 */
export declare function lint(content: string, options?: LinterOptions): LintResult[];
