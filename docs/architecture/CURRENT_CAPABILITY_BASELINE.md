# ZemDomu Core Current Capability Baseline

Status: audited against Core 1.3.19 on 2026-08-29 (ZD-01).

This baseline records what is shipped today, what is only partially available,
and what remains to be built in the semantic architecture direction. It is a
regression reference, not a replacement for the target architecture.

## Status definitions

- **Implemented**: available through the current Core API and protected by tests.
- **Partial**: useful behavior is shipped, but the target capability is incomplete.
- **Missing**: the target model or public behavior does not exist yet.

## Capability matrix

| Direction capability | Status | Current evidence | Boundary / follow-up |
| --- | --- | --- | --- |
| File-level rule engine | Implemented | `src/linter.ts`; rule-specific tests; `tests/rule-oracle.test.ts` | The oracle defines every registered rule across HTML, JSX, TSX, and Vue, but only `requireAltText` currently meets the 5 known-bad / 10 known-good-or-ambiguous target in all four syntaxes. |
| `ProjectLinter` file and project analysis | Implemented | `src/project-linter.ts`; `tests/linter.test.ts`; `tests/multi-root-isolation.test.ts`; `tests/inline-disable.test.ts` | Project analysis discovers local dependencies only when cross-component analysis is enabled. It does not yet produce a page/document model. |
| `ComponentPathResolver` | Implemented | `src/component-path-resolver.ts`; `tests/component-path-resolver-compat.test.ts`; `tests/crossComponent/cross-heading-order-alias.test.ts` | Supports local paths, common source extensions, directory indexes, `baseUrl`, and TypeScript path aliases. Package imports, dynamic imports, CommonJS `require`, re-export chains, and runtime resolution are outside the current graph. |
| React component discovery | Partial | `src/component-analyzer.ts`; `tests/crossComponent/cross-heading-order-entry-only.test.ts`; `tests/single-h1-returns.test.ts` | Traverses `.jsx` and `.tsx` files and capitalized default/named ESM imports. It does not model JSX in `.js`/`.ts`, member-expression components, multiple local components in one file, dynamic composition, or re-exports. |
| Vue component discovery | Partial | `src/component-analyzer.ts`; `src/utils/vue-sfc.ts`; `tests/vue-support.test.ts` | Traverses HTML `<template>` content and capitalized imports from Vue script blocks. It does not model router/page composition, non-HTML template languages, runtime registration, async components, or slot semantics. |
| Cross-component H1 analysis | Implemented | `tests/cross-component.test.js`; `tests/crossComponent/cross-heading-order.test.ts`; React and Vue conditional-path tests | Detects simultaneously rendered H1 conflicts across registered component roots and preserves source locations. Page identity and a first-class component path are not emitted. |
| Cross-component heading order | Implemented | `tests/crossComponent/cross-heading-order.test.ts`; `tests/cross-heading-reversed.test.ts` | Flattens known child headings in source order. Repeated component usages and runtime ordering are approximated from static source locations. |
| Cross-component duplicate IDs | Implemented | `tests/cross-duplicate-ids.test.js`; `tests/cross-duplicate-ids-tsx.test.ts` | Counts repeated known component usage. Mutually exclusive render branches and dynamic ID values are not modeled, so ambiguous compositions require follow-up rather than inference. |
| Cross-component navigation links | Implemented | `tests/cross-nav-links.test.js`; `tests/nav-links-components.test.ts`; `tests/vue-support.test.ts` | Resolved child components can satisfy a `<nav>`. An unresolved or depth-truncated child is treated as not proving a link and can retain the local warning. |
| Cross-component list nesting | Implemented | `tests/cross-list-nesting.test.ts`; `tests/list-nesting-dynamic.test.ts` | A resolved component that renders a root `<li>` can be validated at its use site. General slot/children flow is not modeled. |
| Cross-component section headings | Implemented | `tests/cross-section-heading.test.ts`; `tests/section-heading-jsx.test.ts` | A resolved child heading can satisfy a section. Conditional, slot-provided, or unresolved headings remain unknown. |
| Generic semantic component graph | Implemented | `src/semantic-graph.ts`; `ComponentAnalyzer.buildSemanticGraph`; `ProjectLinter.buildSemanticGraph`; `tests/semantic-graph-adapter.test.ts`; `docs/architecture/SEMANTIC_GRAPH_DOMAIN_MODEL.md` | Schema 1.0 has deterministic React/JSX/TSX and Vue producers for files, components, native facts, imports, ordered composition, conservative component semantic output, source evidence, explicit unknowns, and cycle/depth boundaries. Full native-tree and route/layout composition remain later layers. |
| Page/document model and route adapters | Implemented | `src/page-model.ts`; `ProjectLinter.buildPageModel()`; `tests/page-model.test.ts`; `docs/architecture/PAGE_DOCUMENT_MODEL.md` | Schema 1.0 composes configured or adapter-discovered page roots into nested component trees and ordered heading, landmark, section, navigation, and document-ID facts. Explicit configuration is certain; opt-in React/Vue filesystem discovery is inferred; unsupported routing stays unknown. No router is embedded in the graph contract. |
| Composed-page rules | Implemented, bounded tranche | `Rule.analyzePage`; `ProjectLinter.lintPageDiagnostics()`; `tests/page-rules.test.ts` | Resolved React/Vue pages apply duplicate H1, main, heading-order, section-heading, duplicate-ID, and opt-in missing-H1 analysis with propagated conditions and composition-instance evidence. Contextual header/footer landmark classification and runtime slot projection remain unknown. |
| Stable diagnostic model | Implemented | `src/diagnostics.ts`; `tests/diagnostics-contract.test.ts` | Schema 1.0 defines required identity, severity, message, and source fields plus optional semantic context. `LintResult` remains a compatibility input; future producers can add page, component-path, provenance, and confidence evidence without changing the contract. |
| SARIF 2.1.0 output | Partial | `src/sarif.ts`; `tests/sarif-output.test.ts` | Current output maps rule identity, message, severity, file, line, column, and help URI. It does not yet map related locations or future page/component context, and no schema-validation test is present. |
| Public Core exports | Implemented with a deprecated compatibility escape hatch | `src/index.ts`; `tests/public-api-boundary.test.ts`; `docs/architecture/PUBLIC_API_AND_INTEGRATION_BOUNDARIES.md` | `zemdomu` is the only supported entry point for file and project analysis. The wildcard subpath export remains temporarily available for 1.x compatibility and can be removed only in a documented major release after maintained integrations have migrated. |
| Pretty / JSON parity | Partial | The CLI and SARIF formatter consume `LintResult`; `serializeZemDomuDiagnostics` preserves the canonical JSON contract and optional context | The CLI does not yet expose the JSON serializer, and SARIF does not preserve every optional canonical field. ZD-10 and ZD-15 extend the current formatters. |
| Semantic provenance and confidence | Implemented for component output | `SemanticComponentOutput`, `SemanticInferenceEvidence`, `SemanticSourceProvenance`, and `tests/semantic-graph-adapter.test.ts` | Single unconditional native roots and resolved wrapper chains produce `inferred` output linked to `certain` native source evidence. Conditional returns, logical rendering, fragments, children/slots, multiple roots, unresolved wrappers, and cycles remain typed unknowns. Page-level confidence composes on this in ZD-08. |
| Semantic inspection / MCP | Missing | No graph/page inspection API is available | ZD-13 and ZD-14 remain post-graph experiments, not release prerequisites. |

