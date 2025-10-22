import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function enforceHeadingOrder(): Rule {
  let last = 0;
  let seen = false;
  return {
    name: 'enforceHeadingOrder',
    init() { 
      last = 0; 
      seen = false;
    },
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
        const lvl = parseInt(node.tagName.charAt(1), 10);
        let message: string | null = null;
        if (last && lvl > last + 1) {
          message = `Heading level skipped: <${node.tagName}> after <h${last}>`;
        } else if (seen && lvl === 1 && last !== 1) {
          message = `Heading level skipped: <${node.tagName}> after <h${last}>`;
        }
        last = lvl;
        seen = true;
        if (message) {
          last = lvl;
          return [{ line: 0, column: 0, message, rule: 'enforceHeadingOrder' }];
        }
        return [];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (/^h[1-6]$/.test(tag)) {
        const lvl = parseInt(tag.charAt(1), 10);
        let message: string | null = null;
        if (last && lvl > last + 1) {
          message = `Heading level skipped: <${tag}> after <h${last}>`;
        } else if (seen && lvl === 1 && last !== 1) {
          message = `Heading level skipped: <${tag}> after <h${last}>`;
        }
        last = lvl;
        seen = true;
        if (message) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message, rule: 'enforceHeadingOrder' }];
        }
        return [];
      }
      return [];
    },
  };
}
