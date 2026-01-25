## Unreleased

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
