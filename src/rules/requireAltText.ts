import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node, ElementNode } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttributeState } from './utils';

export default function requireAltText(): Rule {
  return {
    name: 'requireAltText',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'img') {
        const alt = node.attrs.alt ?? node.attrs[':alt'] ?? node.attrs['v-bind:alt'];
        if (alt === undefined || !String(alt).trim()) {
          return [
            {
              line: 0, // line/column handling omitted for brevity
              column: 0,
              message: '<img> tag missing or empty alt attribute',
              rule: 'requireAltText',
            },
          ];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const name = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
      if (name !== 'img') return [];
      const altState = getJsxAttributeState(opening, 'alt', true);
      if (altState === 'missing' || altState === 'empty' || altState === 'possiblyEmpty') {
        const loc = opening.loc!.start;
        const message =
          altState === 'possiblyEmpty'
            ? '<img> alt is possibly empty or undefined'
            : '<img> tag missing or empty alt attribute';
        return [
          {
            line: loc.line - 1,
            column: loc.column,
            message,
            rule: 'requireAltText',
          },
        ];
      }
      return [];
    },
  };
}
