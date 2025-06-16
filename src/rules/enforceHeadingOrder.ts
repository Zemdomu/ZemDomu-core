import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function enforceHeadingOrder(): Rule {
  let last = 0;
  return {
    name: 'enforceHeadingOrder',
    init() { last = 0; },
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
        const lvl = parseInt(node.tagName.charAt(1), 10);
        if (last && lvl > last + 1) {
          const message = `Heading level skipped: <${node.tagName}> after <h${last}>`;
          last = lvl;
          return [{ line: 0, column: 0, message, rule: 'enforceHeadingOrder' }];
        }
        last = lvl;
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = getTag(path);
      if (/^h[1-6]$/.test(tag)) {
        const lvl = parseInt(tag.charAt(1), 10);
        if (last && lvl > last + 1) {
          const message = `Heading level skipped: <${tag}> after <h${last}>`;
          last = lvl;
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message, rule: 'enforceHeadingOrder' }];
        }
        last = lvl;
      }
      return [];
    },
  };
}
