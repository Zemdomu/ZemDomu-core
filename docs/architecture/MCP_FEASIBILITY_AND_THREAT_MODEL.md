# ZD-14: Read-only MCP feasibility and threat model

Status: completed spike; conditional go for a local proof of concept, no-go for
a shipped or remotely hosted MCP service.

Research snapshot: 2026-09-02, against MCP protocol revision `2026-07-28`.

## Question

Can ZemDomu expose useful semantic analysis to coding agents through MCP without
creating a second analysis model or an unsafe filesystem and execution boundary?

The answer is yes for a deliberately small local read-only proof of concept.
The current repository is not yet ready to publish or operate that server.

## Evidence already available in Core

The public `zemdomu` package-root API already owns the required analysis:

- `ProjectLinter.buildSemanticGraph()` returns schema `1.0` source-backed graph
  data with explicit unknowns.
- `ProjectLinter.buildPageModel()` and `composeSemanticPageModel()` return schema
  `1.0` page components and ordered facts.
- `ProjectLinter.lintPageDiagnostics()` returns canonical diagnostic schema
  `1.0`, including page and component-path context when certain.
- ZD-13 provides a deterministic human inspection interface without changing
  the structured API.

An MCP adapter therefore must select inputs, enforce access and resource limits,
and present existing contracts. It must not parse source, resolve components,
run rules, or generate competing explanations.

## Protocol findings

The current MCP revision is stateless at the protocol layer. State that spans
requests must use explicit handles rather than connection-local assumptions.
Tool input and output schemas support JSON Schema 2020-12, and structured output
may be any conforming JSON value. Roots are deprecated for new implementations;
the specification recommends tool parameters, resource URIs, or server
configuration instead.

Sources:

- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

This decision does not treat tool annotations as enforcement. The MCP
specification says clients must consider annotations untrusted unless the
server is trusted. ZemDomu must enforce read-only behavior and workspace bounds
inside the adapter.

## Options

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Parameterized read-only tools | Explicit queries, strict schemas, bounded output, direct mapping to Core methods | Model-controlled calls require hard input and resource validation | Chosen for a local proof of concept |
| Resources such as `zemdomu://page/...` | Natural read/cache semantics | URI discovery can enumerate paths; route and entry parameters become awkward; invalidation remains unresolved | Revisit only after caching requirements exist |
| Shell bridge to `zemdomu graph` or `inspect` | Very small wrapper | Model-supplied shell arguments create an unnecessary injection boundary and require parsing human output | Rejected |
| Remote HTTP service | Central deployment and cross-device access | Adds authentication, authorization, tenant isolation, rate limiting, SSRF, audit, privacy, and operations work | No-go |

## Smallest useful surface

The transport-neutral prototype in `spikes/zd-14-readonly-mcp.ts` exercises two
candidate handlers directly against public Core APIs:

1. `get_page_semantics`
   - input: `route`, workspace-relative `entryFile`, optional `maxItems`;
   - output: schema versions, relative file paths, component paths, bounded
     semantic facts, explicit unknowns, and a truncation flag.
2. `find_semantic_issues`
   - input: `route`, workspace-relative `entryFile`, optional
     `maxDiagnostics`;
   - output: bounded canonical diagnostics with all source locations rebased to
     workspace-relative paths and a truncation flag.

Do not add `get_component_path` yet. `get_page_semantics` already returns each
component path. Do not add `explain_semantic_issue` yet. Canonical diagnostics
already contain rule identity, evidence, confidence, related locations, and
conservative suggestions; a separate explanation implementation would risk
semantic drift. If a future tool is needed, it should retrieve published rule
documentation by stable rule code rather than invent new conclusions.

The prototype intentionally contains no MCP SDK, transport, cache, network
access, source-writing capability, or shell execution. Its tests prove the Core
mapping and boundary assumptions; they do not claim production server safety.

## Threat model

Protected assets include repository source and path names, uncommitted work,
diagnostics, developer machine resources, and any adjacent filesystem content.
Untrusted actors and inputs include the MCP client/model, repository-controlled
file names and semantic text, symlinks, malformed tool arguments, and a
compromised local server package.

