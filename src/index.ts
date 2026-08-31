// Exposes the core lint function and types

export { lint } from "./linter";
export type { LinterOptions, LintResult, PageRuleContext, Rule } from "./linter";
export { ComponentAnalyzer } from "./component-analyzer";
export { ComponentPathResolver } from "./component-path-resolver";
export { ProjectLinter } from "./project-linter";
export type { ProjectLinterOptions } from "./project-linter";
export { PerformanceDiagnostics } from "./performance-diagnostics";
export type {
  Node,
  ElementNode,
  TextNode,
  CommentNode,
} from "./simpleHtmlParser";
export { parse as parseHtml } from "./simpleHtmlParser";
export {
  getAttr,
  getJsxAttr,
  getJsxAttribute,
  getJsxAttributeState,
  getJsxExpressionState,
  getTag,
  isJsxExpressionPossiblyEmpty,
} from "./rules/utils";
export type { JsxValueState } from "./rules/utils";
export type { HtmlVisitor } from "./html-visitor";
export { visitHtml } from "./html-visitor";
export {
  diagnosticsToSarif,
  resultsToSarif,
  RULE_DOCS_BASE,
  SARIF_SCHEMA_URI,
} from "./sarif";
export type { SarifLocation, SarifLog } from "./sarif";
export {
  getRuleCode,
  PAGE_ONLY_RULES,
  RULE_CODES,
  RULE_CLASSIFICATIONS,
} from "./rule-codes";
export type { RuleClassification } from "./rule-codes";
export {
  formatZemDomuDiagnosticPretty,
  serializeZemDomuDiagnostics,
  toZemDomuDiagnostic,
  ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
} from "./diagnostics";
export { createPageAwareDiagnostics } from "./contextual-diagnostics";
export type {
  ZemDomuDiagnostic,
  ZemDomuDiagnosticConfidence,
  ZemDomuDiagnosticContext,
  ZemDomuDiagnosticProvenance,
  ZemDomuDiagnosticProvenanceKind,
  ZemDomuDiagnosticSeverity,
  ZemDomuDiagnosticSuggestion,
  ZemDomuRelatedLocation,
  ZemDomuSourceLocation,
} from "./diagnostics";
export {
  assertValidSemanticGraph,
  SEMANTIC_GRAPH_SCHEMA_VERSION,
  validateSemanticGraph,
} from "./semantic-graph";
export {
  composeSemanticPageModel,
  createConfiguredRouteAdapter,
  createReactFileRouteAdapter,
  createVueFileRouteAdapter,
  SEMANTIC_PAGE_MODEL_SCHEMA_VERSION,
} from "./page-model";
export type {
  FileSystemRouteAdapterOptions,
  SemanticPageComponentTree,
  SemanticPageConfiguration,
  SemanticPageDiscovery,
  SemanticPageDocument,
  SemanticPageFact,
  SemanticPageFactKind,
  SemanticPageGap,
  SemanticPageModel,
  SemanticPageModelSchemaVersion,
  SemanticRouteAdapter,
  SemanticRouteAdapterContext,
  SemanticRouteCandidate,
} from "./page-model";
export type {
  SemanticAnalysisBoundary,
  SemanticAttribute,
  SemanticComponentId,
  SemanticComponentNode,
  SemanticComponentOutput,
  SemanticComponentSemanticOutput,
  SemanticCompositionEdge,
  SemanticCompositionEndpointId,
  SemanticCompositionId,
  SemanticCompositionTargetId,
  SemanticFileId,
  SemanticFileNode,
  SemanticFragmentNode,
  SemanticFramework,
  SemanticGraph,
  SemanticGraphEntityId,
  SemanticGraphInvariantCode,
  SemanticGraphInvariantIssue,
  SemanticGraphSchemaVersion,
  SemanticImportEdge,
  SemanticImportId,
  SemanticImportKind,
  SemanticInferenceEvidence,
  SemanticNativeElementNode,
  SemanticPageRoot,
  SemanticPageRootId,
  SemanticReference,
  SemanticRenderedFact,
  SemanticRenderCondition,
  SemanticRenderNode,
  SemanticRenderNodeId,
  SemanticSourceConfidence,
  SemanticSourcePosition,
  SemanticSourceProvenance,
  SemanticSourceRange,
  SemanticTraversalState,
  SemanticUnknown,
  SemanticUnknownReason,
  SemanticUnknownRenderNode,
  SemanticValue,
} from "./semantic-graph";
