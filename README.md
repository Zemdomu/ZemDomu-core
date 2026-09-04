# ZemDomu Core

> Semantic accessibility static analysis with supported component context.

ZemDomu is static analysis for semantic HTML and accessibility across supported
HTML, React, and Vue component structures. Its differentiated definition is
static analysis for semantic HTML architecture across component-based
applications. ZemDomu Core is the shared engine behind the ZemDomu CLI,
ZemDomu VS Code Extension, and ZemDomu GitHub Action.

Core analyzes supported HTML, JSX, TSX, and Vue source patterns. Project-aware
analysis can find named structural problems across statically resolvable React
and Vue imports. It does not model every runtime state or establish
accessibility or WCAG conformance.

## Quick start: scan your source

Run ZemDomu without a global install. The command exits with `1` when it finds
diagnostics, which makes the same check useful locally and in CI.

```bash
npx zemdomu check "src/**/*.{html,jsx,tsx,vue}" --format pretty
```

Pretty output points to the authoring source and includes a stable rule code:

```text
Card.tsx:3:5 ZMD004: <img> tag missing alt attribute
```

## What It Is

ZemDomu Core is the semantic accessibility static-analysis engine for modern
frontend codebases.
It helps developers catch issues like missing landmarks, confusing heading
structure, unlabeled controls, weak semantic relationships, and cross-component
composition problems before those issues become late-stage audit findings.

This package provides the shared logic used by:

- the ZemDomu CLI
- the ZemDomu VS Code Extension
- the ZemDomu GitHub Action

## Why ZemDomu

ZemDomu complements file-oriented source linters and rendered-DOM testing with
one focused source model across supported frontend syntax.

- Cross-component analysis finds supported structural issues that only appear
  when statically resolvable components are composed.
- One shared rules engine powers editor, CLI, and CI behavior consistently.
- Diagnostics focus on semantic HTML, accessible naming, and document structure.
- Custom-rule support lets teams extend checks without rebuilding a lint stack.

## Features

- Lint semantic issues in HTML, JSX, TSX, and Vue templates.
- Works in Node.js, CI, or any JS runtime.
- Extensible rule system with simple custom rules.
- Cross-component analysis for React/JSX and Vue projects.
- Command line interface with `--custom` and `--cross`.
- Configurable rule severity (`error`, `warning`, `off`).
- Performance diagnostics for profiling lint runs.
- Simple API: `lint(content, options)`.

## Library installation

```bash
npm install zemdomu
# or
yarn add zemdomu
```

## Usage

```ts
import { lint } from "zemdomu";

const html = "<img>";
const results = lint(html, { rules: { requireAltText: true } });

console.log(results);
// [
//   {
//     line: 0,
//     column: 0,
//     message: "<img> tag missing alt attribute",
//     rule: "requireAltText"
//   }
// ]
```

## How ZemDomu fits

ZemDomu is one layer in an accessibility testing strategy, not a conformance
claim or a replacement for rendered and manual testing.

