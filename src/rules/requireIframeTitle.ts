import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttributeState } from './utils';

export default function requireIframeTitle(): Rule {
  return {
    name: 'requireIframeTitle',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'iframe') {
        const title = node.attrs.title;
        if (title === undefined) {
          return [{ line: 0, column: 0, message: '<iframe> missing title attribute', rule: 'requireIframeTitle' }];
        }
        if (!String(title).trim()) {
          return [{ line: 0, column: 0, message: '<iframe> title attribute is empty', rule: 'requireIframeTitle' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
      if (tag === 'iframe') {
        const titleState = getJsxAttributeState(opening, 'title', true);
        if (titleState === 'missing') {
          const line = (opening.loc?.start.line ?? 1) - 1;
          const column = opening.loc?.start.column ?? 0;
          return [{ line, column, message: '<iframe> missing title attribute', rule: 'requireIframeTitle' }];
        }
        if (titleState === 'empty') {
          const line = (opening.loc?.start.line ?? 1) - 1;
          const column = opening.loc?.start.column ?? 0;
          return [{ line, column, message: '<iframe> title attribute is empty', rule: 'requireIframeTitle' }];
        }
      }
      return [];
    },
  };
}
