import { parse as parseHtmlDom, ElementNode } from './simpleHtmlParser';
import { parse as parseJs } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import requireAltText from './rules/requireAltText';

const builtInRules: Record<string, Rule> = {
  requireAltText,
};

export interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
}

export interface Rule {
  name: string;
  checkHtml?: (node: ElementNode) => LintResult[];
  checkJsx?: (path: NodePath<t.JSXOpeningElement>) => LintResult[];
}

export interface LinterOptions {
  rules?: Record<string, boolean>;
  customRules?: Rule[];
}

const defaultOptions: LinterOptions = {
  rules: {
    requireAltText: true,
  },
  customRules: [],
};

/**
 * Lint HTML/JSX/TSX content.
 */
export function lint(
  content: string,
  options: LinterOptions = defaultOptions
): LintResult[] {
  const opts: LinterOptions = {
    rules: { ...defaultOptions.rules, ...(options.rules || {}) },
    customRules: options.customRules ?? defaultOptions.customRules,
  };

  const results: LintResult[] = [];

  const activeRules: Rule[] = [];
  for (const name in opts.rules) {
    const enabled = opts.rules[name];
    if (enabled && builtInRules[name]) {
      activeRules.push(builtInRules[name]);
    }
  }
  if (opts.customRules) activeRules.push(...opts.customRules);

  let ast: t.File | null = null;
  try {
    ast = parseJs(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    ast = null;
  }

  if (ast) {
    traverse(ast, {
      JSXOpeningElement(path) {
        for (const rule of activeRules) {
          if (rule.checkJsx) {
            results.push(...rule.checkJsx(path));
          }
        }
      },
    });
    return results;
  }

  const root = parseHtmlDom(content);
  const walk = (node: ElementNode) => {
    for (const rule of activeRules) {
      if (rule.checkHtml) {
        results.push(...rule.checkHtml(node));
      }
    }
    for (const child of node.children) {
      if (child.type === 'element') walk(child);
    }
  };
  walk(root);

  return results;
}
