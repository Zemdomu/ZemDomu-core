# ZemDomu — Semantic Architecture & AI Integration Direction

Current implementation status is tracked in
[`CURRENT_CAPABILITY_BASELINE.md`](./CURRENT_CAPABILITY_BASELINE.md). The
direction below describes the target architecture; follow-up work should extend
the shipped baseline rather than assume a greenfield implementation.

Cross-package category, audience, comparison, claim, commercial, and launch
decisions are governed by
[`POSITIONING_AND_GO_TO_MARKET.md`](../../../../POSITIONING_AND_GO_TO_MARKET.md).
This document governs the technical direction.

## 1. Purpose

The canonical product positioning is:

> **ZemDomu is static analysis for semantic HTML architecture across component-based applications.**

ZemDomu is a semantic HTML analysis ecosystem built around a shared npm package.

The npm package contains the core analysis engine and rule logic. Other ZemDomu integrations, including the VS Code extension and GitHub Action, consume that same package.

ZemDomu should continue supporting and expanding its existing accessibility, semantic HTML, SEO, document-structure, and ARIA rules.

The strategic direction is **not** to replace the current rule engine.

Instead, ZemDomu should increasingly differentiate itself through:

> **Static analysis of semantic HTML architecture across an entire component-based application.**

The existing rule engine becomes more powerful as ZemDomu gains more knowledge about how components compose into pages.

---

# 2. Product Positioning

Use `ZemDomu` for the ecosystem and preserve that casing in prose, metadata,
package descriptions, commands, and UI copy. The four public product names are:

- **ZemDomu Core** — the `zemdomu` npm package and shared analysis engine
- **ZemDomu CLI** — the command-line interface shipped by ZemDomu Core
- **ZemDomu VS Code Extension** — the editor integration
- **ZemDomu GitHub Action** — the CI integration

The repository package name `ZemDomu Hub` describes the website codebase, not a
separate public product.

ZemDomu should not primarily position itself as an alternative to `eslint-plugin-jsx-a11y` or axe.

Those tools already solve important accessibility problems.

ZemDomu should instead emphasize a different capability:

> **ZemDomu traces HTML semantics across components to detect structural problems that file-level analysis can miss.**

Short positioning may omit the audience when space is constrained:

> **Static analysis for semantic HTML architecture.**

Comparisons with other tools must be fair and testable:

- Name another tool only when the compared capability can be verified.
- Explain complementary roles where tools operate at different stages; ZemDomu
  does not replace runtime accessibility testing or manual review.
- Scope claims to the frameworks, rules, and project context ZemDomu actually
  supports.
- Do not imply WCAG conformance or claim general superiority from a narrow
  fixture, benchmark, or feature comparison.
- Prefer concrete capability language over unsupported effectiveness claims.

The existing accessibility, SEO, semantic HTML, ARIA, and structural rules remain an important part of the product.

The difference is that these rules can increasingly operate with **project-level semantic context**.

---

# 3. Core Architecture

The npm package should remain the single source of truth for ZemDomu's analysis.

```text
                 ZEMDOMU

        ┌─────────────────────────┐
        │     npm: zemdomu        │
        │                         │
        │ Core analysis engine    │
        │ Rule engine             │
        │ Component analysis      │
        │ Semantic graph          │
        │ Diagnostics             │
        └────────────┬────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       CLI        VS Code     GitHub
                  Extension    Action
```

The VS Code extension and GitHub Action should **not implement their own semantic analysis logic**.

They should consume the npm package and present its results in different environments.

This keeps:

- Rule behavior consistent
- Diagnostics consistent
- Configuration consistent
- New functionality immediately reusable across integrations
- Maintenance centralized

---

# 4. Existing Rule Engine

The existing ZemDomu rule system should remain a core feature.

Rules covering areas such as:

- Semantic HTML
- Heading structure
- Landmarks
- Accessibility
- ARIA
- Navigation
- Forms and controls
- Media
- SEO
- Document integrity

