# Node runtime and dependency boundary

Status: Accepted on 2026-09-14 (ZD-52)

## Decision

The next major release of `zemdomu` will declare Node.js `>=22.17.0` as its
minimum supported runtime. The 1.x line keeps its current compatibility and
dependency behavior; this decision does not change a published manifest.

Node 22.17 is the minimum because it is the first Node 22 release where the
native `fs.glob` and `fs.globSync` APIs are stable, and it includes glob-pattern
exclusions. Choosing that exact floor avoids basing the public contract on an
experimental API.

TypeScript remains a required runtime dependency. Core uses the TypeScript API
to read project configuration and parse local imports for project and
cross-component analysis. A missing TypeScript installation is therefore a
broken installation, not a mode in which analysis should silently become less
complete.

## Context

Core currently has no `engines` declaration, while its `glob` dependency
already requires Node 20 or Node 22 and later. Node 20 reached end of life on
2026-03-24. Repository validation runs on Node 22, and the bundled GitHub Action
runs on Node 24.

Raising the explicit floor still changes the public installation contract.
It must therefore land at a major-version boundary even though supported
development and adapter environments already meet the chosen minimum.

Moving TypeScript to an optional or peer dependency would not be a mechanical
manifest reduction. Core imports it when loading `ProjectLinter` and uses it
for `tsconfig.json` discovery and import traversal. Optionality would require a
lazy-loading and public failure-mode design that makes unavailable project
analysis explicit. Peer status would additionally transfer Core's parser
compatibility burden to consumers. Neither tradeoff is justified by current
evidence.

There is no supported graceful-degradation mode when TypeScript is missing.
Core must fail fast with an actionable broken-installation message that tells
the user to reinstall dependencies. The current eager root export does not
promise that `lint()` remains available from an installation missing required
runtime dependencies.

## Native glob follow-up

The 1.x line will retain `glob`. At the next major boundary, a separate change
will replace it with Node's native file-system globbing in Core and the Action
only after the parity gates below pass. If native globbing cannot preserve the
contract, `glob` will remain rather than silently changing supported inputs.
The migration must preserve the existing product contract rather than relying
on library defaults:

- brace expressions and multiple input patterns;
- commas inside braces and comma, whitespace, or newline separators elsewhere;
- Windows and POSIX input separators;
- exclusion of hidden files, `node_modules`, directories, and symlink
  traversal;
- normalized output separators, deterministic sorting, and duplicate
  suppression;
- invocation failures for CLI and Action discovery errors, while component
  resolution retains its bounded unresolved-import behavior.

The implementation should explicitly filter native `Dirent` results and
normalize returned paths. It must migrate all three current `glob` call sites:
Core CLI discovery, Core component-path resolution, and Action discovery. Their
failure boundaries must remain distinct so component-resolution failures stay
represented as bounded unresolved imports rather than failing an entire run.

## Implementation and verification boundary

The follow-up implementation should:

1. add `engines.node: ">=22.17.0"` at the next Core major release boundary;
2. migrate both discovery adapters and remove `glob` only after parity tests
   pass;
3. update manifests, lockfiles, package-trust policy, and the package-trust
   baseline in the same delivery;
4. test Node 22.17 and the latest supported LTS at implementation time on
   Windows and Ubuntu;
5. run Core and Action tests/builds, React and Vue Action fixtures, the Extension
   rule oracle, production and full audits, and package-trust checks.

No fallback may turn missing TypeScript or failed discovery into a successful
but incomplete result. Any future TypeScript-optional design requires a
separate reviewed compatibility decision with an explicit unavailable or
unknown analysis state.

Node 22 reaches end of life in April 2027. If the next Core major is prepared
near or after that date, the release review must choose the oldest still-
supported runtime instead—expected to be Node 24—rather than introducing an EOL
minimum.
