import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';

export default function requireHtmlLang(): Rule {
  let seen = false;
  return {
    name: 'requireHtmlLang',
    enterHtml(node: Node): LintResult[] {
      if (!seen && node.type === 'element' && node.tagName === 'html') {
        seen = true;
        const lang = node.attrs.lang;
        if (lang === undefined) {
          return [{ line: 0, column: 0, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
        }
        if (!String(lang).trim()) {
          return [{ line: 0, column: 0, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXOpeningElement>): LintResult[] {
      const tag = t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
      if (!seen && tag === 'html') {
        seen = true;
        const lang = getJsxAttr(path.node, 'lang');
        if (lang === undefined || !lang.trim()) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
        }
      }
      return [];
    },
  };
}
