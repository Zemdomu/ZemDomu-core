import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ElementNode, Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttribute, getJsxAttributeState, getJsxExpressionState, JsxValueState } from './utils';

type HtmlButtonEntry = { node: ElementNode };
type JsxButtonEntry = { node: t.JSXElement; line: number; column: number };

const HTML_ARIA_LABEL_ATTRS = ['aria-label'];
const HTML_ARIA_LABELLEDBY_ATTRS = ['aria-labelledby'];
const HTML_ARIA_HIDDEN_ATTRS = ['aria-hidden'];
const HTML_HIDDEN_ATTRS = ['hidden'];

function getHtmlAttrValue(
  attrs: Record<string, string>,
  names: string[]
): string | undefined {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(attrs, name)) {
      return attrs[name];
    }
  }
  return undefined;
}

function hasHtmlAttr(
  attrs: Record<string, string>,
  names: string[]
): boolean {
  return names.some((name) => Object.prototype.hasOwnProperty.call(attrs, name));
}

function normalizeStyle(style: string): string {
  return style.toLowerCase().replace(/\s+/g, '');
}

function isHiddenStyle(style?: string): boolean {
  if (!style) return false;
  const normalized = normalizeStyle(style);
  return (
    normalized.includes('display:none') ||
    normalized.includes('visibility:hidden') ||
    normalized.includes('visibility:collapse')
  );
}

function isHtmlHidden(node: ElementNode): boolean {
  if (hasHtmlAttr(node.attrs, HTML_HIDDEN_ATTRS)) return true;
  const ariaHidden = getHtmlAttrValue(node.attrs, HTML_ARIA_HIDDEN_ATTRS);
  if (typeof ariaHidden === 'string' && ariaHidden.trim().toLowerCase() === 'true') {
    return true;
  }
  const style = node.attrs.style;
  return isHiddenStyle(style);
}

function hasHtmlNonEmptyAriaLabel(node: ElementNode): boolean {
  const aria = getHtmlAttrValue(node.attrs, HTML_ARIA_LABEL_ATTRS);
  if (aria === undefined) return false;
  return aria.trim().length > 0;
}

function htmlImgAltPresent(node: ElementNode): boolean {
  const alt = node.attrs.alt;
  return typeof alt === 'string' && alt.trim().length > 0;
}

function hasHtmlAccessibleText(node: Node, hidden: boolean): boolean {
  if (hidden) return false;
  if (node.type === 'text') {
    return node.text.trim().length > 0;
  }
  if (node.type === 'element') {
    const isHidden = hidden || isHtmlHidden(node);
    if (isHidden) return false;
    if (node.tagName === 'img') {
      return htmlImgAltPresent(node);
    }
    return node.children.some((child) => hasHtmlAccessibleText(child, isHidden));
  }
  return false;
}

function hasHtmlAriaLabelledByText(
  node: ElementNode,
  idMap: Map<string, ElementNode[]>
): boolean {
  const labelledBy = getHtmlAttrValue(node.attrs, HTML_ARIA_LABELLEDBY_ATTRS);
  if (!labelledBy) return false;
  const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return false;
  for (const id of ids) {
    const targets = idMap.get(id);
    if (!targets) continue;
    for (const target of targets) {
      if (hasHtmlAccessibleText(target, false)) return true;
    }
  }
  return false;
}

function getJsxTagName(opening: t.JSXOpeningElement): string {
  return t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
}

function getStaticJsxAttrText(
  opening: t.JSXOpeningElement,
  name: string
): string | undefined | null {
  const attr = getJsxAttribute(opening, name);
  if (!attr) return undefined;
  if (!attr.value) return '';
  if (t.isStringLiteral(attr.value)) return attr.value.value;
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) return expr.value;
    if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
      const raw = expr.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
      return raw;
    }
  }
  return null;
}

function isJsxHidden(opening: t.JSXOpeningElement): boolean {
  const attr = getJsxAttribute(opening, 'hidden');
  if (!attr) return false;
  if (!attr.value) return true;
  if (t.isStringLiteral(attr.value)) return true;
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isBooleanLiteral(expr)) return expr.value;
  }
  return false;
}

function isJsxAriaHidden(opening: t.JSXOpeningElement): boolean {
  const attr = getJsxAttribute(opening, 'aria-hidden');
  if (!attr) return false;
  if (!attr.value) return true;
  if (t.isStringLiteral(attr.value)) {
    return attr.value.value.trim().toLowerCase() === 'true';
  }
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isBooleanLiteral(expr)) return expr.value;
    if (t.isStringLiteral(expr)) {
      return expr.value.trim().toLowerCase() === 'true';
    }
  }
  return false;
}

function isJsxStyleHidden(opening: t.JSXOpeningElement): boolean {
  const attr = getJsxAttribute(opening, 'style');
  if (!attr || !attr.value) return false;
  if (t.isStringLiteral(attr.value)) {
    return isHiddenStyle(attr.value.value);
  }
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) return isHiddenStyle(expr.value);
  }
  return false;
}

