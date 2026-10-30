import assert from "assert";
import os from "os";
import path from "path";
import { formatSemanticGraphInspection, formatSemanticPageInspection } from "../src/inspection";
import { SemanticPageDocument, SemanticPageModel } from "../src/page-model";
import { SemanticGraph, SemanticSourceProvenance, SemanticUnknown, validateSemanticGraph } from "../src/semantic-graph";

const root = path.join(os.tmpdir(), "zemdomu-inspection-contract");
const analysis: SemanticSourceProvenance = { kind: "analysis", confidence: "certain" };
const source = (fileId: string, line = 2, column = 4): SemanticSourceProvenance => ({
  kind: "source", fileId, range: { start: { line, column } }, confidence: "certain",
});
const unknown = (reason: SemanticUnknown["reason"], message?: string, provenance: SemanticSourceProvenance = analysis): SemanticUnknown => ({
  state: "unknown", reason, ...(message === undefined ? {} : { message }), provenance,
});
function emptyGraph(): SemanticGraph {
  return { schemaVersion: "1.0", boundary: { rootDirectory: root, completeness: { state: "complete" } },
    files: [], components: [], renderNodes: [], imports: [], composition: [], pageRoots: [] };
}
function evidenceGraph(): SemanticGraph {
  const a = source("file:a");
  const z = source("file:z");
  return {
    ...emptyGraph(),
    boundary: { rootDirectory: root, completeness: { state: "incomplete", unknowns: [unknown("parse-error", "Parser stopped.")] } },
    files: [
      { kind: "file", id: "file:z", path: path.join(root, "src/Z.tsx"), language: "typescript", framework: "react", componentIds: ["component:z"], provenance: z },
      { kind: "file", id: "file:a", path: path.join(root, "src/A.tsx"), language: "typescript", framework: "react", componentIds: ["component:a"], provenance: a },
    ],
    components: [
      { kind: "component", id: "component:z", fileId: "file:z", name: "Zulu", renderRoots: [{ state: "resolved", id: "render:fragment" }], semanticOutput: unknown("conditional-render", undefined, z), provenance: z },
      { kind: "component", id: "component:a", fileId: "file:a", name: "Alpha", renderRoots: [{ state: "resolved", id: "render:a" }], semanticOutput: {
        state: "known", tagName: "h2", namespace: "html", confidence: "inferred",
        evidence: { componentPath: ["component:a"], renderNodeId: "render:a", provenance: a },
        provenance: { ...a, kind: "inferred", confidence: "inferred" },
      }, provenance: a },
    ],
    renderNodes: [
      { kind: "unknown-render", id: "render:unknown", fileId: "file:z", unknown: unknown("unsupported-syntax", undefined, z), provenance: z },
      { kind: "fragment", id: "render:fragment", fileId: "file:z", fragmentKind: "conditional-branch", provenance: z },
      { kind: "native-element", id: "render:z", fileId: "file:z", tagName: "section", namespace: "html", attributes: [], semantics: [
        { kind: "heading", level: unknown("dynamic-value", undefined, z), provenance: z },
        { kind: "landmark", value: unknown("runtime-composition", undefined, z), provenance: z },
      ], provenance: z },
      { kind: "native-element", id: "render:empty", fileId: "file:a", tagName: "span", namespace: "html", attributes: [], semantics: [], provenance: a },
      { kind: "native-element", id: "render:a", fileId: "file:a", tagName: "h2", namespace: "html", attributes: [
        { name: "title", value: unknown("dynamic-value", "Runtime title.", a), provenance: a },
      ], semantics: [
        { kind: "heading", level: { state: "known", value: 2 }, provenance: a },
        { kind: "text", value: { state: "known", value: "Introduction" }, provenance: a },
        { kind: "unknown", unknown: unknown("other", "No name proof.", a), provenance: a },
      ], provenance: a },
    ],
    imports: [{ kind: "import", id: "import:external", sourceFileId: "file:z", specifier: "external-widget", importKind: "default", target: unknown("external-import", undefined, z), provenance: z }],
    composition: [
      { kind: "composition", id: "edge:unknown", from: "component:z", to: unknown("unresolved-import", undefined, z), relation: "uses-component", order: unknown("dynamic-value", undefined, z), cardinality: "unknown",
        condition: { kind: "unknown", unknown: unknown("conditional-render", undefined, z) },
        traversal: { state: "boundary", reason: "depth-limit", depth: 2, maxDepth: 1, unknown: unknown("depth-limit", undefined, z) }, provenance: z },
      { kind: "composition", id: "edge:branch", from: "component:z", to: { state: "resolved", id: "render:z" }, relation: "renders", order: { state: "known", value: 0 }, cardinality: "optional",
        condition: { kind: "branch", groupId: "choice", branchId: "yes", mutuallyExclusive: true, expression: unknown("dynamic-value", undefined, z) }, traversal: { state: "complete" }, provenance: z },
    ],
    pageRoots: [{ kind: "page-root", id: "page:unknown", route: unknown("missing-page-root"), rootComponent: unknown("runtime-composition"), renderRoots: [unknown("unsupported-syntax")], discovery: "unknown", provenance: analysis }],
  };
}
function page(overrides: Partial<SemanticPageDocument> = {}): SemanticPageDocument {
  return { id: "page:test", route: { state: "known", value: "/test" }, discovery: "configured", confidence: "certain",
    rootComponent: unknown("missing-page-root"), facts: [], unknowns: [], provenance: analysis, ...overrides };
}
const model = (...pages: SemanticPageDocument[]): SemanticPageModel => ({ schemaVersion: "1.0", graphSchemaVersion: "1.0", pages, unknowns: [] });

