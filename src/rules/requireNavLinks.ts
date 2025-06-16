import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function requireNavLinks(): Rule {
  const stack: Array<{hasLink:boolean}> = [];
  return {
    name: 'requireNavLinks',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'nav') stack.push({hasLink:false});
        if (node.tagName === 'a' && stack.length) stack[stack.length-1].hasLink = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'nav') {
        const entry = stack.pop();
        if (entry && !entry.hasLink) return [{ line: 0, column: 0, message: '<nav> contains no links', rule: 'requireNavLinks' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'nav') stack.push({hasLink:false});
      if (tag === 'a' && stack.length) stack[stack.length-1].hasLink = true;
      return [];
    },
    exitJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'nav') {
        const entry = stack.pop();
        if (entry && !entry.hasLink) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<nav> contains no links', rule: 'requireNavLinks' }];
        }
      }
      return [];
    },
  };
}
