## Unreleased

- Feature: allow cross-component list items to satisfy list nesting when rendered inside <ul>/<ol>
- Feature: allow section headings provided by child components to satisfy <section> requirements
- Bugfix: avoid singleH1 warnings when <h1> render paths are mutually exclusive (returns, ternaries, v-if/v-else)

## 1.3.15

- Bugfix: handle dynamic anchor href/text bindings without false positives, and flag explicitly empty values (tests + fixtures updated)
- Bugfix: allow dynamic img alt bindings while still flagging empty/undefined alt values
- Bugfix: clarify link/alt warnings when values are possibly empty or undefined
- Bugfix: avoid list nesting warnings for JSX map output inside lists

## 1.3.0

- Cross-component: follow local imports automatically
- Support TS path aliases (`baseUrl` + `paths`)
- Tests: entry-only + alias traversal
