# ZemDomu Core

Semantic HTML linting engine for clean, accessible and SEO-friendly markup. This package provides the shared core logic used by the ZemDomu VS Code extension and upcoming GitHub Action.

## 🧠 What is ZemDomu Core?

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
import { lint } from 'zemdomu';

const html = '<img>';
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
// const myRule = { name: 'demo', checkHtml: () => [] };
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

## 🔗 Related Tools

- [ZemDomu VS Code Extension](../ZemDomu-Extension)
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