| Risk | Current spike control | Required before a local server ships |
| --- | --- | --- |
| Path traversal or absolute-path disclosure | Canonical configured root; relative entry only; `realpath` containment checks; returned locations are relative | Repeat containment after discovery and before every read; reject symlink escapes and root changes; add Windows and POSIX tests |
| Transitive import escape | Prototype validates every graph file after analysis | Core or adapter must enforce the root before reading each dependency, not only detect an escape afterward |
| Prompt injection in repository content | No prompts or source bodies; output is typed data | Treat every component name, route, diagnostic message, and source-derived string as untrusted display/data; never concatenate it into tool instructions |
| Local server compromise | No installable server is produced | Use direct `stdio`, a pinned reviewed package, least privilege, and explicit installation consent; do not expose an unauthenticated localhost HTTP listener |
| Shell or arbitrary-code execution | No shell, dynamic module loading, or write tool | Preserve this invariant; custom rule loading is out of scope for MCP |
| Output flooding and token cost | Files, components, facts, unknowns, and diagnostics default to 50 and cap at 200; no source bodies or full raw graph response | Add byte-size ceilings, pagination or explicit continuation, counts, and cancellation; measure representative token sizes |
| CPU/memory denial of service | Narrow entry-based analysis | Add file-count, byte-count, depth, wall-clock, and concurrency budgets; surface truncation/timeout as explicit unknown state |
| Stale analysis | Prototype creates a new linter per call and keeps no hidden session state | Snapshot content identity before analysis, detect changes before returning, and include a stable analysis fingerprint; never imply freshness from a connection |
| Schema drift | Adapter envelope `zd-mcp-spike/1` carries Core graph/page/diagnostic schema versions | Validate output schemas, document supported Core versions, and fail closed on unsupported major schemas |
| Cross-user or cross-workspace leakage | One explicitly configured root and no cache | Keep cache keys tenant/root scoped if caching is added; never key only by route or relative path |
| Remote authorization and SSRF | No remote transport or OAuth | A remote design requires a separate authorization and deployment review, audience-bound tokens, HTTPS, SSRF defenses, rate limits, and audit logs |

MCP roots are not an access-control substitute. Even older roots guidance
describes them as client-provided boundaries that servers must validate, and the
current revision deprecates them. A ZemDomu server must own a canonical root
policy regardless of what the client advertises.

## Latency, tokens, and freshness

Returning the complete semantic graph is not an acceptable default: its size
grows with files, rendered nodes, imports, and composition edges, while most
agent questions need one page or a bounded diagnostic list. The two-tool surface
therefore returns summaries, omits source bodies and internal IDs where names
suffice, caps repeated records, and reports truncation.

No universal latency target is accepted by this spike because representative
repository sizes and host budgets have not been measured. Before shipping, the
follow-up must record cold and warm wall time, peak memory, result bytes, and an
estimated token count across small, medium, and large React and Vue fixtures.
It must then set enforceable limits from evidence. A timeout must return an
explicit incomplete result or error, never a silently partial "complete" graph.

The first local proof should remain stateless and uncached. If measurements
later justify caching, the cache key must include the canonical root, entry,
configuration, Core/schema versions, and source-content fingerprint. File
changes during analysis must invalidate the result.

## Decision

Conditional go:

- Build one local, direct-`stdio`, read-only proof of concept with only
  `get_page_semantics` and `find_semantic_issues`.
- Keep it separate from the `zemdomu` runtime package until containment,
  resource-budget, schema, and representative performance gates pass.
- Reuse public Core methods and canonical diagnostics exclusively.

No-go:

- Do not publish a production MCP server now.
- Do not add remote HTTP, authentication, write tools, custom rules, shell
  execution, raw source retrieval, implicit workspace discovery, or an AI-based
  explanation layer in the first proof.
- Do not make MCP a Core, CLI, Extension, Action, Hub, or release prerequisite.

## Smallest follow-up

Create one future P3 card for a root-contained local proof of concept. It should
implement the two schemas using a current official TypeScript MCP SDK, direct
`stdio`, pre-read dependency containment, hard file/byte/depth/time/output
budgets, cancellation, schema validation, and representative performance/token
evidence. Completion should end in a second explicit ship/no-ship decision;
shipping, registry publication, remote transport, and additional tools remain
out of scope.