should continue to be maintained and expanded.

The strategic change is not:

```text
Rules → Semantic Architecture
```

It is:

```text
Rules
+
Semantic Architecture
=
More powerful rules
```

---

# 5. Why Project-Level Context Matters

Traditional file-level analysis sees components individually.

Example:

```tsx
// Header.tsx

export function Header() {
  return <h1>Store</h1>;
}
```

```tsx
// ProductPage.tsx

export function ProductPage() {
  return <h1>PlayStation 6</h1>;
}
```

Each file independently contains one `<h1>`.

File-level analysis may therefore consider both valid.

But the composed application may produce:

```text
AppLayout
├── Header
│   └── h1 "Store"
└── ProductPage
    └── h1 "PlayStation 6"
```

ZemDomu can then report:

```text
ZMD003 Multiple page-level H1 elements

Page:
/products/[id]

Sources:
Header.tsx:8
ProductPage.tsx:5

Component path:
AppLayout
├── Header
└── ProductPage
```

The existing rule becomes more useful because ZemDomu understands the resulting document.

---

# 6. Semantic Component Graph

A major technical direction should be building a semantic representation of the component tree.

Example:

```text
AppLayout
├── Header
│   └── <header>
├── Navigation
│   └── <nav>
└── ProductPage
    ├── ProductTitle
    │   └── <h1>
    └── ProductContent
        └── <section>
```

ZemDomu should attempt to determine what semantic HTML custom components eventually represent.

For example:

```text
Header          → <header>
Navigation      → <nav>
PrimaryContent  → <main>
CardTitle       → <h2>
Button           → <button>
```

This representation can be called the **semantic component graph**.

It should become one of ZemDomu's primary technical assets.

The first public domain contract for that asset is schema `1.0`, documented in
[`SEMANTIC_GRAPH_DOMAIN_MODEL.md`](./SEMANTIC_GRAPH_DOMAIN_MODEL.md). It models
files, components, native rendered elements, fragments, imports, ordered
composition, rendered semantic facts, page roots, and source provenance. It
also keeps unresolved imports, conditionals, cycles, depth limits, and other
unknowns explicit so future page analysis does not turn missing evidence into a
confident semantic claim. `ProjectLinter.buildSemanticGraph()` now adapts the
current React and Vue analyzer/resolver output into that contract without
changing existing lint traversal or diagnostics.

Component nodes now expose conservative semantic output inference. A single
unconditional native render root, or a resolved chain of single-root wrappers,
produces an `inferred` tag with an evidence path terminating at `certain`
source provenance. Component names alone are never evidence. Conditional and
logical branches, fragments, multiple roots, children/slots, unresolved
wrappers, and cycles remain explicit unknowns.

`ProjectLinter.buildPageModel()` now provides the next pipeline layer without
embedding a router in the graph. Explicit `{ route, entryFile }` configuration
produces certain page identity; opt-in React and Vue filesystem adapters produce
inferred identity; custom route adapters can represent other frameworks. The
page model composes nested components and ordered heading, landmark, section,
navigation, and document-ID facts while retaining branch conditions, component
paths, and native source provenance. Unsupported routing stays unknown.

---

# 7. Target Analysis Pipeline

The long-term architecture should move toward:

```text
Project
   ↓
AST / source analysis
   ↓
Import + component graph
   ↓
Semantic component graph
   ↓
Page / document model
   ↓
Rule engine
   ↓
Diagnostics
```

The rule engine remains central.

The major change is that rules gain access to a richer representation of the application.

---

# 8. Page-Level Semantic Analysis

ZemDomu should increasingly reason about composed pages rather than only isolated files.

Example:

