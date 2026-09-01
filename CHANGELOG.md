## Unreleased

## 1.3.21

### Bugfix

- Bugfix: include TypeScript as a runtime dependency so clean package installs can load project and dependency analysis without a missing-module error.
- Bugfix: reduce real-world false positives by preserving HTML ancestry across void and mismatched elements; distinguishing native JSX tags from custom components; accepting valid ARIA shorthand, title-based names, prop and Vue attribute forwarding, composed root list items, conditional Vue IDs, hidden decorative images, and intentional icon markup; and recognizing Next.js metadata and deferred page landmarks.
- Bugfix: accept explicitly named icon-only links and buttons without requiring a redundant accessible name on their child SVG.
- Bugfix: report exact HTML element and attribute locations, expose absolute diagnostic offsets, and rebase Vue template findings to full-document positions so repeated violations and quick fixes target the correct source.
- Bugfix: support valid implicit form labels and avoid label false positives for hidden inputs, named image inputs, and named submit, reset, and button inputs.
- Bugfix: allow heading rank decreases that close subsections in both local and cross-component heading-order analysis.
- Bugfix: isolate component resolution, tsconfig aliases, and caches per project root so multiple workspace roots cannot contaminate one another.
- Bugfix: recognize non-empty nested inline content, require document titles to appear inside `<head>`, report every extra `<main>`, detect JSX/TSX `tabIndex`, and anchor JSX attribute diagnostics to the exact attribute.

### Feature

- Feature: run duplicate-H1, main-landmark, heading-order, section-heading, and duplicate-ID rules across resolved React and Vue page composition; preserve component-instance provenance; suppress conditional or unresolved ambiguity; and add the opt-in advisory `requirePageH1` rule (ZMD022).
- Feature: add canonical `zemdomu check --format pretty|json|sarif` output with deterministic JSON, documented exit codes, and SARIF 2.1.0 related-location and semantic-context mapping.
- Feature: add page-aware canonical diagnostics with uniquely resolved page and component paths, composition-related locations, conservative suggestions and preferred edit locations, plus reusable readable terminal formatting.
- Feature: add a versioned page/document model with configured and opt-in React/Vue filesystem route adapters, nested component trees, and ordered heading, landmark, section, navigation, and document-ID facts with source/component provenance.
- Feature: infer single, unconditional React and Vue component outputs such as `<header>`, `<nav>`, `<main>`, and `<button>` with source-backed evidence paths and explicit inferred or unknown confidence states.
- Feature: expose a versioned, framework-neutral semantic graph contract for files, components, native rendered elements, imports, composition, semantic facts, page roots, provenance, and explicit unknown analysis boundaries.
- Feature: add deterministic `ProjectLinter.buildSemanticGraph()` output for supported React and Vue component projects, including source-backed imports and composition plus conservative alias, conditional, cycle, unresolved, dynamic, and depth-limit states.
- Feature: expose a versioned canonical diagnostic contract and JSON serializer with stable rule codes, severity, source locations, related context, suggestions, and semantic provenance metadata while preserving the existing lint result API.
- Feature: support `zemdomu-disable-next`, `zemdomu-disable`, and `zemdomu-enable` directives in HTML, JSX, TSX, and Vue ProjectLinter analysis.
- Feature: export advisory and house-style rule classification metadata and default `singleH1`, `requireTableCaption`, `requireSectionHeading`, and `requireNavLinks` to warning severity.

### Docs

- Docs: align the Core README and npm description with the approved semantic
  accessibility static-analysis positioning, public product names, supported
  cross-component scope, and layered-testing limits.
- Docs: publish the completed ZD-20 diagnostic-accuracy study with a pinned 10-repository HTML, React, and Vue corpus, 407 adjudicated findings, seeded-recall evidence, and rendered axe-core comparisons.
- Docs: approve canonical ZemDomu positioning, public product names, fair comparison principles, and separate Core capability and VS Code Extension 1.0 milestones.
- Docs: define the supported `zemdomu` package-root API for file and project analysis, including subpath deprecation and integration ownership boundaries.

### Security

- Security: update dependency overrides and the lockfile to patched js-yaml, brace-expansion, and related transitive versions.

## 1.3.19

### Bugfix

- Bugfix: allow explicit empty `alt=""` values for decorative images while still warning when `<img>` has no alt attribute.
- Bugfix: treat framework host `index.html` files as app shells so document-only rules do not report ZMD013, ZMD019, or ZMD020 there, while parsing `.html` files as HTML to avoid false parse errors.

### Security

- Security: update Core build dependency and dependency overrides to clear npm audit vulnerabilities.

## 1.3.18

### Bugfix

- Bugfix: requireLinkText now accepts accessible names from aria-label, aria-labelledby, and img alt text.
- Bugfix: validate <html lang> values against a BCP47-ish format and flag invalid tags.
- Bugfix: requireAltText now checks inline SVG icons used as images or icon-only controls.

### Feature

- Feature: add `requireDocumentTitle` (ZMD019) to require a non-empty `<title>` in HTML documents.
- Feature: add `requireSingleMain` (ZMD020) to enforce exactly one `<main>` landmark in HTML documents.
- Feature: add `ariaValidAttrValue` (ZMD021) to validate supported static ARIA attribute values.
- Feature: add npm funding metadata linking to Buy Me a Coffee for `npm fund`.

### Security

- Security: override @isaacs/brace-expansion to 5.0.1 to address the dependabot alert.
- Security: add dependency overrides for diff, minimatch, and serialize-javascript to resolve dependabot vulnerability alerts without changing core lint behavior.

### Chore

- Chore: remove tracked out/ build output and clean it after tests.

### Docs

- Docs: add a "Why ZemDomu vs alternatives" section to the core README.

## 1.3.17

- Feature: add ZMD018 to flag unresolved TODO-ZMD placeholders in markup
- Feature: allow aria-label/aria-labelledby to satisfy section heading requirements (ZMD001)
- Bugfix: warn when <caption> exists but is empty (matches ZMD008 quick fix output)
- Bugfix: requireButtonText now checks accessible names from aria-label, aria-labelledby, content text, and img alt while ignoring hidden text
- Bugfix: requireLabelForFormControls now respects htmlFor in JSX and aria-labelledby text resolution
- Bugfix: ProjectLinter now attaches filePath to per-file lint results for easier attribution

## 1.3.16

- Feature: allow cross-component list items to satisfy list nesting when rendered inside <ul>/<ol>
- Feature: allow section headings provided by child components to satisfy <section> requirements
- Bugfix: avoid singleH1 warnings when <h1> render paths are mutually exclusive (returns, ternaries, v-if/v-else)
- Bugfix: allow router/link components with href/to to satisfy <nav> link requirements
- Docs: clarify CLI custom rule usage and custom-rules directory requirement
- Docs: add sample custom rule file for CLI usage
-performance: add CLI perf report and slowest logging, plus tests
-chore: add regression test for parse errors across multiple files
-feature: export additional JSX helper utilities for custom rules

## 1.3.15

- Bugfix: handle dynamic anchor href/text bindings without false positives, and flag explicitly empty values (tests + fixtures updated)
- Bugfix: allow dynamic img alt bindings while still flagging empty/undefined alt values
- Bugfix: clarify link/alt warnings when values are possibly empty or undefined
- Bugfix: avoid list nesting warnings for JSX map output inside lists

## 1.3.0

- Cross-component: follow local imports automatically
- Support TS path aliases (`baseUrl` + `paths`)
- Tests: entry-only + alias traversal
