# Semantic Graph Domain Model

Status: accepted contract for schema `1.0` (ZD-05).

## Decision

Core exports a typed, framework-neutral semantic graph contract from the
`zemdomu` package root. The contract is additive: the shipped
`ComponentAnalyzer`, `ComponentPathResolver`, cross-component rules, and
`LintResult` behavior continue unchanged. `ComponentAnalyzer.buildSemanticGraph()`
normalizes already-analyzed components, while
`ProjectLinter.buildSemanticGraph()` discovers supported local dependencies and
returns the public graph without running or replacing lint traversal.

The graph separates six concerns:

```text
files ──imports──> files / components
  │                    │
  └──owns───────────────┼──> rendered nodes
                       │       ├── native elements + semantic facts
                       │       ├── fragments / branches / slots
                       │       └── explicit unknown render nodes
                       └──composition edges──> rendered nodes / components

page roots ────────────> root components + rendered roots
```

This normalized structure gives future page analysis one ordered composition
model. Rules should consume the common graph/page view rather than each
implementing bespoke recursion over imports, component usages, headings, IDs,
and landmarks.

## Public contract

`src/semantic-graph.ts` defines and `src/index.ts` exports:

- `SemanticGraph` and schema constant `SEMANTIC_GRAPH_SCHEMA_VERSION`.
- File, component, native-element, fragment, and unknown-render nodes.
- Conservative component semantic output with terminal native-node evidence and
  an ordered custom-component path.
- Import and ordered composition edges.
- Rendered semantic facts for roles, landmarks, headings, document IDs,
  accessible names, and text.
- Page roots with independently known or unknown route, component, and render
  roots.
- Source/derived/inferred/analysis provenance.
- `SemanticValue<T>` and `SemanticReference<T>` discriminated unions.
- `validateSemanticGraph()` and `assertValidSemanticGraph()` for structural
  invariants.

The schema uses arrays and stable string IDs so it is serializable. IDs are
opaque to consumers; their construction remains an adapter concern. All source
coordinates are zero-based, matching the canonical diagnostic contract.

## Known facts and unknowns

Absence of proof is represented with `SemanticUnknown`, never by an empty
string, `null`, `false`, or a dropped edge. Every unknown has a reason,
provenance, and optional explanation or related entities.

| Situation | Contract representation |
| --- | --- |
| Resolved local import | `SemanticImportEdge.target.state === "resolved"` |
| Unresolved or external import | Unknown target with `unresolved-import` or `external-import` |
| Dynamic composition/value | Unknown with `runtime-composition` or `dynamic-value` |
| One unconditional native component root | `SemanticComponentOutput.state === "known"` with inferred provenance and certain native evidence |
| Resolved wrapper around one known component root | The child output plus an evidence path containing every wrapper component |
| Conditional, logical, fragment, multiple-root, or children/slot output | Unknown component output; no semantic tag is guessed from names or one possible branch |
| Conditional rendering | Composition condition with a branch group and exclusivity, or `conditional-render` when the relationship cannot be proved |
| JSX/Vue/multiple roots | A fragment node that preserves ownership and sibling order |
| React children / Vue slot | Fragment/composition relation when known, otherwise `slot-or-children` |
| Component cycle | A resolved edge plus a `cycle` traversal boundary and cycle path |
| Configured depth cutoff | A resolved/unknown edge plus a `depth-limit` boundary containing observed depth and configured maximum |
| Parse or unsupported syntax | Unknown render node or graph-completeness unknown |
| No trustworthy page identity | Unknown page root/reference or an analysis-level `missing-page-root` unknown |

Cycles are valid graph topology. They are not rejected as malformed because a
normalized graph can safely retain a back-edge without recursively expanding
it. `SemanticTraversalState` records where an extractor stopped so consumers do
not mistake a finite extraction for a complete render tree.

Analysis-level provenance may omit `fileId`. This is deliberate for facts such
as “no page root was discovered.” File-backed provenance includes `fileId` and
may include a precise range, framework, extractor, confidence, and explanation.

## Structural invariants

The validator checks:

1. Schema version and uniqueness of every entity/edge/root ID.
2. Unique file paths and valid file/component ownership.
3. Resolved import, composition, component-root, and page-root references.
4. Non-negative integer source coordinates and ordered ranges.
5. Non-negative integer sibling order and valid HTML heading levels.
6. Non-empty conditional branch identity.
7. Internally consistent cycle and depth-limit boundaries.
8. File references and ranges in provenance, including provenance nested in
   unknowns, values, conditions, and traversal boundaries.

Unknown references intentionally pass dangling-reference validation: their
state says the target is not known. Semantic correctness (for example, whether
an inferred landmark is appropriate) belongs to extractors and inference tests,
not structural validation.

## Shipped adaptation boundary

The first adapter extends the shipped behavior:

- `ComponentPathResolver` supplies known local resolution and unresolved import
  evidence.
- `ComponentAnalyzer` supplies current React/TSX and Vue component usages,
  native headings, IDs, nav/section/list facts, render ordering, and supported
  conditional groups.
- Existing cycle guards and `crossComponentDepth` behavior become explicit
  traversal boundaries rather than disappearing from the result.
- Existing entry-point inference can produce
  `discovery: "entry-point-heuristic"`; it must not be relabeled as a proven
  route.
- A component is inferred as a native tag only when its supported component
  function or Vue template has exactly one unconditional native root, or one
  resolved custom-component root whose own output meets the same proof. The
  inference records the entire component path and terminates at a source-backed
  native render node. Native evidence stays `certain`; the component conclusion
  is `inferred`.

The adapter emits deterministic file/component IDs, ordered source-backed facts
and component usages, explicit unresolved/dynamic/conditional states, and
cycle/depth traversal boundaries. Entry-point heuristics can identify a root
component but keep route identity unknown. `ProjectLinter.buildPageModel()` now
adds the separate schema 1.0 page composition layer documented in
[`PAGE_DOCUMENT_MODEL.md`](./PAGE_DOCUMENT_MODEL.md); rule consumption remains
a later stage. Keeping page identity and router strategies outside this graph
preserves an additive graph API and established rule results.

## Consequences

The contract adds more explicit state than a simple component tree, but that
cost prevents false certainty and repeated rule-specific traversal. The
normalized graph is framework-neutral without erasing framework evidence:
React, Vue, or future adapters identify themselves only in provenance and file
metadata. New fact and unknown-reason variants require a schema compatibility
decision, so consumers should discriminate on `kind`/`state` rather than infer
meaning from missing properties.
