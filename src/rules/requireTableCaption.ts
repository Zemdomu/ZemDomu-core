import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

type JsxChild = t.JSXElement['children'][number];

function jsxChildHasText(child: JsxChild): boolean {
  if (t.isJSXText(child)) return child.value.trim().length > 0;
  if (t.isJSXExpressionContainer(child)) {
    const expr = child.expression;
    if (t.isJSXElement(expr)) return jsxElementHasText(expr);
    if (t.isJSXFragment(expr)) return expr.children.some(jsxChildHasText);
    return true;
  }
  if (t.isJSXElement(child)) return jsxElementHasText(child);
  if (t.isJSXFragment(child)) return child.children.some(jsxChildHasText);
  if (t.isJSXSpreadChild(child)) return true;
  return false;
}

function jsxElementHasText(node: t.JSXElement): boolean {
  return node.children.some(jsxChildHasText);
}

export default function requireTableCaption(): Rule {
  const stack: Array<{found:boolean; hasText:boolean}> = [];
  let captionDepth = 0;
  return {
    name: 'requireTableCaption',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'table') stack.push({found:false, hasText:false});
        if (node.tagName === 'caption' && stack.length) {
          stack[stack.length-1].found = true;
          captionDepth += 1;
        }
      } else if (node.type === 'text') {
        if (captionDepth > 0 && stack.length) {
          if (node.text.trim()) stack[stack.length-1].hasText = true;
        }
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        if (node.tagName === 'caption' && captionDepth > 0) {
          captionDepth -= 1;
        }
        if (node.tagName === 'table') {
          const entry = stack.pop();
          if (entry && !entry.found) {
            return [{ line: 0, column: 0, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
          }
          if (entry && entry.found && !entry.hasText) {
            return [{ line: 0, column: 0, message: '<caption> is empty', rule: 'requireTableCaption' }];
          }
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'table') stack.push({found:false, hasText:false});
      if (tag === 'caption' && stack.length) {
        stack[stack.length-1].found = true;
        if (jsxElementHasText(path.node)) stack[stack.length-1].hasText = true;
      }
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'table') {
        const entry = stack.pop();
        if (entry && !entry.found) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
        }
        if (entry && entry.found && !entry.hasText) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: '<caption> is empty', rule: 'requireTableCaption' }];
        }
      }
      return [];
    },
  };
}