```text
ZEMDOMU
Page: /products/[id]

<header>
<nav>
<div>
  <h1>
  <div>
    <h2>
<footer>

⚠ Primary content region has no semantic container.

Suggestion:
Consider <main> for the primary page content.

Source:
AppLayout.tsx
→ ProductPage.tsx
→ ProductContent.tsx
```

This should become one of the clearest demonstrations of why ZemDomu exists.

---

# 9. Cross-Component Rules

Existing and future rules should benefit from semantic project context.

Examples include:

```text
missing-main
multiple-main
missing-h1
duplicate-page-h1
heading-order
landmark-structure
unique-ids
section-heading
```

For example, heading-order analysis should understand:

```text
Page
├── ProductHeader
│   └── h1
└── Reviews
    └── ReviewSection
        └── h3
```

and determine that the problem exists across component boundaries.

Likewise, `uniqueIds` could eventually identify collisions such as:

```tsx
<Search />
<MobileSearch />
```

where both components produce:

```html
<input id="search">
```

The files are individually valid.

The composed page is not.

---

# 10. Future Rule Development

ZemDomu should continue adding rules.

However, rule development should increasingly favor rules where ZemDomu's project-level knowledge provides additional value.

Good future rule candidates have one or more of these characteristics:

- Require understanding multiple components
- Depend on document hierarchy
- Depend on page composition
- Depend on relationships between components
- Depend on semantic context
- Become significantly more accurate with project knowledge

This does **not** mean ordinary accessibility or semantic rules should stop being developed.

They remain useful.

The goal is simply to make ZemDomu's unique capabilities increasingly visible within the rule ecosystem.

---

# 11. Component-Path Diagnostics

Diagnostics should increasingly explain **how the resulting structure was produced**.

Example:

```text
ZEMDOMU ZD104

Page: /products/[id]

AppLayout.tsx
└── ProductPage.tsx
    ├── ProductHeader.tsx → <h1>
    └── ProductDetails.tsx
        └── <section>

⚠ Primary page content has no <main> landmark.

Suggested location:
ProductPage.tsx:4

Component path:
AppLayout → ProductPage → ProductDetails

Suggestion:
Wrap the primary page content in <main>.
```

This is particularly valuable for cross-component issues because the source of the problem may not exist in a single file.

---

# 12. Semantic Suggestions

Where confidence is sufficiently high, ZemDomu should provide suggestions alongside diagnostics.

Example:

```text
Content region has no semantic container.

Suggestion:
Consider <main> for the primary page content.
```

Another example:

```text
<section> does not contain a heading.

Suggestion:
Add a heading describing the section, or use <div>
if this content does not represent a standalone section.
```

Suggestions should be conservative.

ZemDomu should avoid pretending it understands developer intent when evidence is insufficient.

---

# 13. npm Package

The `zemdomu` npm package is the core product.

It should contain:

- Parser / source analysis
- AST analysis
- Component resolution
- Import tracing
- Semantic inference
- Semantic component graph
- Page/document analysis
- Rule execution
- Configuration
- Diagnostic generation
- Machine-readable results

The package should expose these capabilities to both the CLI and external consumers.

Conceptually:

```text
zemdomu npm package
        │
        ├── CLI
        │
        ├── VS Code extension
        │
        ├── GitHub Action
        │
        └── Future integrations
```

This makes future functionality reusable automatically.

For example, once the npm package understands component paths, both the VS Code extension and GitHub Action can display them without independently reimplementing the analysis.

---

# 14. CLI

The CLI should remain the simplest direct interface to the npm engine.

Example:

```bash
zemdomu check
```

Potential usage:

```bash
zemdomu check src/
zemdomu check --format pretty
zemdomu check --format json
zemdomu check --format sarif
```

Human-readable output might contain:

```text
ZMD003 Multiple page-level H1 elements

Page:
/products/[id]

AppLayout
├── Header
│   └── h1
└── ProductPage
    └── h1

ProductPage.tsx:17
```

The CLI should expose the same results that other integrations consume.

---

