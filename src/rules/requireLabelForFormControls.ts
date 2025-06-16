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
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (tag === 'label') {
        const htmlFor = getJsxAttr(path.node, 'for');
        if (htmlFor) labels.add(htmlFor);
      }
      if (['input','select','textarea'].includes(tag)) {
        const id = getJsxAttr(path.node, 'id');
        const aria = getJsxAttr(path.node, 'aria-label');
        if (!aria || !aria.trim()) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          if (!id) return [{ line, column, message: 'Form control missing id or aria-label', rule: 'requireLabelForFormControls' }];
          if (!labels.has(id)) return [{ line, column, message: `Form control with id="${id}" missing <label for="${id}">`, rule: 'requireLabelForFormControls' }];
        }
      }
      return [];
    },
  };
}
