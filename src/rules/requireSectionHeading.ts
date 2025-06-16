import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function requireSectionHeading(): Rule {
  const stack: Array<{found:boolean}> = [];
  return {
    name: 'requireSectionHeading',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'section') stack.push({found:false});
        if (/^h[1-6]$/i.test(node.tagName) && stack.length) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'section') {
        const s = stack.pop();
        if (s && !s.found) return [{ line: 0, column: 0, message: '<section> missing heading (<h1>-<h6>)', rule: 'requireSectionHeading' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'section') stack.push({found:false});
      if (/^h[1-6]$/.test(tag) && stack.length) stack[stack.length-1].found = true;
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'section') {
        const s = stack.pop();
        if (s && !s.found) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<section> missing heading (<h1>-<h6>)', rule: 'requireSectionHeading' }];
        }
      }
      return [];
    },
  };
}
