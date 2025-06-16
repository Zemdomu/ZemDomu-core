ZemDomu

Semantic HTML linting engine for clean, accessible, and SEO-friendly markup. This package provides the shared core logic used by the ZemDomu VS Code extension and upcoming GitHub Action.



🧠 What is ZemDomu Core?

ZemDomu is a semantic-first linter that helps developers write better HTML and JSX by catching accessibility and structural issues. This package contains the framework-agnostic linting engine used by other tools in the ZemDomu ecosystem.

It parses .html, .jsx, and .tsx content and exposes a simple lint() function that returns semantic violations.

🚀 Installation

npm install zemdomu
# or
yarn add zemdomu

✨ Features

✅ Lint semantic issues in HTML, JSX, and TSX

📦 Works in Node.js, CI, or any JS runtime

⚙️ Extensible rule system

📚 Shared by extension and GitHub Action

🧪 Simple API: lint(content, options)

⚙️ Usage Example

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

📖 API

lint(content: string, options?: LinterOptions): LintResult[]

Parameters:

content — HTML, JSX, or TSX string input

options.rules — toggles for individual rules

Example LinterOptions

interface LinterOptions {
  rules: {
    requireAltText: boolean;
    // ...more rules to come
  };
}

Example LintResult

interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
}

🔗 Related Tools

ZemDomu VS Code Extension

ZemDomu GitHub Action (coming soon)

🛠 Development

git clone https://github.com/Zemdomu/ZemDomu-core.git
cd ZemDomu-core
npm install
npm run build

Tests and coverage support coming soon.

🤝 Contributing

We welcome contributions! If you'd like to add rules, improve parsing, or integrate new consumers:

Fork this repo

Add your logic inside src/rules or src/linter.ts

Write or update tests (if applicable)

Submit a pull request!

📄 License

MIT © 2025 Zacharias Eryd Berlin