# 15. VS Code Extension

The VS Code extension should remain a presentation and developer-experience layer around the npm engine.

Current responsibilities can continue to include:

- Inline diagnostics
- Problems panel integration
- Workspace scanning
- Quick fixes
- Configuration

Project-aware ZemDomu diagnostics could enhance these features.

Instead of:

```text
⚠ Multiple <h1> elements
```

the extension could eventually display:

```text
ZMD003 Multiple page-level H1 elements

This heading conflicts with another heading rendered by:

AppLayout
→ SiteHeader

Affected page:
/products/[id]
```

Hover information could eventually expose semantic context:

```text
Semantic context

AppLayout
├── header
├── nav
└── ProductPage
    ├── h1 ← current element
    └── main
```

These are presentation features.

The semantic analysis should still originate from the npm package.

---

# 16. GitHub Action

The GitHub Action should likewise consume the npm package.

Its role is to run ZemDomu analysis in CI and expose the resulting diagnostics during pull requests.

Example:

```text
ZMD002 Heading hierarchy violation

Page:
/settings/profile

Component path:
SettingsLayout
→ ProfilePage
→ SecuritySettings

Found:
<h4>

Expected:
<h2>

SecuritySettings.tsx:31
```

This becomes particularly valuable in repositories using coding agents.

An agent can:

```text
Modify code
    ↓
Open PR
    ↓
GitHub Action runs ZemDomu
    ↓
ZemDomu detects semantic architecture problem
    ↓
PR receives diagnostic
    ↓
Agent fixes diagnostic
```

No dedicated AI integration is required for this workflow.

---

# 17. AI / Coding-Agent Direction

AI should be considered an important use case for ZemDomu.

Coding agents are generally strong at fixing clearly defined failures.

They are less reliable at independently discovering structural issues distributed across many files.

For example:

```tsx
function ProductPage() {
  return (
    <div>
      <ProductHeader />
      <ProductDetails />
    </div>
  );
}
```

The code can:

```text
✓ Compile
✓ Pass TypeScript
✓ Pass tests
✓ Pass ordinary linting
```

while still producing poor document architecture.

ZemDomu can transform that implicit problem into an explicit diagnostic:

```text
⚠ Primary page content has no <main> landmark.

Page:
/products/[id]

Component path:
AppLayout
→ ProductPage
→ ProductDetails

Suggested location:
ProductPage.tsx
```

The agent no longer needs to discover the semantic problem itself.

It only needs to respond to a deterministic diagnostic.

It a lot of focus should be aimed towards making the agent less token-driven by having an easier access to the direct issues of the project.

---

# 18. Core AI Thesis

ZemDomu should not attempt to compete with coding agents.

It should provide infrastructure that makes their output more reliable.

The central idea is:

> **AI is good at fixing explicit errors. ZemDomu makes semantic architecture errors explicit.**

The workflow becomes:

```text
LLM generates code
        ↓
ZemDomu analyzes the resulting application
        ↓
ZemDomu produces deterministic semantic diagnostics
        ↓
LLM fixes those diagnostics
```

---

# 19. Machine-Readable Diagnostics

Machine-readable output should become an important part of ZemDomu's architecture.

Example:

```bash
zemdomu check --format json
```

Possible result:

```json
{
  "rule": "missing-main",
  "severity": "warning",
  "page": "/products/[id]",
  "source": "ProductPage.tsx",
  "line": 4,
  "componentPath": [
    "AppLayout",
    "ProductPage",
    "ProductDetails"
  ],
  "message": "Primary page content has no <main> landmark.",
  "suggestion": {
    "action": "wrap",
    "element": "main",
    "target": "ProductPage"
  }
}
```

Possible formats:

```text
pretty
json
sarif
```

`pretty` is optimized for developers.

`json` is optimized for programmatic consumers and coding agents.

`SARIF` can improve integration with code scanning and CI tooling.

---

