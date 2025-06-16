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
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
      if (tag === 'input') {
        const type = getJsxAttr(opening, 'type');
        if (type && type.toLowerCase() === 'image') {
          const alt = getJsxAttr(opening, 'alt');
          if (!alt || !alt.trim()) {
            const line = (opening.loc?.start.line ?? 1) - 1;
            const column = opening.loc?.start.column ?? 0;
            return [{ line, column, message: '<input type="image"> missing alt attribute', rule: 'requireImageInputAlt' }];
          }
        }
      }
      return [];
    },
  };
}