## Regression baseline

The package test command is the executable baseline:

```bash
npm test
```

At the audit point it compiles Core and passes 173 tests. Representative gates
include:

- File-level behavior and source attribution across HTML, JSX, TSX, and Vue:
  `tests/rule-oracle.test.ts`, `tests/html-source-locations.test.ts`, and
  `tests/vue-support.test.ts`.
- React/TSX dependency traversal: the fixtures under `tests/crossComponent/`
  cover entry-only discovery, TypeScript aliases, heading order, H1 conflicts,
  and child-component diagnostics.
- Vue dependency traversal: `tests/vue-support.test.ts` covers imported `.vue`
  components, cross-component H1 analysis, location rebasing, bindings, and
  exclusive `v-if` / `v-else` branches.
- Cross-component structural behavior: duplicate IDs, navigation links, list
  nesting, section headings, depth limits, and multi-root isolation have
  dedicated regression tests.
- Consumer contracts: `tests/sarif-output.test.ts`,
  `tests/exports-helpers.test.ts`, and CLI tests protect current machine and
  public-API behavior.

The rule oracle deliberately distinguishes `known-bad`, `known-good`, and
`ambiguous` cases. Its topology test prevents a new rule or syntax from being
silently omitted. Its current coverage report is also a tracked limitation:
72 cases, 4 of 81 applicable rule/syntax cells populated, with 4 cells meeting
the future 5/10 target. ZD-20 owns broader corpus-level accuracy measurement;
this baseline does not claim precision or recall values.

## Known ambiguity and unresolved behavior

These cases are explicit limitations. They must not be converted into confident
semantic facts without evidence:

1. Unresolved, external, dynamic, CommonJS, member-expression, and re-exported
   component references do not contribute semantics to the current traversal.
2. A configured depth limit intentionally truncates the graph. Rules that need
   proof from a deeper child may retain a warning; the current diagnostic does
   not explain that the proof was truncated.
3. Static branch grouping avoids H1 false positives for supported React and Vue
   conditional forms. Other cross-component rules do not share a general branch
   model, so duplicate IDs or structural relationships in mutually exclusive or
   runtime-selected branches can remain ambiguous.
4. Dynamic attributes are generally treated conservatively by file-level rules,
   but the component analyzer cannot prove runtime ID, link, heading, slot, or
   landmark values.
5. Entry points are inferred as registered components that are not imported by
   another registered component. That is not equivalent to route or page-root
   discovery and can split or merge analysis differently from runtime routing.
6. Vue slots, React `children`, portals, fragments that cross ownership
   boundaries, render props, async components, and framework layout conventions
   are not represented as first-class composition edges.
7. Parse failures are surfaced by file-level parsing, but component analysis logs
   and skips a malformed component instead of adding an explicit unknown node to
   a graph.
8. Traversal code has circular-reference guards, but the audit found no dedicated
   cycle regression fixture. ZD-05 and ZD-06 should add one when cycle behavior
   becomes part of the typed graph contract.

Follow-up work should preserve shipped behavior and regression fixtures while
adding typed unknown states, page identity, provenance, and richer diagnostics.
The semantic-graph and diagnostic cards are extensions of this baseline, not
greenfield replacements for `ComponentAnalyzer`, `ComponentPathResolver`,
`ProjectLinter`, or `LintResult`.
