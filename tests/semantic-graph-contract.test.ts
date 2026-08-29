import assert from "assert";
import {
  assertValidSemanticGraph,
  SEMANTIC_GRAPH_SCHEMA_VERSION,
  SemanticGraph,
  SemanticSourceProvenance,
  SemanticUnknown,
  validateSemanticGraph,
} from "../src";

describe("semantic graph domain contract", () => {
  const fileProvenance = (
    fileId: string,
    line = 0,
    column = 0
  ): SemanticSourceProvenance => ({
    kind: "source",
    fileId,
    range: { start: { line, column } },
    framework: "react",
    extractor: "contract-fixture",
    confidence: "certain",
  });

  const unknown = (
    fileId: string,
    reason: SemanticUnknown["reason"],
    message?: string
  ): SemanticUnknown => ({
    state: "unknown",
    reason,
    message,
    provenance: fileProvenance(fileId),
  });

  it("represents composed semantics and conservative traversal boundaries", () => {
    const graph: SemanticGraph = {
      schemaVersion: SEMANTIC_GRAPH_SCHEMA_VERSION,
      boundary: {
        rootDirectory: "/project",
        maxDepth: 2,
        completeness: {
          state: "incomplete",
          unknowns: [
            unknown("file:page", "unresolved-import"),
            {
              state: "unknown",
              reason: "missing-page-root",
              message: "No router adapter supplied page identity.",
              provenance: {
                kind: "analysis",
                confidence: "certain",
                extractor: "contract-fixture",
              },
            },
          ],
        },
      },
      files: [
        {
          kind: "file",
          id: "file:page",
          path: "/project/Page.tsx",
          language: "typescript",
          framework: "react",
          componentIds: ["component:page"],
          provenance: fileProvenance("file:page"),
        },
        {
          kind: "file",
          id: "file:card",
          path: "/project/Card.tsx",
          language: "typescript",
          framework: "react",
          componentIds: ["component:card"],
          provenance: fileProvenance("file:card"),
        },
      ],
      components: [
        {
          kind: "component",
          id: "component:page",
          fileId: "file:page",
          name: "Page",
          exportName: "default",
          renderRoots: [{ state: "resolved", id: "render:branch-fragment" }],
          semanticOutput: unknown(
            "file:page",
            "conditional-render",
            "The branch does not prove one output."
          ),
          provenance: fileProvenance("file:page"),
        },
        {
          kind: "component",
          id: "component:card",
          fileId: "file:card",
          name: "Card",
          renderRoots: [{ state: "resolved", id: "render:heading" }],
          semanticOutput: {
            state: "known",
            tagName: "h1",
            namespace: "html",
            confidence: "inferred",
            evidence: {
              componentPath: ["component:card"],
              renderNodeId: "render:heading",
              provenance: fileProvenance("file:card", 1, 9),
            },
            provenance: {
              ...fileProvenance("file:card", 1, 9),
              kind: "inferred",
              confidence: "inferred",
            },
          },
          provenance: fileProvenance("file:card"),
        },
      ],
      renderNodes: [
        {
          kind: "fragment",
          id: "render:branch-fragment",
          fileId: "file:page",
          fragmentKind: "conditional-branch",
          provenance: fileProvenance("file:page", 3, 4),
        },
        {
          kind: "native-element",
          id: "render:main",
          fileId: "file:page",
          tagName: "main",
          namespace: "html",
          attributes: [],
          semantics: [
            {
              kind: "landmark",
              value: { state: "known", value: "main" },
              provenance: fileProvenance("file:page", 4, 6),
            },
          ],
          provenance: fileProvenance("file:page", 4, 6),
        },
        {
          kind: "native-element",
          id: "render:heading",
          fileId: "file:card",
          tagName: "h1",
          namespace: "html",
          attributes: [],
          semantics: [
            {
              kind: "heading",
              level: { state: "known", value: 1 },
              provenance: fileProvenance("file:card", 1, 9),
            },
          ],
          provenance: fileProvenance("file:card", 1, 9),
        },
        {
          kind: "unknown-render",
          id: "render:depth-unknown",
          fileId: "file:card",
          unknown: unknown("file:card", "depth-limit"),
          provenance: fileProvenance("file:card"),
        },
      ],
      imports: [
        {
          kind: "import",
          id: "import:card",
          sourceFileId: "file:page",
          specifier: "./Card",
          importKind: "default",
          localName: "Card",
          target: { state: "resolved", id: "component:card" },
          provenance: fileProvenance("file:page", 0, 0),
        },
        {
          kind: "import",
          id: "import:missing",
          sourceFileId: "file:page",
          specifier: "./Missing",
          importKind: "default",
          localName: "Missing",
          target: unknown(
            "file:page",
            "unresolved-import",
            "ComponentPathResolver did not resolve this local import."
          ),
          provenance: fileProvenance("file:page", 1, 0),
        },
      ],
      composition: [
        {
          kind: "composition",
          id: "composition:page-fragment",
          from: "component:page",
          to: { state: "resolved", id: "render:branch-fragment" },
          relation: "renders",
          order: { state: "known", value: 0 },
          cardinality: "one",
          condition: { kind: "always" },
          traversal: { state: "complete" },
          provenance: fileProvenance("file:page", 3, 4),
        },
        {
          kind: "composition",
          id: "composition:fragment-main",
          from: "render:branch-fragment",
          to: { state: "resolved", id: "render:main" },
          relation: "renders",
          order: { state: "known", value: 0 },
          cardinality: "optional",
          condition: {
            kind: "branch",
            groupId: "page-return",
            branchId: "truthy",
            mutuallyExclusive: true,
            expression: { state: "known", value: "show" },
          },
          traversal: { state: "complete" },
          provenance: fileProvenance("file:page", 4, 6),
        },
        {
          kind: "composition",
          id: "composition:main-card",
          from: "render:main",
          to: { state: "resolved", id: "component:card" },
          relation: "uses-component",
          order: { state: "known", value: 0 },
          cardinality: "one",
          condition: {
            kind: "unknown",
            unknown: unknown("file:page", "conditional-render"),
          },
          traversal: { state: "complete" },
          provenance: fileProvenance("file:page", 5, 8),
        },
        {
          kind: "composition",
          id: "composition:card-page-cycle",
          from: "component:card",
          to: { state: "resolved", id: "component:page" },
          relation: "uses-component",
          order: { state: "known", value: 1 },
          cardinality: "optional",
          condition: { kind: "always" },
          traversal: {
            state: "boundary",
            reason: "cycle",
            cycle: ["component:page", "component:card", "component:page"],
            unknown: unknown("file:card", "cycle"),
          },
          provenance: fileProvenance("file:card", 2, 8),
        },
        {
          kind: "composition",
          id: "composition:depth-boundary",
          from: "render:heading",
          to: { state: "resolved", id: "render:depth-unknown" },
          relation: "unknown",
          order: unknown("file:card", "dynamic-value"),
          cardinality: "unknown",
          condition: { kind: "always" },
          traversal: {
            state: "boundary",
            reason: "depth-limit",
            depth: 3,
            maxDepth: 2,
            unknown: unknown("file:card", "depth-limit"),
          },
          provenance: fileProvenance("file:card", 3, 8),
        },
      ],
      pageRoots: [
        {
          kind: "page-root",
          id: "page:/products/:id",
          route: { state: "known", value: "/products/:id" },
          rootComponent: { state: "resolved", id: "component:page" },
          renderRoots: [{ state: "resolved", id: "render:branch-fragment" }],
          discovery: "framework-adapter",
          provenance: {
            ...fileProvenance("file:page"),
            kind: "derived",
            confidence: "inferred",
          },
        },
      ],
    };

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    assert.doesNotThrow(() => assertValidSemanticGraph(graph));
    assert.strictEqual(graph.imports[1].target.state, "unknown");
    assert.strictEqual(graph.renderNodes[0].kind, "fragment");
    assert.strictEqual(graph.composition[3].traversal.state, "boundary");
  });

  it("reports invariant violations while accepting explicit unknowns", () => {
    const graph: SemanticGraph = {
      schemaVersion: SEMANTIC_GRAPH_SCHEMA_VERSION,
      boundary: {
        rootDirectory: "/project",
        completeness: { state: "complete" },
      },
      files: [
        {
          kind: "file",
          id: "duplicate",
          path: "/project/Page.vue",
          language: "vue",
          framework: "vue",
          componentIds: ["missing-component"],
          provenance: fileProvenance("duplicate"),
        },
      ],
      components: [],
      renderNodes: [
        {
          kind: "fragment",
          id: "duplicate",
          fileId: "duplicate",
          fragmentKind: "vue-template",
          provenance: {
            ...fileProvenance("duplicate"),
            framework: "vue",
          },
        },
      ],
      imports: [],
      composition: [
        {
          kind: "composition",
          id: "bad-edge",
          from: "missing-source",
          to: unknown("duplicate", "runtime-composition"),
          relation: "unknown",
          order: { state: "known", value: -1 },
          cardinality: "unknown",
          condition: {
            kind: "branch",
            groupId: "",
            branchId: "",
            mutuallyExclusive: false,
            expression: unknown("duplicate", "dynamic-value"),
          },
          traversal: { state: "complete" },
          provenance: fileProvenance("duplicate"),
        },
      ],
      pageRoots: [],
    };

    const issues = validateSemanticGraph(graph);
    const codes = new Set(issues.map((issue) => issue.code));
    assert(codes.has("duplicate-id"));
    assert(codes.has("dangling-reference"));
    assert(codes.has("invalid-order"));
    assert(codes.has("invalid-condition"));
    assert.throws(() => assertValidSemanticGraph(graph), /Invalid semantic graph/);
  });
});
