import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function requireButtonText(): Rule {
  const stack: Array<{found:boolean;hadEmptyAria:boolean}> = [];
  return {
    name: 'requireButtonText',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'button') {
        const aria = node.attrs['aria-label'];
        stack.push({found: !!(aria && aria.trim()), hadEmptyAria: aria !== undefined && !String(aria).trim()});
      } else if (node.type === 'text') {
        if (stack.length && node.text.trim()) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'button') {
        const info = stack.pop();
        if (info && !info.found) {
          return [{ line: 0, column: 0, message: '<button> missing accessible text', rule: 'requireButtonText' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (tag === 'button') {
        const aria = getJsxAttr(path.node, 'aria-label');
        if (!aria || !aria.trim()) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<button> missing accessible text', rule: 'requireButtonText' }];
        }
      }
      return [];
    },
  };
}
