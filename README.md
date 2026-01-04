# ZemDomu

Semantic HTML linting engine for clean, accessible and SEO-friendly markup. This package provides the shared core logic used by the ZemDomu VS Code extension and upcoming GitHub Action.

## 🧠 What is ZemDomu?

**ZemDomu** is a semantic-first linter that helps developers write better HTML and JSX by catching accessibility and structural issues. It parses `.html`, `.jsx`, `.tsx`, and `.vue` files and exposes a simple `lint()` function that returns semantic violations.

## 🚀 Installation

```bash
npm install zemdomu
# or
yarn add zemdomu
```

## ✨ Features

- ✅ Lint semantic issues in HTML, JSX, TSX, and Vue templates
- 📦 Works in Node.js, CI or any JS runtime
- ⚙️ Extensible rule system with simple custom rules
- 🔀 Cross-component analysis for React/JSX and Vue projects
- 🚀 Command line interface with `--custom` and `--cross`
- ⚠️ Configurable rule severity (`error`, `warning`, `off`)
- 📈 Performance diagnostics for profiling lint runs
- 📚 Shared by the extension and GitHub Action
- 🧪 Simple API: `lint(content, options)`

## ⚙️ Usage Example

```ts
import { lint } from "zemdomu";

const html = "<img>";
const results = lint(html, { rules: { requireAltText: true } });

console.log(results);
// [
//   {
//     line: 0,
//     column: 0,
//     message: '<img> tag missing alt attribute',
//     rule: 'requireAltText'
//   }
// ]

// Custom rules can be supplied via the `customRules` option
// const myRule = { name: 'demo', test: node => false, message: 'demo' };
// lint(html, { customRules: [myRule] });
```

## 📖 API

`lint(content: string, options?: LinterOptions): LintResult[]`

**Parameters**

- `content` — HTML, JSX, TSX, or Vue template string input
- `options.rules` — severity settings for built-in rules
- `options.customRules` — array of additional rules
- `options.filePath` — optional source file path
- `options.perf` — attach a `PerformanceRecorder` instance

**Example `LinterOptions`**

```ts
interface LinterOptions {
  rules?: Record<string, 'error' | 'warning' | 'off'>;
  customRules?: Rule[];
  filePath?: string;
  forceHtml?: boolean;
  perf?: PerformanceRecorder;
}
```

Example enabling one rule as a warning:

```ts
const results = lint(html, {
  rules: { requireAltText: 'warning', uniqueIds: 'error' }
});
```

**Example `LintResult`**

```ts
interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
}
```

## 🛠 CLI Usage

Run the linter from the command line by installing the package globally or using
`npx`. Provide one or more glob patterns to specify the files to lint. Patterns
may be separated by spaces, commas or newlines:

```bash
npx zemdomu "src/**/*.{html,jsx,tsx,vue}" --custom my-rule.js
npx zemdomu "src/**/*.html,src/**/*.jsx"
```

Use `--custom` (or `-c`) to provide a path to a JavaScript or TypeScript module
exporting a custom rule or array of rules. Use `--cross` to enable cross
component analysis.

### Cross-Component Analysis

When analysing JSX or Vue projects you can track `<h1>` usage or similar patterns
across component boundaries. Instantiate `ProjectLinter` with the
`crossComponentAnalysis` option or pass `--cross` to the CLI. Use
`crossComponentDepth` (or `--cross-depth`) to limit how deep component trees are
traversed during analysis:

```ts
import { ProjectLinter } from 'zemdomu';
const linter = new ProjectLinter({ crossComponentAnalysis: true, crossComponentDepth: 2 });
await linter.lintFile('App.jsx');
```

```bash
npx zemdomu "src/**/*.{jsx,tsx,vue}" --cross --cross-depth 2
```

### Performance Diagnostics

Attach a `PerformanceDiagnostics` recorder to gather timing information for each
file and rule:

```ts
import { lint, PerformanceDiagnostics } from 'zemdomu';
const perf = new PerformanceDiagnostics();
lint(code, { perf });
console.log(perf.getAsJSON());
```

## 📝 Writing Custom Rules

Custom rules are simple objects implementing the `Rule` interface. At minimum
provide a `name`, a `test` function that returns `true` when a node violates the
rule and a `message` describing the problem:

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
  name: 'noFooDiv',
  test: node => node.type === 'element' && node.tagName === 'foo',
  message: '<foo> is not allowed'
};
```

Use it programmatically:

```ts
import { lint } from 'zemdomu';
const results = lint('<foo></foo>', { customRules: [require('./my-rule')] });
```

### Helper Utilities

For more advanced rules you may need direct access to the parsed HTML or JSX
AST. ZemDomu exposes a few helpers to make this easier:

```ts
import {
  parseHtml,
  visitHtml,
  getAttr,
  getJsxAttr,
  getTag,
  ElementNode,
  HtmlVisitor,
} from 'zemdomu';
```

`parseHtml` returns the root `ElementNode`. The `visitHtml` function performs a
simple depth‑first traversal using an `HtmlVisitor` with optional `enter` and
`exit` callbacks. Utility functions like `getAttr` and `getJsxAttr` help reading
attributes, while `getTag` resolves JSX element names.

Or via the CLI:

```bash
npx zemdomu file.html --custom my-rule.js
```

## 🔗 Related Tools

- [ZemDomu VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ZachariasErydBerlin.zemdomu)
- ZemDomu GitHub Action (coming soon)

## 🛠 Development

```bash
git clone https://github.com/Zemdomu/ZemDomu-core.git
cd ZemDomu-core
npm install
npm run build
```

Tests and coverage support coming soon.

## 🤝 Contributing

We welcome contributions! If you'd like to add rules, improve parsing or integrate new consumers:

1. Fork this repo
2. Add your logic inside `src/rules` or `src/linter.ts`
3. Write or update tests (if applicable)
4. Submit a pull request!

## 📄 License

MIT © 2025 Zacharias Eryd Berlin
