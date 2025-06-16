import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function uniqueIds(): Rule {
  const ids = new Set<string>();
  return {
    name: 'uniqueIds',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.attrs.id) {
        const id = String(node.attrs.id);
        if (ids.has(id)) {
          return [{ line: 0, column: 0, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
        }
        ids.add(id);
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const id = getJsxAttr(path.node.openingElement, 'id');
      if (id) {
        if (ids.has(id)) {
          const line = (path.node.openingElement.loc?.start.line ?? 1) - 1;
          const column = path.node.openingElement.loc?.start.column ?? 0;
          return [{ line, column, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
        }
        ids.add(id);
      }
      return [];
    },
  };
}
