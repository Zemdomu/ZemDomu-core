import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ElementNode } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';

const requireAltText: Rule = {
  name: 'requireAltText',
  checkHtml(node: ElementNode): LintResult[] {
    if (
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
  checkJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
    const name = t.isJSXIdentifier(path.node.name) ? path.node.name.name : '';
    if (name !== 'img') return [];
    const altAttr = path.node.attributes.find(
      (a): a is t.JSXAttribute =>
        t.isJSXAttribute(a) &&
        t.isJSXIdentifier(a.name) &&
        a.name.name === 'alt'
    );
    if (!altAttr || !t.isStringLiteral(altAttr.value) || altAttr.value.value.trim() === '') {
      const loc = path.node.loc!.start;
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

export default requireAltText;
