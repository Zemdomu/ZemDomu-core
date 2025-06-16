import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function requireHrefOnAnchors(): Rule {
  return {
    name: 'requireHrefOnAnchors',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'a') {
        const href = node.attrs.href;
        if (!href || !href.trim()) {
          return [{ line: 0, column: 0, message: '<a> tag missing non-empty href attribute', rule: 'requireHrefOnAnchors' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (tag === 'a') {
        const href = getJsxAttr(path.node, 'href');
        if (!href || !href.trim()) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<a> tag missing non-empty href attribute', rule: 'requireHrefOnAnchors' }];
        }
      }
      return [];
    },
  };
}