- [axe-core](https://github.com/dequelabs/axe-core) tests rendered web UI;
  ZemDomu checks supported source and component relationships earlier. Use
  both layers.
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
  is established static JSX linting in ESLint; ZemDomu uses one engine across
  HTML, React, and Vue with supported cross-file relationships.
- [Nu Html Checker](https://github.com/validator/validator) checks HTML, CSS,
  and SVG documents for standards-related mistakes; ZemDomu focuses on named
  semantic accessibility rules in application source.

Comparison source matrix reviewed 2026-08-30; linked primary documentation
reverified 2026-09-04.

## API

`lint(content: string, options?: LinterOptions): LintResult[]`

### Supported package entry point

Import public APIs only from the package root, `zemdomu`. Use `lint()` for one
in-memory source and `ProjectLinter` for file or project analysis. Subpath
imports such as `zemdomu/linter` are deprecated compatibility paths and can be
removed in the next major release.

```ts
import { lint, ProjectLinter } from "zemdomu";

const inMemoryResults = lint(source, { filePath: "src/Card.tsx" });
const project = new ProjectLinter({ crossComponentAnalysis: true });
const projectResults = await project.lintFiles(["src/Card.tsx"]);
const semanticGraph = await project.buildSemanticGraph(["src/Card.tsx"]);
const pageModel = await project.buildPageModel(["src/AppLayout.tsx"]);
const pageDiagnostics = await project.lintPageDiagnostics(["src/AppLayout.tsx"]);
```

`buildSemanticGraph()` follows supported local React/JSX/TSX and Vue imports
and returns the public schema `1.0` graph. IDs and array order are deterministic
for the same project inputs. Source-backed files, components, imports,
composition usages, headings, navigation landmarks, list items, sections, and
static document IDs retain zero-based locations. Each component also exposes a
`semanticOutput`: a single unconditional native root is inferred with an
ordered component evidence path and the certain native source location.
Transitive wrappers can inherit that output, while conditional returns,
fragments, children/slots, multiple roots, unresolved imports, cycles,
configured depth limits, and unknown route identity remain explicit unknown or
boundary states.

`buildPageModel()` composes graph output into page-scoped component trees and
ordered heading, landmark, section, navigation, and document-ID facts. Supply
`pages: [{ route, entryFile }]` for certain route identity, or opt into
`createReactFileRouteAdapter()` / `createVueFileRouteAdapter()` for inferred
filesystem conventions. Custom adapters implement `SemanticRouteAdapter`, so
the graph and page model do not hard-code a router. With no applicable adapter,
entry roots and route identity remain explicit unknowns.

`lintPageDiagnostics()` returns canonical diagnostics and adds the affected
page, readable component path, composition-instance source locations, and a
preferred edit location when a page/path is statically resolved. The existing
`singleH1` rule remains an at-most-one rule. The page-only advisory
`requirePageH1` rule (ZMD022) checks for a missing page H1 only when explicitly
enabled with `rules: { requirePageH1: "warning" }`.
Conservative suggestion text is limited to structural rules with a supported
edit direction. Conditional output and unresolved imports, slots, runtime
composition, cycles, and depth boundaries suppress absence and collision claims
that are not statically certain. Use `formatZemDomuDiagnosticPretty()` to render
this optional context for terminal output.

### Parameters

- `content`: HTML, JSX, TSX, or Vue template string input.
- `options.rules`: severity settings for built-in rules.
- `options.customRules`: array of additional rules.
- `options.filePath`: optional source file path.
- `options.forceHtml`: treat input as HTML.
- `options.perf`: attach a `PerformanceRecorder` instance.

### Example `LinterOptions`

```ts
interface LinterOptions {
  rules?: Record<string, "error" | "warning" | "off">;
  customRules?: Rule[];
  filePath?: string;
  forceHtml?: boolean;
  perf?: PerformanceRecorder;
}
```

Example enabling rule severities:

```ts
const results = lint(html, {
  rules: { requireAltText: "warning", uniqueIds: "error" }
});
```

### Example `LintResult`

```ts
interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
}
```

### Canonical diagnostics

`LintResult` remains the compatibility shape returned by `lint()` and
`ProjectLinter`; its `code`, `severity`, and `filePath` fields can be absent for
legacy and custom-rule results. Integrations that need a stable machine-readable
contract should adapt results with `toZemDomuDiagnostic()` and serialize them
with `serializeZemDomuDiagnostics()`.

```ts
import {
  lint,
  serializeZemDomuDiagnostics,
  toZemDomuDiagnostic,
} from "zemdomu";

const results = lint(source, { filePath: "src/Card.tsx" });
const diagnostics = results.map((result) =>
  toZemDomuDiagnostic(result, { sourceFile: "src/Card.tsx" })
);
console.log(serializeZemDomuDiagnostics(diagnostics, 2));
```

Every `ZemDomuDiagnostic` has `schemaVersion`, `rule`, `code`, `severity`,
`message`, and a source file/line/column. Lines and columns are zero-based, as
they are in `LintResult`. Page identity, component path, related locations,
preferred edit location, suggestions, provenance, and confidence are optional.
Schema `1.0` uses the
rule name as the code fallback for parse errors or custom rules that do not
provide a registered or explicit code. Missing legacy severity defaults to
`error`; pass `defaultSeverity` when another canonical severity is appropriate.
When present, confidence is one of `certain`, `inferred`, or `unknown`.
The adapter requires `result.filePath` or `context.sourceFile` and throws if
neither is available. It does not mutate the legacy result.

## CLI Usage

Run the linter from the command line by installing the package globally or by
using `npx`. Provide one or more glob patterns to specify the files to lint.
Patterns may be separated by spaces, commas, or newlines; commas inside brace
expressions remain part of the pattern. Discovery accepts either path separator,
deduplicates and sorts matches, and excludes hidden files, `node_modules`,
directories, and symlink traversal.

```bash
npx zemdomu "src/**/*.{html,jsx,tsx,vue}" --custom my-rule.js
npx zemdomu "src/**/*.html,src/**/*.jsx"
```

Use `--custom` (or `-c`) to provide a path to a JavaScript or TypeScript module
exporting a custom rule or array of rules. For safety, the CLI only accepts
files inside a `./custom-rules` directory relative to your current working
directory. You can repeat `--custom` to load multiple rule files.

Use `--cross` to enable cross-component analysis.

Use `--perf` to emit a JSON timing report to stdout, and `--perf-slowest` to
also print the slowest file and phase.

### Output formats and exit codes

`zemdomu check` accepts the same file patterns as the existing command and can
write one of three equivalent views of the canonical diagnostic contract:

```bash
zemdomu check "src/**/*.{html,jsx,tsx,vue}" --format pretty
zemdomu check "src/**/*.{html,jsx,tsx,vue}" --format json
zemdomu check "src/**/*.{html,jsx,tsx,vue}" --format sarif
```

`pretty` is the default and writes readable diagnostics to stderr. `json` and
`sarif` write only their machine-readable JSON document to stdout; operational
and invocation errors always go to stderr. JSON contains a deterministic,
source-sorted array of schema `1.0` `ZemDomuDiagnostic` objects. SARIF uses
version `2.1.0`, maps canonical related locations to SARIF
`relatedLocations`, and stores page/component-path context in structured SARIF
properties rather than adding presentation text to the diagnostic message.

The CLI exits with `0` when no diagnostics are emitted, `1` when it emits one
or more diagnostics, and `2` for invalid CLI usage. `--perf` and
`--perf-slowest` are only available with `--format pretty` so machine output is
never mixed with timing output.

### Semantic graph and page inspection

Use `graph` to inspect the deterministic semantic graph for one or more entry
files. The command follows supported local React, JSX, TSX, and Vue imports and
groups source files, components, rendered semantic nodes, and explicit unknown
analysis boundaries in readable sections.

```bash
zemdomu graph "src/AppLayout.tsx"
zemdomu graph "src/pages/**/*.{tsx,vue}" --cross-depth 4
```

Use `inspect` to compose one route from an explicit entry file. Requiring the
route-to-entry mapping keeps router conventions outside Core and makes the
result reproducible:

```bash
zemdomu inspect "/products/[id]" --entry "src/AppLayout.tsx"
```

Page inspection prints the nested component path, ordered semantic facts,
source locations, and any unresolved or traversal-boundary unknowns. Both
inspection commands write human-readable output to stdout and exit with `2`
for invalid invocations or unmatched entry files. Machine-readable inspection
output is not part of this command contract; use the public
`ProjectLinter.buildSemanticGraph()` and `buildPageModel()` APIs when structured
data is required.

## Cross-Component Analysis

When analyzing JSX or Vue projects you can track semantic issues across
component boundaries. Instantiate `ProjectLinter` with the
`crossComponentAnalysis` option or pass `--cross` to the CLI. Use
`crossComponentDepth` or `--cross-depth` to limit how deep component trees are
traversed during analysis.

```ts
import { ProjectLinter } from "zemdomu";

const linter = new ProjectLinter({
  crossComponentAnalysis: true,
  crossComponentDepth: 2,
});

await linter.lintFile("App.jsx");
```

```bash
npx zemdomu "src/**/*.{jsx,tsx,vue}" --cross --cross-depth 2
```

## Performance Diagnostics

Attach a `PerformanceDiagnostics` recorder to gather timing information for each
file and rule.

```ts
import { lint, PerformanceDiagnostics } from "zemdomu";

const perf = new PerformanceDiagnostics();
lint(code, { perf });
console.log(perf.getAsJSON());
```

## Writing Custom Rules

Custom rules are simple objects implementing the `Rule` interface. At minimum,
provide a `name`, a `test` function that returns `true` when a node violates
the rule, and a `message` describing the problem.

```ts
interface Rule {
  name: string;
  test(node: any): boolean;
  message: string;
}
```

```js
// my-rule.js
module.exports = {
  name: "noFooDiv",
  test: node => node.type === "element" && node.tagName === "foo",
  message: "<foo> is not allowed"
};
```

Use it programmatically:

```ts
import { lint } from "zemdomu";

const results = lint("<foo></foo>", { customRules: [require("./my-rule")] });
```

### Helper Utilities

For more advanced rules you may need direct access to the parsed HTML or JSX
AST. ZemDomu exposes helpers for traversal and attribute inspection:

```ts
import {
  parseHtml,
  visitHtml,
  getAttr,
  getJsxAttr,
  getJsxAttribute,
  getJsxAttributeState,
  getJsxExpressionState,
  getTag,
  isJsxExpressionPossiblyEmpty,
  ElementNode,
  HtmlVisitor,
} from "zemdomu";
```

Or via the CLI:

```bash
mkdir -p custom-rules
cp my-rule.js custom-rules/my-rule.js
npx zemdomu file.html --custom custom-rules/my-rule.js
npx zemdomu "src/**/*.{html,jsx,tsx,vue}" --perf --perf-slowest
```

There is a sample rule in `custom-rules/example-rule.js` that you can copy and
edit.

## Local Development

From the core package:

```bash
cd packages/ZemDomu-Core
npm install
npm run build
```

## Links

- npm package: https://www.npmjs.com/package/zemdomu
- Website: https://zemdomu.dev/
- Issues and suggestions: https://github.com/ZemDomu/ZemDomu-core/issues
- VS Code extension: https://marketplace.visualstudio.com/items?itemName=ZachariasErydBerlin.zemdomu
- GitHub Action: https://github.com/ZemDomu/ZemDomu-action

## License

MIT (c) 2025 Zacharias Eryd Berlin
