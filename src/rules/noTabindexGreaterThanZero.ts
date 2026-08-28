import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function noTabindexGreaterThanZero(): Rule {
  const message = 'Tabindex greater than 0 should be avoided';
  return {
    name: 'noTabindexGreaterThanZero',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.attrs.tabindex !== undefined) {
        const value = Number(node.attrs.tabindex);
        if (!Number.isNaN(value) && value > 0) {
          return [{ line: 0, column: 0, message, rule: 'noTabindexGreaterThanZero' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tabindex = getJsxAttr(opening, 'tabIndex') ?? getJsxAttr(opening, 'tabindex');
      if (tabindex !== undefined) {
        const value = Number(tabindex);
        if (!Number.isNaN(value) && value > 0) {
          const line = (opening.loc?.start.line ?? 1) - 1;
          const column = opening.loc?.start.column ?? 0;
          return [{ line, column, message, rule: 'noTabindexGreaterThanZero' }];
        }
      }
      return [];
    },
  };
}
