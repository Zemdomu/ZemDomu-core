import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

const inlineTags = new Set(['strong','em','b','i','u','small','mark','del','ins']);

export default function preventEmptyInlineTags(): Rule {
  const stack: Array<{tag:string;found:boolean}> = [];
  return {
    name: 'preventEmptyInlineTags',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && inlineTags.has(node.tagName)) {
        stack.push({tag:node.tagName, found:false});
      } else if (node.type === 'text') {
        if (stack.length && node.text.trim()) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && inlineTags.has(node.tagName)) {
        const e = stack.pop();
        if (e && !e.found) return [{ line: 0, column: 0, message: `<${e.tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (inlineTags.has(tag)) stack.push({tag, found:false});
      return [];
    },
    exitJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (inlineTags.has(tag)) {
        const e = stack.pop();
        const hasText = (path.parentPath?.node as t.JSXElement).children.some(c => (t.isJSXText(c) && c.value.trim()) || t.isJSXExpressionContainer(c));
        if (e && !(e.found || hasText)) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: `<${tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
        }
      }
      return [];
    },
  };
}
