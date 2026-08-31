# Page / Document Model

Status: accepted contract for schema `1.0` (ZD-08).

## Decision

Core composes the public semantic graph into a page-scoped model through
`ProjectLinter.buildPageModel()`. Routing remains an adapter concern rather
than a graph concern. This preserves one framework-neutral component graph and
allows Next, React Router, Nuxt, Vue Router, or application-specific discovery
to be added without changing graph entities or rule traversal.

Page identity has three supported paths:

1. `ProjectLinterOptions.pages` maps a route to an entry file with `certain`
   confidence.
2. `createReactFileRouteAdapter()` and `createVueFileRouteAdapter()` are opt-in
   filesystem strategies with `inferred` confidence. Their directory and
   optional route mapping are caller-controlled.
3. `SemanticRouteAdapter` is the public extension point for framework/router
   strategies. An adapter returns route, root component, confidence, and
   provenance; it does not mutate the graph.

Without an applicable adapter, existing entry-point page roots are preserved
with unknown route identity. Missing configured entries and adapter references
become explicit unknowns rather than silently disappearing.

## Document composition

`SemanticPageDocument` contains:

- known or unknown route identity and explicit discovery confidence;
- the resolved or unknown root component;
- a nested `SemanticPageComponentTree` built from ordered composition edges;
- ordered `SemanticPageFact` entries for headings, landmarks, sections,
  navigation, and document IDs;
- component paths and native source provenance for every fact;
- render-branch conditions and cycle/depth/unresolved boundaries.

Layouts require no special graph node. A layout is a component that composes a
child component; nested React and Vue layout chains therefore use the same
component/composition edges as every other page. Frameworks that project pages
through runtime slots can supply a route adapter while the unresolved slot
remains unknown until a future adapter can prove its placement.

## Confidence and safety

Explicit configuration establishes page identity, not rendered semantics.
Rendered facts still come from source-backed graph nodes. Filesystem discovery
is labeled `inferred`, and conditional facts retain `SemanticRenderCondition`
instead of becoming unconditional page facts. Parent component-use conditions
propagate to every child fact, and composition-edge paths distinguish repeated
instances of the same component. Source-proven section ownership identifies the
nearest containing section across component boundaries, while ordered gap
evidence prevents rules from reasoning across unresolved runtime output. The
composer stops at cycles and depth boundaries and collects the corresponding
unknown evidence.

## Page-aware rules

`ProjectLinter.lintPageDiagnostics()` invokes `Rule.analyzePage` on the existing
registered rules. It does not introduce a second registry. The first page-aware
tranche covers `singleH1`, `requireSingleMain`, `enforceHeadingOrder`,
`requireSectionHeading`, and `uniqueIds`. Missing facts are reported only for a
known, resolved, complete page; conditional and unresolved composition remains
silent when a claim would be path-dependent.

`requirePageH1` (ZMD022) is a separate advisory, page-only rule and is disabled
by default. `singleH1` continues to mean “at most one H1,” while
`enforceHeadingOrder` continues to accept any first heading level and only
reports later upward skips.

Landmark integrity in this tranche is deliberately limited to a page's main
landmark through `requireSingleMain`. Correctly classifying contextual
`header`/`footer` landmarks requires native DOM ancestry that schema 1.0 does
not yet expose. Section-heading composition refines source-rule candidates with
resolved descendant components; slots, runtime projection, and unresolved
children remain unknown rather than producing a missing-heading claim.

## Compatibility

The page model is additive. `lint()`, `ProjectLinter.lintFile()`,
`ProjectLinter.lintFiles()`, and `ProjectLinter.buildSemanticGraph()` retain
their existing behavior. Page-aware rules can consume this model in ZD-11
without creating a second parser, resolver, or semantic rule system.
