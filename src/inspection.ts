import path from "path";
import type {
  SemanticGraph,
  SemanticPageRoot,
  SemanticRenderedFact,
  SemanticSourceProvenance,
  SemanticUnknown,
  SemanticValue,
} from "./semantic-graph";
import type {
  SemanticPageComponentTree,
  SemanticPageDocument,
  SemanticPageModel,
} from "./page-model";

interface UnknownInspection {
  context: string;
  unknown: SemanticUnknown;
}

type SourceResolver = (provenance: SemanticSourceProvenance) => string;

/** Render a deterministic, human-readable view of the public semantic graph. */
export function formatSemanticGraphInspection(graph: SemanticGraph): string {
  const source = createSourceResolver(graph);
  const lines = [
    `Semantic graph ${graph.schemaVersion}`,
    "Root: .",
    `Status: ${graph.boundary.completeness.state}`,
    "",
    `Files (${graph.files.length})`,
  ];

  const files = [...graph.files].sort((left, right) =>
    stableCompare(displayPath(left.path, graph), displayPath(right.path, graph))
  );
  if (!files.length) lines.push("- none");
  for (const file of files) {
    lines.push(
      `- file ${displayPath(file.path, graph)} [${file.framework}/${file.language}]`
    );
  }

  lines.push("", `Components (${graph.components.length})`);
  const components = [...graph.components].sort((left, right) =>
    stableCompare(`${left.name}\u0000${left.id}`, `${right.name}\u0000${right.id}`)
  );
  if (!components.length) lines.push("- none");
  for (const component of components) {
    const output = component.semanticOutput.state === "known"
      ? `<${component.semanticOutput.tagName}> [${component.semanticOutput.confidence}]`
      : `unknown(${component.semanticOutput.reason})`;
    lines.push(
      `- component ${component.name} -> ${output} @ ${source(component.provenance)}`
    );
  }

  lines.push("", `Semantic nodes (${graph.renderNodes.length})`);
  const renderNodes = [...graph.renderNodes].sort((left, right) =>
    stableCompare(
      `${source(left.provenance)}\u0000${left.id}`,
      `${source(right.provenance)}\u0000${right.id}`
    )
  );
  if (!renderNodes.length) lines.push("- none");
  for (const node of renderNodes) {
    if (node.kind === "native-element") {
      const facts = node.semantics.map(formatRenderedFact).join(", ");
      lines.push(
        `- native <${node.tagName}>${facts ? `: ${facts}` : ""} @ ${source(node.provenance)}`
      );
    } else if (node.kind === "fragment") {
      lines.push(
        `- fragment ${node.fragmentKind} @ ${source(node.provenance)}`
      );
    } else {
      lines.push(
        `- unknown-render ${node.unknown.reason} @ ${source(node.provenance)}`
      );
    }
  }

  const unknowns = collectGraphUnknowns(graph).sort(compareUnknowns(source));
  lines.push("", `Unknowns (${unknowns.length})`);
  if (!unknowns.length) lines.push("- none");
  for (const { context, unknown } of unknowns) {
    lines.push(
      `- ${context}: ${unknown.reason}${unknown.message ? ` - ${unknown.message}` : ""} @ ${source(unknown.provenance)}`
    );
  }

  return lines.join("\n");
}

