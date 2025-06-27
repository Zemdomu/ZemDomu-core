# ZemDomu Core

Semantic HTML linting engine for clean, accessible and SEO-friendly markup. This package provides the shared core logic used by the ZemDomu VS Code extension and upcoming GitHub Action.

## 🧠 What is ZemDomu?

**ZemDomu** is a semantic-first linter that helps developers write better HTML and JSX by catching accessibility and structural issues. It parses `.html`, `.jsx` and `.tsx` files and exposes a simple `lint()` function that returns semantic violations.

## 🚀 Installation

```bash
npm install zemdomu
# or
yarn add zemdomu
```

## ✨ Features

- ✅ Lint semantic issues in HTML, JSX and TSX
- 📦 Works in Node.js, CI or any JS runtime
- ⚙️ Extensible rule system
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

- `content` — HTML, JSX or TSX string input
- `options.rules` — toggles for built-in rules
- `options.customRules` — array of additional rules

**Example `LinterOptions`**

```ts
interface LinterOptions {
  rules: {
    requireAltText: boolean;
    // ...more rules to come
  };
  customRules?: Rule[];
}
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
`npx`:

```bash
npx zemdomu "src/**/*.{html,jsx,tsx}" --custom my-rule.js
```

Use `--custom` (or `-c`) to provide a path to a JavaScript or TypeScript module
exporting a custom rule or array of rules. Use `--cross` to enable cross
component analysis.

## 📝 Writing Custom Rules

Custom rules are simple objects implementing the `Rule` interface. The easiest
way is to provide a `test` function that returns `true` when a node violates the
rule and a `message` describing the issue:

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
