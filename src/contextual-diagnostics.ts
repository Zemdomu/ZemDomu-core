import path from "path";
import type { LintResult } from "./linter";
import {
  toZemDomuDiagnostic,
  type ZemDomuDiagnostic,
  type ZemDomuDiagnosticSuggestion,
  type ZemDomuRelatedLocation,
  type ZemDomuSourceLocation,
} from "./diagnostics";
import type {
  SemanticPageComponentTree,
  SemanticPageDocument,
  SemanticPageModel,
} from "./page-model";
import type {
  SemanticComponentId,
  SemanticGraph,
  SemanticSourceProvenance,
} from "./semantic-graph";

interface ResolvedPageContext {
  page: string;
  componentPath: readonly SemanticComponentId[];
  confidence: "certain" | "inferred";
}

function comparableFile(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function sourceForProvenance(
  provenance: SemanticSourceProvenance,
  graph: SemanticGraph
): ZemDomuSourceLocation | undefined {
  if (!provenance.fileId) return undefined;
  const file = graph.files.find((entry) => entry.id === provenance.fileId);
  if (!file) return undefined;
  return {
    file: file.path,
    line: provenance.range?.start.line ?? 0,
    column: provenance.range?.start.column ?? 0,
  };
}

function collectComponentPaths(
  tree: SemanticPageComponentTree | undefined,
  componentIds: ReadonlySet<SemanticComponentId>,
  prefix: readonly SemanticComponentId[] = []
): SemanticComponentId[][] {
  if (!tree) return [];
  const current = [...prefix, tree.componentId];
  return [
    ...(componentIds.has(tree.componentId) ? [current] : []),
    ...tree.children.flatMap((child) =>
      collectComponentPaths(child, componentIds, current)
    ),
  ];
}

function pathsForResult(
  result: LintResult,
  page: SemanticPageDocument,
  graph: SemanticGraph
): SemanticComponentId[][] {
  if (!result.filePath) return [];
  const targetFile = comparableFile(result.filePath);
  const fileIds = new Set(
    graph.files
      .filter((file) => comparableFile(file.path) === targetFile)
      .map((file) => file.id)
  );
  if (!fileIds.size) return [];

  const exactFactPaths = page.facts
    .filter(
      (fact) =>
        fact.provenance.fileId &&
        fileIds.has(fact.provenance.fileId) &&
        fact.provenance.range?.start.line === result.line &&
        fact.provenance.range?.start.column === result.column
    )
    .map((fact) => [...fact.componentPath]);
  if (exactFactPaths.length) return exactFactPaths;

  const componentIds = new Set(
    graph.components
      .filter((component) => fileIds.has(component.fileId))
      .map((component) => component.id)
  );
  return collectComponentPaths(page.componentTree, componentIds);
}

function resolveUniqueContext(
  result: LintResult,
  graph: SemanticGraph,
  model: SemanticPageModel
): ResolvedPageContext | undefined {
  const candidates = model.pages.flatMap<ResolvedPageContext>((page) => {
    if (page.route.state !== "known" || page.confidence === "unknown") return [];
    const confidence: ResolvedPageContext["confidence"] = page.confidence;
    return pathsForResult(result, page, graph).map((componentPath) => ({
      page: page.route.state === "known" ? page.route.value : "",
      componentPath,
      confidence,
    }));
  });
  const unique = new Map(
    candidates.map((candidate) => [
      `${candidate.page}\u0000${candidate.componentPath.join("\u0000")}`,
      candidate,
    ])
  );
  return unique.size === 1 ? [...unique.values()][0] : undefined;
}

function relatedCompositionLocations(
  context: ResolvedPageContext,
  graph: SemanticGraph,
  primary: ZemDomuSourceLocation
): ZemDomuRelatedLocation[] {
  const primaryKey = `${comparableFile(primary.file)}:${primary.line}:${primary.column}`;
  const related = context.componentPath.flatMap<ZemDomuRelatedLocation>(
    (componentId) => {
      const component = graph.components.find((entry) => entry.id === componentId);
      if (!component) return [];
      const source = sourceForProvenance(component.provenance, graph);
      if (!source) return [];
      const sourceKey = `${comparableFile(source.file)}:${source.line}:${source.column}`;
      if (sourceKey === primaryKey) return [];
      return [{ source, message: `Rendered through '${component.name}'` }];
    }
  );
  return [...new Map(related.map((entry) => [
    `${comparableFile(entry.source.file)}:${entry.source.line}:${entry.source.column}`,
    entry,
  ])).values()];
}

function suggestionFor(result: LintResult): ZemDomuDiagnosticSuggestion | undefined {
  const messages: Record<string, string> = {
    singleH1:
      "Keep one <h1> in the composed page; change this heading's level if it is not the page title.",
    enforceHeadingOrder:
      "Use the next sequential heading level for this section of the composed page.",
    uniqueIds: "Give this element an id that is unique within the composed page.",
    requireNavLinks: "Add at least one link to this navigation landmark.",
    enforceListNesting: "Render this list-item component inside a <ul> or <ol>.",
    requireSectionHeading:
      "Add a heading that describes this section, or use <div> when it is not a standalone section.",
  };
  const message = messages[result.rule];
  return message ? { message } : undefined;
}

/**
 * Adapt legacy lint results to canonical diagnostics and add page composition
 * context only when one page and one component path are statically resolved.
 */
export function createPageAwareDiagnostics(
  results: ReadonlyMap<string, readonly LintResult[]>,
  graph: SemanticGraph,
  model: SemanticPageModel
): ZemDomuDiagnostic[] {
  return [...results.entries()].flatMap(([sourceFile, entries]) =>
    entries.map((result) => {
      const primary: ZemDomuSourceLocation = {
        file: result.filePath ?? sourceFile,
        line: result.line,
        column: result.column,
        ...(result.offset === undefined ? {} : { offset: result.offset }),
      };
      const context = resolveUniqueContext(result, graph, model);
      if (!context) return toZemDomuDiagnostic(result, { sourceFile });
      const componentNames = context.componentPath.map(
        (componentId) =>
          graph.components.find((component) => component.id === componentId)?.name ??
          componentId
      );
      return toZemDomuDiagnostic(result, {
        sourceFile,
        page: context.page,
        componentPath: componentNames,
        relatedLocations: relatedCompositionLocations(context, graph, primary),
        preferredEditLocation: primary,
        suggestion: suggestionFor(result),
        provenance: {
          kind: "cross-component",
          analyzer: "SemanticPageComposer",
          description: `Resolved the finding through the unique component path for page '${context.page}'.`,
        },
        confidence: context.confidence,
      });
    })
  );
}
