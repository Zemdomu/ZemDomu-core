## Unreleased

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
