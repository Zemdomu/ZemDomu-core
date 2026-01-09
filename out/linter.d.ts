import { Node } from "./simpleHtmlParser";
import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { PerformanceRecorder } from "./performance-diagnostics";
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
    message: string;
    rule: string;
    code?: string;
    severity?: RuleSeverity;
    filePath?: string;
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
    enterHtml?: (node: Node) => LintResult[];
    exitHtml?: (node: Node) => LintResult[];
    enterJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
    exitJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
    /** Called after traversal finishes */
    end?: () => LintResult[];
    test?: (node: Node | t.Node) => boolean;
    message?: string;
}
/**
 * Lint HTML/JSX/TSX content.
 */
export declare function lint(content: string, options?: LinterOptions): LintResult[];