# 20. Stable Diagnostic Model

Internally, ZemDomu should ideally converge on one diagnostic structure used by every integration.

Conceptually:

```ts
interface ZemDomuDiagnostic {
  schemaVersion: "1.0";
  rule: string;
  code: string;
  severity: "error" | "warning" | "info";

  message: string;

  source: {
    file: string;
    line: number;
    column: number;
    offset?: number;
  };

  page?: string;

  componentPath?: string[];

  relatedLocations?: Array<{
    source: {
      file: string;
      line: number;
      column: number;
      offset?: number;
    };
    message?: string;
  }>;

  suggestion?: {
    message: string;
    replacement?: string;
  };

  provenance?: {
    kind: "source" | "cross-component" | "inference";
    analyzer?: string;
    description?: string;
  };

  confidence?: "certain" | "inferred" | "unknown";
}
```

This contract is shipped as schema `1.0`. Source lines and columns are
zero-based. The existing `LintResult` return type remains available for
compatibility; integrations can adapt it with `toZemDomuDiagnostic()` and emit
the canonical JSON representation with `serializeZemDomuDiagnostics()`.

Then:

```text
Core engine
   ↓
ZemDomuDiagnostic[]
   ├── CLI formatter
   ├── VS Code diagnostics
   ├── GitHub annotations
   ├── JSON
   ├── SARIF
   └── Future MCP integration
```

This avoids different integrations developing incompatible representations of the same issue.

---

# 21. Agent Instructions

ZemDomu documentation should include examples showing coding agents how to use the tool.

Example `AGENTS.md`:

```md
# Frontend quality requirements

After modifying components that affect page structure:

1. Run the test suite.
2. Run ESLint.
3. Run `zemdomu check`.
4. Resolve ZemDomu errors before completing the task.
```

This creates useful AI integration without requiring any AI-specific runtime functionality.

---

# 22. Future Semantic Inspection

Once the semantic graph is sufficiently mature, the CLI could expose additional inspection capabilities.

Examples:

```bash
zemdomu graph
```

or:

```bash
zemdomu inspect /products/[id]
```

Possible output:

```text
AppLayout
├── header
├── nav
└── ProductPage
    ├── h1
    └── main
        ├── section
        │   └── h2
        └── aside
```

This would be useful for:

- Developers
- Debugging rules
- CI
- Coding agents
- Future IDE tooling

It is not required for the initial semantic architecture direction.

---

# 23. Future MCP Integration

An MCP server could eventually expose ZemDomu's semantic model directly to coding agents.

Potential capabilities:

```text
get_page_semantics
find_semantic_issues
get_component_semantics
get_component_path
explain_semantic_issue
```

Example:

```text
get_page_semantics("/products/[id]")
```

Response:

```text
AppLayout
├── header
├── nav
└── ProductPage
    ├── h1
    └── main
        └── section
            └── h2
```

The architecture could then become:

```text
Coding Agent
     ↓
ZemDomu MCP
     ↓
zemdomu npm package
     ↓
Semantic graph
```

MCP should be considered a future integration rather than a requirement for the
initial semantic-architecture capability milestone.

The underlying npm APIs and machine-readable diagnostics provide most of the immediate foundation.

---

# 24. Semantic Architecture Capability Milestone

This is a capability milestone, not a package-version target. ZemDomu Core is
already on the `1.3.x` line; its next releases should deliver these capabilities
incrementally without resetting or relabeling package maturity.

The primary goal should be shipping a trustworthy, coherent product while making the unique direction clear.

Important milestone areas include:

### Core package

- Stable npm API
- Reliable rule execution
- Cross-component analysis
- Consistent diagnostics
- Configuration stability
- Low false-positive rates

### Ecosystem

- Working npm package
- Working CLI
- Working VS Code extension
- Working GitHub Action

All should use the same npm analysis engine.

### Positioning

Documentation should clearly explain:

