import type { LintResult } from "./linter";
import { type ZemDomuDiagnostic } from "./diagnostics";
import type { SemanticPageModel } from "./page-model";
import type { SemanticGraph } from "./semantic-graph";
/**
 * Adapt legacy lint results to canonical diagnostics and add page composition
 * context only when one page and one component path are statically resolved.
 */
export declare function createPageAwareDiagnostics(results: ReadonlyMap<string, readonly LintResult[]>, graph: SemanticGraph, model: SemanticPageModel): ZemDomuDiagnostic[];
