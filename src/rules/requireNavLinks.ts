import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag, hasHtmlLinkAttribute, hasJsxLinkAttribute } from './utils';

export default function requireNavLinks(): Rule {
  const stack: Array<{hasLink:boolean; hasUnknownContent?: boolean}> = [];
  return {
    name: 'requireNavLinks',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'nav') stack.push({hasLink:false});
        if (stack.length) {
          if (node.tagName === 'a' || hasHtmlLinkAttribute(node.attrs)) {
            stack[stack.length-1].hasLink = true;
          }
        }
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
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'nav') {
        stack.push({
          hasLink: false,
          hasUnknownContent: path.node.openingElement.attributes.some((attr) =>
            t.isJSXSpreadAttribute(attr)
          ),
        });
      }
      if (stack.length) {
        if (tag === 'a') {
          stack[stack.length-1].hasLink = true;
        } else if (hasJsxLinkAttribute(path.node.openingElement)) {
          stack[stack.length-1].hasLink = true;
        } else if (t.isJSXIdentifier(path.node.openingElement.name) && /^[A-Z]/.test(path.node.openingElement.name.name)) {
          stack[stack.length-1].hasLink = true;
        }
      }
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'nav') {
        const entry = stack.pop();
        if (entry && !entry.hasLink && !entry.hasUnknownContent) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<nav> contains no links', rule: 'requireNavLinks' }];
        }
      }
      return [];
    },
  };
}
