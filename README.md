# ZemDomu Core

> Static analysis for semantic HTML architecture across component-based applications.

ZemDomu is static analysis for semantic HTML architecture across component-based
applications. ZemDomu Core is the shared engine that powers the ZemDomu
ecosystem. It parses
HTML, JSX, TSX, and Vue templates and returns semantic issues that affect
structure, accessibility, and search visibility.

Most linters check syntax. ZemDomu checks meaning.

## What It Is

ZemDomu Core is a semantic-first linting engine for modern frontend codebases.
It helps developers catch issues like missing landmarks, confusing heading
structure, unlabeled controls, weak semantic relationships, and cross-component
composition problems before those issues become late-stage audit findings.

This package provides the shared logic used by:

- the ZemDomu CLI
- the ZemDomu VS Code Extension
- the ZemDomu GitHub Action

## Why ZemDomu

Compared with generic linters and scanner-only workflows, ZemDomu is designed
to keep semantic analysis practical in real component codebases.

- Cross-component analysis catches issues that only appear when components are composed.
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

## Installation

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
Patterns may be separated by spaces, commas, or newlines.

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