function isJsxHiddenFromAT(opening: t.JSXOpeningElement): boolean {
  return isJsxHidden(opening) || isJsxAriaHidden(opening) || isJsxStyleHidden(opening);
}

type JsxChild = t.JSXElement['children'][number];

function mergeStates(states: JsxValueState[]): JsxValueState {
  if (states.some((s) => s === 'present')) return 'present';
  if (states.some((s) => s === 'possiblyEmpty')) return 'possiblyEmpty';
  return 'empty';
}

function jsxImgAltState(opening: t.JSXOpeningElement): JsxValueState {
  const alt = getStaticJsxAttrText(opening, 'alt');
  if (alt === undefined) return 'empty';
  if (alt === null) return 'empty';
  return alt.trim().length > 0 ? 'present' : 'empty';
}

function jsxChildTextState(child: JsxChild, hidden: boolean): JsxValueState {
  if (hidden) return 'empty';
  if (t.isJSXText(child)) return child.value.trim().length > 0 ? 'present' : 'empty';
  if (t.isJSXExpressionContainer(child)) {
    const expr = child.expression;
    if (t.isJSXElement(expr)) return jsxElementTextState(expr, hidden);
    if (t.isJSXFragment(expr)) {
      return mergeStates(expr.children.map((c) => jsxChildTextState(c, hidden)));
    }
    return getJsxExpressionState(expr, true);
  }
  if (t.isJSXElement(child)) return jsxElementTextState(child, hidden);
  if (t.isJSXFragment(child)) {
    return mergeStates(child.children.map((c) => jsxChildTextState(c, hidden)));
  }
  if (t.isJSXSpreadChild(child)) return 'present';
  return 'empty';
}

function jsxElementTextState(node: t.JSXElement, parentHidden: boolean): JsxValueState {
  const opening = node.openingElement;
  const isHidden = parentHidden || isJsxHiddenFromAT(opening);
  if (isHidden) return 'empty';
  const tag = getJsxTagName(opening);
  if (tag === 'img') {
    return jsxImgAltState(opening);
  }
  return mergeStates(node.children.map((c) => jsxChildTextState(c, isHidden)));
}

function hasJsxAriaLabelledByText(
  opening: t.JSXOpeningElement,
  idMap: Map<string, t.JSXElement[]>
): boolean {
  const labelledBy = getStaticJsxAttrText(opening, 'aria-labelledby');
  if (!labelledBy) return false;
  const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return false;
  for (const id of ids) {
    const targets = idMap.get(id);
    if (!targets) continue;
    for (const target of targets) {
      const state = jsxElementTextState(target, false);
      if (state === 'present') return true;
    }
  }
  return false;
}

export default function requireButtonText(): Rule {
  const htmlButtons: HtmlButtonEntry[] = [];
  const htmlIds = new Map<string, ElementNode[]>();
  const jsxButtons: JsxButtonEntry[] = [];
  const jsxIds = new Map<string, t.JSXElement[]>();

  return {
    name: 'requireButtonText',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        const id = node.attrs.id;
        if (id && id.trim().length > 0) {
          if (!htmlIds.has(id)) htmlIds.set(id, []);
          htmlIds.get(id)!.push(node);
        }
        if (node.tagName === 'button') {
          htmlButtons.push({ node });
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = getJsxTagName(opening);
      const id = getStaticJsxAttrText(opening, 'id');
      if (typeof id === 'string' && id.trim().length > 0) {
        if (!jsxIds.has(id)) jsxIds.set(id, []);
        jsxIds.get(id)!.push(path.node);
      }
      if (tag === 'button') {
        const line = (opening.loc?.start.line ?? 1) - 1;
        const column = opening.loc?.start.column ?? 0;
        jsxButtons.push({ node: path.node, line, column });
      }
      return [];
    },
    end(): LintResult[] {
      const results: LintResult[] = [];
      for (const { node } of htmlButtons) {
        if (isHtmlHidden(node)) continue;
        const hasLabel = hasHtmlNonEmptyAriaLabel(node);
        const hasLabelledBy = hasHtmlAriaLabelledByText(node, htmlIds);
        const hasContent = hasHtmlAccessibleText(node, false);
        if (!hasLabel && !hasLabelledBy && !hasContent) {
          results.push({
            line: 0,
            column: 0,
            offset: node.startIndex,
            message: '<button> missing accessible text',
            rule: 'requireButtonText',
          });
        }
      }

      for (const { node, line, column } of jsxButtons) {
        const opening = node.openingElement;
        if (isJsxHiddenFromAT(opening)) continue;
        const ariaState = getJsxAttributeState(opening, 'aria-label', true);
        const hasLabel = ariaState === 'present';
        const hasLabelledBy = hasJsxAriaLabelledByText(opening, jsxIds);
        const contentState = jsxElementTextState(node, false);
        const hasContent = contentState === 'present';
        if (!hasLabel && !hasLabelledBy && !hasContent) {
          results.push({
            line,
            column,
            offset: opening.start ?? undefined,
            message: '<button> missing accessible text',
            rule: 'requireButtonText',
          });
        }
      }
      return results;
    },
  };
}
