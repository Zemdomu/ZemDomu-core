import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttribute, isJsxAttrValueEmpty } from './utils';

export default function requireHrefOnAnchors(): Rule {
  return {
    name: 'requireHrefOnAnchors',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'a') {
        const href =
          node.attrs.href ?? node.attrs[':href'] ?? node.attrs['v-bind:href'];
        if (!href || !href.trim()) {
          return [
            {
              line: 0,
              column: 0,
              message: '<a> tag missing non-empty href attribute',
              rule: 'requireHrefOnAnchors',
            },
          ];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
      if (tag === 'a') {
        const hrefAttr = getJsxAttribute(opening, 'href');
        if (!hrefAttr || isJsxAttrValueEmpty(hrefAttr.value, true)) {
          const line = (opening.loc?.start.line ?? 1) - 1;
          const column = opening.loc?.start.column ?? 0;
          return [{ line, column, message: '<a> tag missing non-empty href attribute', rule: 'requireHrefOnAnchors' }];
        }
      }
      return [];
    },
  };
}