/** Render one configured page from the public page/document model. */
export function formatSemanticPageInspection(
  model: SemanticPageModel,
  graph: SemanticGraph,
  route: string
): string {
  const source = createSourceResolver(graph);
  const componentNames = new Map(
    graph.components.map((component) => [component.id, component.name])
  );
  const page = model.pages.find(
    (candidate) =>
      candidate.route.state === "known" && candidate.route.value === route
  );
  if (!page) {
    throw new Error(`Page '${route}' was not found in the semantic page model.`);
  }

  const lines = [
    `Page ${route}`,
    `Schema: ${model.schemaVersion} (graph ${model.graphSchemaVersion})`,
    `Discovery: ${page.discovery} [${page.confidence}]`,
    "",
    "Components",
  ];

  if (page.componentTree) {
    appendComponentTree(lines, page.componentTree, source, "");
  } else {
    lines.push("- none");
  }

  const facts = [...page.facts].sort(
    (left, right) =>
      left.order - right.order ||
      (left.sequence ?? left.order) - (right.sequence ?? right.order) ||
      left.renderNodeId.localeCompare(right.renderNodeId)
  );
  lines.push("", `Semantic facts (${facts.length})`);
  if (!facts.length) lines.push("- none");
  for (const fact of facts) {
    const value = fact.value === undefined ? "" : `=${String(fact.value)}`;
    const componentPath = fact.componentPath
      .map((id) => componentNames.get(id) ?? id)
      .join(" > ");
    lines.push(
      `- ${fact.kind}${value} <${fact.tagName}> @ ${source(fact.provenance)}${componentPath ? ` [${componentPath}]` : ""}`
    );
  }

  const unknowns = collectPageUnknowns(model, page).sort(compareUnknowns(source));
  lines.push("", `Unknowns (${unknowns.length})`);
  if (!unknowns.length) lines.push("- none");
  for (const { context, unknown } of unknowns) {
    lines.push(
      `- ${context}: ${unknown.reason}${unknown.message ? ` - ${unknown.message}` : ""} @ ${source(unknown.provenance)}`
    );
  }

  return lines.join("\n");
}

function appendComponentTree(
  lines: string[],
  component: SemanticPageComponentTree,
  source: SourceResolver,
  indent: string
): void {
  const output = component.semanticOutput.state === "known"
    ? ` -> <${component.semanticOutput.tagName}> [${component.semanticOutput.confidence}]`
    : ` -> unknown(${component.semanticOutput.reason})`;
  lines.push(
    `${indent}- component ${component.name}${output} @ ${source(component.provenance)}`
  );
  for (const child of component.children) {
    appendComponentTree(lines, child, source, `${indent}  `);
  }
}

function formatRenderedFact(fact: SemanticRenderedFact): string {
  if (fact.kind === "heading") return `heading=${formatValue(fact.level)}`;
  if (fact.kind === "unknown") return `unknown=${fact.unknown.reason}`;
  return `${fact.kind}=${formatValue(fact.value)}`;
}

function formatValue<T>(value: SemanticValue<T>): string {
  if (value.state === "unknown") return `unknown(${value.reason})`;
  return String(value.value);
}

function collectGraphUnknowns(graph: SemanticGraph): UnknownInspection[] {
  const unknowns: UnknownInspection[] = [];
  const add = (context: string, unknown: SemanticUnknown): void => {
    unknowns.push({ context, unknown });
  };

  if (graph.boundary.completeness.state === "incomplete") {
    graph.boundary.completeness.unknowns.forEach((entry) => add("boundary", entry));
  }
  graph.components.forEach((component) => {
    if (component.semanticOutput.state === "unknown") {
      add(`component ${component.name}`, component.semanticOutput);
    }
  });
  graph.renderNodes.forEach((node) => {
    if (node.kind === "unknown-render") add("render", node.unknown);
    if (node.kind !== "native-element") return;
    node.attributes.forEach((attribute) => {
      if (attribute.value.state === "unknown") {
        add(`attribute ${attribute.name}`, attribute.value);
      }
    });
    node.semantics.forEach((fact) => {
      if (fact.kind === "unknown") add("semantic", fact.unknown);
      else if (fact.kind === "heading" && fact.level.state === "unknown") {
        add("semantic heading", fact.level);
      } else if (fact.kind !== "heading" && fact.value.state === "unknown") {
        add(`semantic ${fact.kind}`, fact.value);
      }
    });
  });
  graph.imports.forEach((edge) => {
    if (edge.target.state === "unknown") add(`import ${edge.specifier}`, edge.target);
  });
  graph.composition.forEach((edge) => {
    if (edge.to.state === "unknown") add(`composition ${edge.relation}`, edge.to);
    if (edge.order.state === "unknown") add("composition order", edge.order);
    if (edge.condition.kind === "unknown") add("composition condition", edge.condition.unknown);
    if (
      edge.condition.kind === "branch" &&
      edge.condition.expression.state === "unknown"
    ) {
      add("branch expression", edge.condition.expression);
    }
    if (edge.traversal.state === "boundary") {
      add(`traversal ${edge.traversal.reason}`, edge.traversal.unknown);
    }
  });
  graph.pageRoots.forEach((root) => collectPageRootUnknowns(root, add));
  return unknowns;
}

