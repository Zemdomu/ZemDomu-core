import path from "path";
import type { LintResult, PageRuleContext } from "../linter";
import type { SemanticPageFact } from "../page-model";
import type { SemanticSourceProvenance } from "../semantic-graph";

const INCOMPLETE_REASONS = new Set([
  "conditional-render",
  "cycle",
  "depth-limit",
  "fragment-boundary",
  "missing-page-root",
  "parse-error",
  "runtime-composition",
  "slot-or-children",
  "unresolved-import",
  "unsupported-syntax",
]);

export function isUnconditional(fact: SemanticPageFact): boolean {
  return fact.condition.kind === "always";
}

export function isResolvedPage(context: PageRuleContext): boolean {
  return (
    context.page.route.state === "known" &&
    context.page.rootComponent.state === "resolved" &&
    context.page.confidence !== "unknown"
  );
}

export function isCompletePage(context: PageRuleContext): boolean {
  return (
    isResolvedPage(context) &&
    !context.page.unknowns.some((unknown) => INCOMPLETE_REASONS.has(unknown.reason))
  );
}

export function sourceForProvenance(
  provenance: SemanticSourceProvenance,
  context: PageRuleContext
): Pick<LintResult, "filePath" | "line" | "column"> | undefined {
  if (!provenance.fileId) return undefined;
  const file = context.graph.files.find((entry) => entry.id === provenance.fileId);
  if (!file) return undefined;
  return {
    filePath: file.path,
    line: provenance.range?.start.line ?? 0,
    column: provenance.range?.start.column ?? 0,
  };
}

export function sourceForFact(
  fact: SemanticPageFact,
  context: PageRuleContext
): Pick<
  LintResult,
  "filePath" | "line" | "column" | "pageComponentPath" | "pageCompositionPath"
> | undefined {
  const source = sourceForProvenance(fact.provenance, context);
  return source
    ? {
        ...source,
        pageComponentPath: [...fact.componentPath],
        pageCompositionPath: [...(fact.compositionPath ?? [])],
      }
    : undefined;
}

export function pageRootSource(
  context: PageRuleContext
): Pick<LintResult, "filePath" | "line" | "column"> | undefined {
  if (context.page.rootComponent.state !== "resolved") return undefined;
  const rootComponentId = context.page.rootComponent.id;
  const root = context.graph.components.find(
    (component) => component.id === rootComponentId
  );
  return root ? sourceForProvenance(root.provenance, context) : undefined;
}

export function relatedForFact(
  fact: SemanticPageFact,
  context: PageRuleContext,
  message: string
): NonNullable<LintResult["related"]>[number] | undefined {
  const source = sourceForFact(fact, context);
  return source?.filePath
    ? {
        filePath: source.filePath,
        line: source.line,
        column: source.column,
        message,
      }
    : undefined;
}

export function relatedCompositionForFact(
  fact: SemanticPageFact,
  context: PageRuleContext,
  message: string
): NonNullable<LintResult["related"]>[number] | undefined {
  const compositionPath = fact.compositionPath ?? [];
  const edgeId = compositionPath[compositionPath.length - 1];
  if (!edgeId) return undefined;
  const edge = context.graph.composition.find((candidate) => candidate.id === edgeId);
  if (!edge) return undefined;
  const source = sourceForProvenance(edge.provenance, context);
  return source?.filePath
    ? { ...source, filePath: source.filePath, message }
    : undefined;
}

export function matchingFileResult(
  context: PageRuleContext,
  rule: string,
  fact: SemanticPageFact
): LintResult | undefined {
  const source = sourceForFact(fact, context);
  if (!source?.filePath) return undefined;
  const target = comparableFile(source.filePath);
  for (const [file, results] of context.fileResults) {
    if (comparableFile(file) !== target) continue;
    return results.find(
      (result) =>
        result.rule === rule &&
        result.line === source.line &&
        result.column === source.column
    );
  }
  return undefined;
}

function comparableFile(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
