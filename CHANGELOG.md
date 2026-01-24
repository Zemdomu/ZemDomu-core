## Unreleased

- Bugfix: handle dynamic anchor href/text bindings without false positives, and flag explicitly empty values (tests + fixtures updated)
- Bugfix: allow dynamic img alt bindings while still flagging empty/undefined alt values
- Bugfix: clarify link/alt warnings when values are possibly empty or undefined

## 1.3.0

- Cross-component: follow local imports automatically
- Support TS path aliases (`baseUrl` + `paths`)
- Tests: entry-only + alias traversal
