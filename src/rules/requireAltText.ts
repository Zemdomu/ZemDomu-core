import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node, ElementNode } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';

export default function requireAltText(): Rule {
  return {
    name: 'requireAltText',
    enterHtml(node: Node): LintResult[] {
      if (
        node.type === 'element' &&
        node.tagName === 'img' &&
        (!('alt' in node.attrs) || !node.attrs.alt.trim())
      ) {
        return [
          {
            line: 0, // line/column handling omitted for brevity
            column: 0,
            message: '<img> tag missing alt attribute',
            rule: 'requireAltText',
          },
        ];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const name = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
      if (name !== 'img') return [];
      const altAttr = opening.attributes.find(
        (a): a is t.JSXAttribute =>
          t.isJSXAttribute(a) &&
          t.isJSXIdentifier(a.name) &&
          a.name.name === 'alt'
      );
      if (!altAttr || !t.isStringLiteral(altAttr.value) || altAttr.value.value.trim() === '') {
        const loc = opening.loc!.start;
        return [
          {
            line: loc.line - 1,
            column: loc.column,
            message: '<img> tag missing alt attribute',
            rule: 'requireAltText',
          },
        ];
      }
      return [];
    },
  };
}