function collectPageRootUnknowns(
  root: SemanticPageRoot,
  add: (context: string, unknown: SemanticUnknown) => void
): void {
  if (root.route.state === "unknown") add("page route", root.route);
  if (root.rootComponent.state === "unknown") add("page root", root.rootComponent);
  root.renderRoots.forEach((renderRoot) => {
    if (renderRoot.state === "unknown") add("page render root", renderRoot);
  });
}

function collectPageUnknowns(
  model: SemanticPageModel,
  page: SemanticPageDocument
): UnknownInspection[] {
  const unknowns: UnknownInspection[] = [];
  model.unknowns.forEach((entry) => unknowns.push({ context: "model", unknown: entry }));
  page.unknowns.forEach((entry) => unknowns.push({ context: "page", unknown: entry }));
  page.gaps?.forEach((gap) => unknowns.push({ context: "composition gap", unknown: gap.unknown }));
  if (page.route.state === "unknown") unknowns.push({ context: "route", unknown: page.route });
  if (page.rootComponent.state === "unknown") {
    unknowns.push({ context: "root component", unknown: page.rootComponent });
  }
  if (page.componentTree) collectTreeUnknowns(page.componentTree, unknowns);
  return deduplicateUnknowns(unknowns);
}

function collectTreeUnknowns(
  component: SemanticPageComponentTree,
  unknowns: UnknownInspection[]
): void {
  component.unknowns.forEach((entry) =>
    unknowns.push({ context: `component ${component.name}`, unknown: entry })
  );
  component.children.forEach((child) => collectTreeUnknowns(child, unknowns));
}

function deduplicateUnknowns(unknowns: UnknownInspection[]): UnknownInspection[] {
  const seen = new Set<string>();
  return unknowns.filter(({ context, unknown }) => {
    const key = [
      context,
      unknown.reason,
      unknown.message ?? "",
      "fileId" in unknown.provenance ? unknown.provenance.fileId ?? "" : "",
      unknown.provenance.range?.start.line ?? "",
      unknown.provenance.range?.start.column ?? "",
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareUnknowns(source: SourceResolver) {
  return (left: UnknownInspection, right: UnknownInspection): number =>
    stableCompare(
      `${left.context}\u0000${left.unknown.reason}\u0000${source(left.unknown.provenance)}`,
      `${right.context}\u0000${right.unknown.reason}\u0000${source(right.unknown.provenance)}`
    );
}

function createSourceResolver(graph: SemanticGraph): SourceResolver {
  const sourcePaths = new Map(
    graph.files.map((file) => [file.id, displayPath(file.path, graph)])
  );
  return (provenance) => {
    const fileId = "fileId" in provenance ? provenance.fileId : undefined;
    const base = fileId ? sourcePaths.get(fileId) ?? "analysis" : "analysis";
    const start = provenance.range?.start;
    return start ? `${base}:${start.line + 1}:${start.column + 1}` : base;
  };
}

function displayPath(filePath: string, graph: SemanticGraph): string {
  const absolute = path.resolve(filePath);
  const relative = path.relative(path.resolve(graph.boundary.rootDirectory), absolute);
  if (relative && relative !== ".." && !relative.startsWith(`..${path.sep}`)) {
    return normalizePath(relative);
  }
  return normalizePath(absolute);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
