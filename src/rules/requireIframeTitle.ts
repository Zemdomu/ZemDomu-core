import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

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
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (tag === 'iframe') {
        const title = getJsxAttr(path.node, 'title');
        if (!title || !title.trim()) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<iframe> missing title attribute', rule: 'requireIframeTitle' }];
        }
      }
      return [];
    },
  };
}