- Why ZemDomu exists
- How it differs from axe
- How it differs from `jsx-a11y`
- Why cross-component analysis matters
- How project-level semantic analysis improves existing rules
- How ZemDomu can be used by coding agents

### Diagnostics

Where technically feasible, move toward:

- Component paths
- Page context
- Better explanations
- Machine-readable results

These capabilities can evolve incrementally after the milestone.

The **ZemDomu VS Code Extension 1.0** release remains a separate, valid product
milestone. Its readiness gates cover editor behavior, diagnostic accuracy,
quick fixes, Extension Host validation, documentation, and release operations;
they do not determine ZemDomu Core's version or the completion of this semantic
architecture milestone.

---

# 25. Development After the Capability Milestone

Development can proceed along two complementary axes.

```text
              ZEMDOMU

MORE PROJECT KNOWLEDGE       MORE RULE COVERAGE
──────────────────────       ──────────────────

Component graph              Accessibility
Semantic graph               Semantic HTML
Page structure               SEO
Route understanding          ARIA
Relationships                Document structure
Semantic inference           Forms
Component contracts          Navigation
AI-friendly diagnostics      Media
        │                         │
        └──────────┬──────────────┘
                   ↓
            Better analysis
```

Neither direction replaces the other.

The rule library gives the semantic graph practical applications.

The semantic graph makes the rule library significantly more differentiated.

---

# 26. Development Priorities

When choosing between features, prioritize:

1. Reliability of the existing analysis engine
2. Better project/component understanding
3. Rules that benefit from that additional context
4. Better diagnostics
5. Machine-readable integration
6. Additional rule coverage
7. Developer experience improvements
8. Specialized AI integrations

This avoids abandoning the existing product while still moving ZemDomu toward its strongest differentiator.

---

# 27. What Not to Do

The new direction should **not** mean:

```text
❌ Remove existing rules
❌ Stop developing accessibility rules
❌ Stop developing SEO rules
❌ Replace the rule engine
❌ Rewrite the VS Code extension
❌ Rewrite the GitHub Action
❌ Turn ZemDomu into an AI product
❌ Attempt to replace axe
```

Instead:

```text
✓ Keep the rule engine
✓ Expand the rules
✓ Improve the context rules receive
✓ Centralize intelligence inside the npm package
✓ Expose richer diagnostics to every integration
✓ Make project-level semantic analysis the differentiator
✓ Make ZemDomu useful to humans and coding agents
```

---

# 28. Core Technical Thesis

ZemDomu should evolve from being perceived as:

```text
Accessibility / SEO / semantic HTML linter
with cross-component support
```

toward:

```text
Semantic HTML static-analysis engine
that understands component-based applications
and applies accessibility, SEO and structural rules
with project-level context.
```

The core technical asset becomes:

> **The semantic component graph combined with the ZemDomu rule engine.**

The graph provides knowledge.

The rules turn that knowledge into useful diagnostics.

---

# 29. Ecosystem Thesis

The architecture should remain:

```text
                    zemdomu
                 npm package
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
         CLI       VS Code      GitHub
                   Extension     Action
```

Future integrations should follow the same pattern:

```text
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        JSON        SARIF        MCP
```

The npm package remains the source of truth.

Every improvement to ZemDomu's understanding of a project should therefore have the potential to improve the entire ecosystem.

---

# 30. Final Product Direction

ZemDomu should continue doing what it already does.

The pivot is primarily about **deepening and emphasizing the part of ZemDomu that is hardest for other tools to replicate**.

Existing:

> Rules for accessibility, semantic HTML, SEO, ARIA and document structure.

Differentiator:

> Understanding how those rules apply across an application's component architecture.

Future:

> Providing humans and coding agents with deterministic information about the semantic structure of the applications they build.

The goal is therefore not a new product.

It is a clearer and more ambitious evolution of the existing ZemDomu architecture.
