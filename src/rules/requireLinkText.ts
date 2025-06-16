import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function requireLinkText(): Rule {
  const stack: Array<{found:boolean}> = [];
  return {
    name: 'requireLinkText',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'a') {
        stack.push({found:false});
      } else if (node.type === 'text') {
        if (stack.length && node.text.trim()) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'a') {
        const entry = stack.pop();
        if (entry && !entry.found) return [{ line: 0, column: 0, message: '<a> tag missing link text', rule: 'requireLinkText' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'a') stack.push({found:false});
      return [];
    },
    exitJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'a') {
        const entry = stack.pop();
        let hasText = false;
        const parent = path.parentPath?.node as t.JSXElement;
        if (parent && Array.isArray(parent.children)) {
          hasText = parent.children.some(c => (t.isJSXText(c) && c.value.trim()) || t.isJSXExpressionContainer(c));
        }
        if (entry && !(entry.found || hasText)) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<a> tag missing link text', rule: 'requireLinkText' }];
        }
      }
      return [];
    },
  };
}