describe("semantic inspection output contract", () => {
  it("represents an empty complete graph without fabricating files or unknowns", () => {
    const graph = emptyGraph();
    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    assert.strictEqual(formatSemanticGraphInspection(graph), [
      "Semantic graph 1.0", "Root: .", "Status: complete", "", "Files (0)", "- none", "",
      "Components (0)", "- none", "", "Semantic nodes (0)", "- none", "", "Unknowns (0)", "- none",
    ].join("\n"));
  });

  it("retains every kind of unknown evidence with one-based source locations", () => {
    const graph = evidenceGraph();
    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    const output = formatSemanticGraphInspection(graph);
    const lines = output.split("\n");
    for (const expected of [
      "- component Alpha -> <h2> [inferred] @ src/A.tsx:3:5",
      "- component Zulu -> unknown(conditional-render) @ src/Z.tsx:3:5",
      "- native <h2>: heading=2, text=Introduction, unknown=other @ src/A.tsx:3:5",
      "- native <span> @ src/A.tsx:3:5",
      "- native <section>: heading=unknown(dynamic-value), landmark=unknown(runtime-composition) @ src/Z.tsx:3:5",
      "- fragment conditional-branch @ src/Z.tsx:3:5",
      "- unknown-render unsupported-syntax @ src/Z.tsx:3:5",
      "- attribute title: dynamic-value - Runtime title. @ src/A.tsx:3:5",
      "- boundary: parse-error - Parser stopped. @ analysis",
      "- branch expression: dynamic-value @ src/Z.tsx:3:5",
      "- component Zulu: conditional-render @ src/Z.tsx:3:5",
      "- composition condition: conditional-render @ src/Z.tsx:3:5",
      "- composition order: dynamic-value @ src/Z.tsx:3:5",
      "- composition uses-component: unresolved-import @ src/Z.tsx:3:5",
      "- import external-widget: external-import @ src/Z.tsx:3:5",
      "- page render root: unsupported-syntax @ analysis",
      "- page root: runtime-composition @ analysis",
      "- page route: missing-page-root @ analysis",
      "- render: unsupported-syntax @ src/Z.tsx:3:5",
      "- semantic: other - No name proof. @ src/A.tsx:3:5",
      "- semantic heading: dynamic-value @ src/Z.tsx:3:5",
      "- semantic landmark: runtime-composition @ src/Z.tsx:3:5",
      "- traversal depth-limit: depth-limit @ src/Z.tsx:3:5",
    ]) assert.ok(lines.includes(expected), `Missing inspection evidence: ${expected}`);
    assert.ok(lines.includes("Unknowns (16)"));
  });

  it("sorts graph collections reproducibly without mutating the supplied graph", () => {
    const graph = evidenceGraph();
    const before = structuredClone(graph);
    const first = formatSemanticGraphInspection(graph);
    assert.deepStrictEqual(graph, before);
    const permuted = { ...graph, files: [...graph.files].reverse(), components: [...graph.components].reverse(), renderNodes: [...graph.renderNodes].reverse() };
    assert.strictEqual(formatSemanticGraphInspection(permuted), first);
    assert.ok(first.indexOf("- file src/A.tsx") < first.indexOf("- file src/Z.tsx"));
    assert.ok(first.indexOf("- component Alpha") < first.indexOf("- component Zulu"));
    assert.ok(first.indexOf("- native <h2>") < first.indexOf("- native <span>"));
  });

  it("distinguishes project-relative sources, external sources, and location-free provenance", () => {
    const graph = emptyGraph();
    const external = path.join(path.dirname(root), "shared", "Outside.tsx");
    graph.files = [{ kind: "file", id: "file:external", path: external, language: "typescript", framework: "react", componentIds: [], provenance: { kind: "source", fileId: "file:external", confidence: "certain" } }];
    graph.boundary.completeness = { state: "incomplete", unknowns: [unknown("parse-error", "External parse failed.", graph.files[0].provenance)] };
    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    const display = external.replace(/\\/g, "/");
    const output = formatSemanticGraphInspection(graph);
    assert.ok(output.includes(`- file ${display} [react/typescript]`));
    assert.ok(output.includes(`- boundary: parse-error - External parse failed. @ ${display}`));
    assert.ok(!output.includes("../shared"));
  });

  it("reports missing routes and incomplete pages explicitly without inventing a component tree", () => {
    const selected = page();
    const input = model(page({ route: unknown("missing-page-root") }), page({ route: { state: "known", value: "/other" } }), selected);
    assert.strictEqual(formatSemanticPageInspection(input, emptyGraph(), "/test"), [
      "Page /test", "Schema: 1.0 (graph 1.0)", "Discovery: configured [certain]", "", "Components", "- none", "",
      "Semantic facts (0)", "- none", "", "Unknowns (1)", "- root component: missing-page-root @ analysis",
    ].join("\n"));
    assert.throws(() => formatSemanticPageInspection(input, emptyGraph(), "/missing"), { message: "Page '/missing' was not found in the semantic page model." });
  });

  it("orders page facts, preserves nested component uncertainty, and deduplicates only identical evidence", () => {
    const graph = evidenceGraph();
    const a = source("file:a");
    const shared = unknown("other", "No runtime evidence.");
    const rootTree = { componentId: "component:a", name: "Alpha", semanticOutput: graph.components[1].semanticOutput, compositionPath: [], provenance: a,
      unknowns: [shared, structuredClone(shared)], children: [{ componentId: "component:z", name: "Zulu", semanticOutput: graph.components[0].semanticOutput,
        compositionPath: ["edge:unknown"], provenance: source("file:z"), children: [], unknowns: [unknown("conditional-render")] }] };
    const selected = page({ rootComponent: { state: "resolved", id: "component:a" }, componentTree: rootTree, unknowns: [shared],
      gaps: [{ sequence: 4, componentPath: ["component:a"], unknown: shared, provenance: analysis }],
      facts: [
        { kind: "section", order: 2, tagName: "section", renderNodeId: "render:z", componentPath: [], condition: { kind: "always" }, provenance: source("file:z") },
        { kind: "heading", value: 2, order: 1, tagName: "h2", renderNodeId: "render:a", componentPath: ["component:a"], condition: { kind: "always" }, provenance: a },
        { kind: "document-id", value: "intro", order: 1, sequence: 0, tagName: "section", renderNodeId: "render:z", componentPath: ["component:a", "component:z"], condition: { kind: "always" }, provenance: source("file:z") },
      ] });
    const input = { ...model(selected), unknowns: [shared, structuredClone(shared), unknown("other", "Different evidence."), unknown("other", "No runtime evidence.", a)] };
    const before = structuredClone(input);
    const output = formatSemanticPageInspection(input, graph, "/test");
    assert.deepStrictEqual(input, before);
    const lines = output.split("\n");
    assert.deepStrictEqual(lines.filter(line => /^- (document-id|heading|section)(=| )/.test(line)), [
      "- document-id=intro <section> @ src/Z.tsx:3:5 [Alpha > Zulu]",
      "- heading=2 <h2> @ src/A.tsx:3:5 [Alpha]",
      "- section <section> @ src/Z.tsx:3:5",
    ]);
    assert.ok(lines.includes("  - component Zulu -> unknown(conditional-render) @ src/Z.tsx:3:5"));
    assert.ok(lines.includes("Unknowns (7)"));
    assert.strictEqual(lines.filter(line => line === "- model: other - No runtime evidence. @ analysis").length, 1);
    assert.ok(lines.includes("- model: other - Different evidence. @ analysis"));
    assert.ok(lines.includes("- model: other - No runtime evidence. @ src/A.tsx:3:5"));
    assert.ok(lines.includes("- page: other - No runtime evidence. @ analysis"));
    assert.ok(lines.includes("- composition gap: other - No runtime evidence. @ analysis"));
  });
});
