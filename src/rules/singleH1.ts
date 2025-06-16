import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function singleH1(): Rule {
  let count = 0;
  return {
    name: 'singleH1',
    init() { count = 0; },
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'h1') {
        count++;
        if (count > 1) {
          return [{ line: 0, column: 0, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'h1') {
        count++;
        if (count > 1) {
          const line = (path.node.openingElement.loc?.start.line ?? 1) - 1;
          const column = path.node.openingElement.loc?.start.column ?? 0;
          return [{ line, column, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
        }
      }
      return [];
    },
  };
}
