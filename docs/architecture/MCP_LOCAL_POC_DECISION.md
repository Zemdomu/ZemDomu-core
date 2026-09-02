# ZD-34: Local read-only MCP proof decision

Status: completed proof; **no-ship**.

Evidence date: 2026-09-02. Protocol revision: MCP `2026-07-28`.
Official SDK: `@modelcontextprotocol/server` 2.0.0.

## Decision

Keep the proof private and unpublished. Do not add it to the `zemdomu`
package, an MCP registry, a remote service, or a default editor configuration.

The proof validates the architectural direction: a two-tool local stdio
adapter can reuse public Core APIs without a second semantic engine, and a
canonical temporary snapshot can put a pre-read root boundary in front of
Core's dependency traversal. It does not yet establish a production-grade
filesystem or product boundary.

## Implemented proof

- Exactly `get_page_semantics` and `find_semantic_issues`, registered with
  strict Zod input/output schemas and read-only annotations.
- Modern direct stdio through `serveStdio(factory)`; legacy and remote
  transports are rejected or absent.
- Canonical root and entry checks plus pre-read realpath containment for every
  discovered relative dependency.
- An isolated OS-temporary snapshot; Core analyzes only the snapshot and all
  returned paths are workspace-relative.
- Fixed file, aggregate-byte, depth, wall-time, structured-output,
  concurrency, and worker-heap budgets.
- Cancellation and timeout terminate the worker instead of leaving analysis
  running in the server process.
- Explicit `complete`, `incompleteReasons`, per-collection truncation, content
  fingerprint, adapter version, and Core graph/page/diagnostic schema versions.
- No source bodies, shell, network, workspace writes, custom rules, HTTP,
  authentication, or extra tools.

## Verification

Nine tests passed on Windows, including:

- a real MCP 2026-07-28 stdio client listing and invoking the two-tool surface;
- transitive directory-symlink escape rejection before dependency read;
- Windows and POSIX path-policy cases;
- strict schemas and workspace-relative outputs;
- file, depth, and output truncation signaling;
- hard timeout, client cancellation, and concurrency rejection.

The benchmark ran both tools cold and warm over generated 5-, 25-, and
75-file React and Vue component chains. All 24 runs completed inside the
configured budgets. Full data is in
`packages/ZemDomu-McpPoc/benchmarks/results-2026-09-02.json` in the private
monorepo.

| Fixture | Page semantics wall time | Issues wall time | Page output | Issues output |
| --- | ---: | ---: | ---: | ---: |
| React 5 | 0.82-0.83 s | 0.83-1.04 s | 2.5 KB / ~616 tokens | 1.5 KB / ~373 tokens |
| React 25 | 0.94-0.99 s | 1.02-1.04 s | 20.5 KB / ~5.1k tokens | 3.8 KB / ~946 tokens |
| React 75 | 1.14-1.16 s | 1.63-1.71 s | 138.9 KB / ~34.7k tokens | 9.5 KB / ~2.4k tokens |
| Vue 5 | 0.83-0.87 s | 0.78-0.83 s | 2.5 KB / ~616 tokens | 1.5 KB / ~373 tokens |
| Vue 25 | 0.88-0.89 s | 0.89-1.00 s | 20.5 KB / ~5.1k tokens | 3.8 KB / ~946 tokens |
| Vue 75 | 1.09-1.11 s | 1.45-1.53 s | 138.9 KB / ~34.7k tokens | 9.5 KB / ~2.4k tokens |

Sampled process RSS ranged from about 157 MB to 212 MB. This is phase-boundary
process sampling rather than a worker-specific high-water mark.

## Why no-ship

1. Only relative imports are snapshotted. Tsconfig aliases and other supported
   Core resolution modes need a safe adapter-owned resolver before the proof
   represents real repositories faithfully.
2. The Windows symlink integration passed, but the same integration still
   needs a hosted POSIX run. Unit-level POSIX path tests are not equivalent.
3. The realpath/open/realpath sequence detects ordinary symlink escapes and
   path changes, but a hostile same-user process can still create filesystem
   race conditions. A production boundary needs a platform-specific,
   handle-based design and security review.
4. Large page-semantics responses reached roughly 35k estimated tokens. The
   hard byte ceiling works, but pagination or a narrower query contract is
   needed before the tool is economical by default.
5. Worker startup dominates small analyses and no cache is justified yet.
6. Installation consent, version compatibility, observability, package
   provenance, user documentation, and an external security review are absent.

## Smallest next step

Do not create a shipping task yet. If product demand appears, first create a
bounded hardening spike for safe tsconfig-aware resolution, handle-based
Windows/POSIX containment, hosted cross-platform tests, and a paginated
page-semantics contract. Re-evaluate distribution only after those gates pass.
