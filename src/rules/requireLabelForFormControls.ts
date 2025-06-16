import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function requireLabelForFormControls(): Rule {
  const labels = new Set<string>();
  return {
    name: 'requireLabelForFormControls',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'label' && node.attrs['for']) labels.add(node.attrs['for']);
        if (['input','select','textarea'].includes(node.tagName)) {
          const id = node.attrs.id;
          const aria = node.attrs['aria-label'];
          if (!aria || !aria.trim()) {
            if (!id) return [{ line: 0, column: 0, message: 'Form control missing id or aria-label', rule: 'requireLabelForFormControls' }];
            if (!labels.has(id)) return [{ line: 0, column: 0, message: `Form control with id="${id}" missing <label for="${id}">`, rule: 'requireLabelForFormControls' }];
          }
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
      if (tag === 'label') {
        const htmlFor = getJsxAttr(opening, 'for');
        if (htmlFor) labels.add(htmlFor);
      }
      if (['input','select','textarea'].includes(tag)) {
        const id = getJsxAttr(opening, 'id');
        const aria = getJsxAttr(opening, 'aria-label');
        if (!aria || !aria.trim()) {
          const line = (opening.loc?.start.line ?? 1) - 1;
          const column = opening.loc?.start.column ?? 0;
          if (!id) return [{ line, column, message: 'Form control missing id or aria-label', rule: 'requireLabelForFormControls' }];
          if (!labels.has(id)) return [{ line, column, message: `Form control with id="${id}" missing <label for="${id}">`, rule: 'requireLabelForFormControls' }];
        }
      }
      return [];
    },
  };
}
