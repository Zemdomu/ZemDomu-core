import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

const inlineTags = new Set(['strong','em','b','i','u','small','mark','del','ins']);

function htmlHasContent(node: Node): boolean {
  if (node.type === 'text') return node.text.trim().length > 0;
  if (node.type !== 'element') return false;
  if (node.tagName === 'img') return String(node.attrs.alt ?? '').trim().length > 0;
  return node.children.some(htmlHasContent);
}

function jsxHasContent(node: t.JSXElement | t.JSXFragment): boolean {
  return node.children.some((child) => {
    if (t.isJSXText(child)) return child.value.trim().length > 0;
    if (t.isJSXExpressionContainer(child)) return !t.isJSXEmptyExpression(child.expression);
    if (t.isJSXFragment(child)) return jsxHasContent(child);
    if (t.isJSXElement(child)) {
      const tag = t.isJSXIdentifier(child.openingElement.name)
        ? child.openingElement.name.name.toLowerCase()
        : '';
      if (tag === 'img') {
        const alt = child.openingElement.attributes.find(
          (attribute): attribute is t.JSXAttribute =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name) &&
            attribute.name.name === 'alt'
        );
        return !!alt && !!alt.value;
      }
      return jsxHasContent(child);
    }
    return false;
  });
}

export default function preventEmptyInlineTags(): Rule {
  const stack: Array<{tag:string;found:boolean}> = [];
  return {
    name: 'preventEmptyInlineTags',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element' && inlineTags.has(node.tagName)) {
        stack.push({tag:node.tagName, found:false});
      } else if (node.type === 'text') {
        if (stack.length && node.text.trim()) stack[stack.length-1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && inlineTags.has(node.tagName)) {
        const e = stack.pop();
        if (e && !(e.found || htmlHasContent(node))) return [{ line: 0, column: 0, message: `<${e.tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (inlineTags.has(tag)) stack.push({tag, found:false});
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (inlineTags.has(tag)) {
        const e = stack.pop();
        const hasText = jsxHasContent(path.node);
        if (e && !(e.found || hasText)) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [{ line, column, message: `<${tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
        }
      }
      return [];
    },
  };
}
