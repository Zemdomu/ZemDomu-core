import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function requireTableCaption(): Rule {
  const stack: Array<{found:boolean}> = [];
  return {
    name: 'requireTableCaption',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'table') stack.push({found:false});
        if (node.tagName === 'caption' && stack.length) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'table') {
        const entry = stack.pop();
        if (entry && !entry.found) return [{ line: 0, column: 0, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'table') stack.push({found:false});
      if (tag === 'caption' && stack.length) stack[stack.length-1].found = true;
      return [];
    },
    exitJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'table') {
        const entry = stack.pop();
        if (entry && !entry.found) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
        }
      }
      return [];
    },
  };
}
