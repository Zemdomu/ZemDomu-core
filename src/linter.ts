import { parse as parseHtmlDom } from './simpleHtmlParser';
import { parse as parseJs } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import requireAltText from './rules/requireAltText';

export interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
}

export interface LinterOptions {
  rules: {
    requireAltText: boolean;
    // add more rules here
  };
}

const defaultOptions: LinterOptions = {
  rules: {
    requireAltText: true,
  },
};

/**
 * Lint HTML/JSX/TSX content.
 */
export function lint(
  content: string,
  options: LinterOptions = defaultOptions
): LintResult[] {
  // very simplified example
  const results: LintResult[] = [];

  // parse JSX/TSX
  try {
    const ast = parseJs(content, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    traverse(ast, {
      JSXOpeningElement(path) {
        if (!options.rules.requireAltText) return;
        const name = t.isJSXIdentifier(path.node.name) ? path.node.name.name : '';
        if (name === 'img') {
          const altAttr = path.node.attributes.find(
            (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'alt'
          ) as t.JSXAttribute | undefined;

          if (
            !altAttr ||
            !t.isStringLiteral(altAttr.value) ||
            altAttr.value.value.trim() === ''
          ) {
            const loc = path.node.loc!.start;
            results.push({
              line: loc.line - 1,
              column: loc.column,
              message: '<img> tag missing alt attribute',
              rule: 'requireAltText',
            });
          }
        }
      },
    });
    return results;
  } catch {
    // fallback to plain HTML parser
    const root = parseHtmlDom(content);
    // walk the tree and invoke rules; omitted for brevity
    return results;
  }
}
