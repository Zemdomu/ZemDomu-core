import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function requireImageInputAlt(): Rule {
  return {
    name: 'requireImageInputAlt',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'input' && node.attrs.type && node.attrs.type.toLowerCase() === 'image') {
        const alt = node.attrs.alt;
        if (alt === undefined || !String(alt).trim()) {
          return [{ line: 0, column: 0, message: '<input type="image"> missing alt attribute', rule: 'requireImageInputAlt' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (tag === 'input') {
        const type = getJsxAttr(path.node, 'type');
        if (type && type.toLowerCase() === 'image') {
          const alt = getJsxAttr(path.node, 'alt');
          if (!alt || !alt.trim()) {
            const line = (path.node.loc?.start.line ?? 1) - 1;
            const column = path.node.loc?.start.column ?? 0;
            return [{ line, column, message: '<input type="image"> missing alt attribute', rule: 'requireImageInputAlt' }];
          }
        }
      }
      return [];
    },
  };
}
