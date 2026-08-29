# ADR: Public API and integration boundaries

Status: Accepted on 2026-08-29 (ZD-04).

## Context

Core, the bundled CLI, the VS Code extension, and the GitHub Action all need the
same semantic results, but they deliver those results through different user
interfaces. The package currently exposes its intended API from `zemdomu` while
also allowing wildcard subpath imports through `./*`. That compatibility escape
hatch makes internal files importable even though their layout and contracts are
not designed as independent public APIs.

The integrations already use the package root in production. The audit found no
`zemdomu/*` import in their source, but it did find duplicated policy and
presentation-adjacent logic that can drift from Core.

## Decision

`zemdomu` is the only supported public entry point. It supports both analysis
scopes without introducing a second issue model:

- `lint(content, options)` analyzes one in-memory HTML, JSX, TSX, or Vue
  template source.
- `ProjectLinter.lintFile(filePath, content?)` performs file-oriented analysis
  and can return findings for related components.
- `ProjectLinter.lintFiles(filePaths)` performs project analysis and dependency
  discovery when cross-component analysis is enabled.
- `ProjectLinter.buildSemanticGraph(filePaths)` and
  `ProjectLinter.buildPageModel(filePaths)` expose the shared graph and
  page/document contracts without moving semantic analysis into adapters.
- All three return the compatibility `LintResult` model. Consumers that need a
  stable interchange shape adapt those results to `ZemDomuDiagnostic` at their
  presentation boundary.

New public capabilities must be exported from `src/index.ts` and tested through
that root surface. Consumers must not import `zemdomu/*`, `zemdomu/out/*`, Core
source files, or a sibling checkout's build output. Relative imports within the
Core package, including the bundled CLI, are implementation details and do not
create additional public entry points.

### Compatibility and deprecation

- The 1.x line keeps `lint`, `ProjectLinter`, and `LintResult` compatible.
  `ZemDomuDiagnostic` remains an additive adapter contract rather than a silent
  replacement for integration-facing return values.
- The wildcard `./*` package export remains temporarily available so existing
  consumers are not broken in a minor release. It is deprecated now and carries
  no stability guarantee.
- Removing wildcard subpaths requires a major release, a release-note migration
  notice, and evidence that maintained integrations use only the root export.
- Internal modules can move without deprecation. A symbol exported from the
  package root follows normal semantic-versioning expectations.

## Ownership map

| Concern | Core library | Core CLI | VS Code extension | GitHub Action |
| --- | --- | --- | --- | --- |
| Analysis | Owns parsing, built-in rules, inline controls, file orchestration, dependency discovery, component resolution, and cross-component suppression. | Selects files and invokes `ProjectLinter`; it must not implement rules. | Selects editor/workspace inputs and invokes root `ProjectLinter`; editor-only scheduling and caching stay local. | Selects workflow files and invokes root `ProjectLinter`; workflow policy stays local. |
| Configuration | Owns option types, rule merging, engine defaults, and analysis invariants. | Maps flags such as `--cross`, depth, custom rules, and performance options to Core options. | Maps VS Code settings to Core options. Extension default severities are product policy and must be explicit when they differ from Core. | Maps action inputs and CI policy to Core options. Action default severities are product policy and must be explicit when they differ from Core. |
| Diagnostics | Owns `LintResult`, rule codes, `ZemDomuDiagnostic` schema 1.0, the adapter, and semantic context. | Consumes Core diagnostics; it must not define another issue type. | Maps canonical fields to `vscode.Diagnostic` and related information. | Maps canonical fields to GitHub annotations and failure state. |
| Formatting | Owns reusable interchange serializers such as canonical JSON and SARIF. | Owns terminal presentation and exit codes. | Owns editor ranges, documentation links, quick fixes, and diagnostic lifecycle UI. | Owns annotation presentation, summaries, and workflow failure behavior. |

Configuration policy is allowed to differ by product surface. Semantic meaning,
rule identity, source locations, related context, and suppression behavior are
not: those belong to Core.

## Audit findings

1. The VS Code extension imports `ProjectLinter`, `ProjectLinterOptions`,
   `LintResult`, and `lint` from `zemdomu`, which follows the intended boundary.
2. The extension duplicates inline-disable comment parsing and applies it after
   `ProjectLinter`, even though Core owns and already applies the directives. It
   also duplicates the rule-name and documentation-link registries. These are
   drift risks, not alternative semantic contracts, and should be removed as
   part of its canonical diagnostic migration.
3. The GitHub Action normally imports `ProjectLinter` from `zemdomu`, but its
   development fallback requires `../../ZemDomu-Core/out`. That fallback bypasses
   the package boundary and should be replaced with a root-package development
   linkage. Its handwritten `src/types/zemdomu.d.ts` shadows the real package
   types through `typeRoots` with an `any`-based `ProjectLinter` contract. That
   declaration, the default rule registry, and the documentation registry can
   all drift from Core.
4. The CLI uses private relative imports, but it ships inside Core and delegates
   analysis to `ProjectLinter`; this is an acceptable adapter boundary. Its
   current line formatter is CLI-owned presentation over `LintResult`.
5. No maintained integration source imports a `zemdomu/*` subpath. The wildcard
   export is therefore a compatibility liability rather than a required design.

## Alternatives considered

### Stable subpath APIs

Exports such as `zemdomu/analysis` and `zemdomu/diagnostics` would make ownership
visually explicit. They would also multiply versioned surfaces before the graph
and page contracts settle, so this option is deferred.

### A new universal `analyze()` facade

A discriminated file/project facade could present one function name. It would
duplicate working APIs and require a migration without reducing the underlying
scope differences. The package root is the useful single boundary; `lint` and
`ProjectLinter` remain the clearer operations within it.

## Consequences and integration sequence

The decision avoids a breaking release and lets each surface migrate
independently. For now, adapters still consume `LintResult`, and duplicated
registries remain until their owning cards remove them. Boundary enforcement is
primarily documentary until wildcard exports can be removed in a major release.

Follow-up work:

- [ZD-15 — Render canonical diagnostics without a parallel issue model](https://trello.com/c/Jq1r9Yz3): migrate CLI rendering while preserving terminal and exit-code ownership.
- [ZD-16 — Map canonical diagnostics to VS Code](https://trello.com/c/a3PDqzUx): move the extension to the canonical contract and remove duplicate suppression and registry logic.
- [ZD-17 — Map canonical diagnostics to GitHub annotations](https://trello.com/c/vTpGO99i): move the Action to the canonical contract and eliminate the sibling `out` fallback and shadowing handwritten package types.
- [ZD-18 — Publish the diagnostic schema and integration examples](https://trello.com/c/Gpad36et): document the contract for Hub users without creating another runtime model.
