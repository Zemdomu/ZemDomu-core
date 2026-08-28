// Exposes the core lint function and types

export { lint } from "./linter";
export type { LinterOptions, LintResult, Rule } from "./linter";
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
export { resultsToSarif, RULE_DOCS_BASE } from "./sarif";
export type { SarifLog } from "./sarif";
export { getRuleCode, RULE_CODES, RULE_CLASSIFICATIONS } from "./rule-codes";
export type { RuleClassification } from "./rule-codes";
