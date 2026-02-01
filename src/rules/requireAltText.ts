import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node, ElementNode } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttribute, getJsxAttributeState, getJsxExpressionState, JsxValueState } from './utils';

type HtmlSvgEntry = { node: ElementNode; parent: ElementNode | null };
type JsxSvgEntry = { node: t.JSXElement; parent: t.JSXElement | null; line: number; column: number };

const HTML_ARIA_LABEL_ATTRS = ['aria-label', ':aria-label', 'v-bind:aria-label'];
const HTML_ARIA_LABELLEDBY_ATTRS = ['aria-labelledby', ':aria-labelledby', 'v-bind:aria-labelledby'];
const HTML_ROLE_ATTRS = ['role', ':role', 'v-bind:role'];
const HTML_ARIA_HIDDEN_ATTRS = ['aria-hidden'];
const HTML_HIDDEN_ATTRS = ['hidden'];

function getHtmlAttrWithName(
  attrs: Record<string, string>,
  names: string[]
): { name: string; value: string } | null {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(attrs, name)) {
      return { name, value: attrs[name] };
    }
  }
  return null;
}

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

function hasHtmlAttr(attrs: Record<string, string>, names: string[]): boolean {
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
  return isHiddenStyle(node.attrs.style);
}

function htmlImgAltPresent(node: ElementNode): boolean {
  const alt = node.attrs.alt ?? node.attrs[':alt'] ?? node.attrs['v-bind:alt'];
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
    if (node.tagName === 'img') return htmlImgAltPresent(node);
    return node.children.some((child) => hasHtmlAccessibleText(child, isHidden));
  }
  return false;
}

function hasHtmlTitleText(node: ElementNode): boolean {
  let found = false;
  const walk = (n: Node) => {
    if (found) return;
    if (n.type === 'element') {
      if (n.tagName === 'title') {
        found = hasHtmlAccessibleText(n, false);
        return;
      }
      for (const child of n.children) {
        walk(child);
        if (found) return;
      }
    }
  };
  walk(node);
  return found;
}

function hasHtmlRoleImg(node: ElementNode): boolean {
  const roleAttr = getHtmlAttrValue(node.attrs, HTML_ROLE_ATTRS);
  if (!roleAttr) return false;
  return roleAttr
    .split(/\s+/)
    .some((token) => token.trim().toLowerCase() === 'img');
}

function isHtmlIconOnlyParent(parent: ElementNode, svgNode: ElementNode): boolean {
  let elementCount = 0;
  let hasText = false;
  let isOnlySvg = false;
  for (const child of parent.children) {
    if (child.type === 'text' && child.text.trim().length > 0) {
      hasText = true;
    } else if (child.type === 'element') {
      elementCount += 1;
      if (child === svgNode) isOnlySvg = true;
    }
  }
  return !hasText && elementCount === 1 && isOnlySvg;
}

function hasHtmlAriaLabelledByText(
  node: ElementNode,
  idMap: Map<string, ElementNode[]>
): boolean {
  const labelledBy = getHtmlAttrWithName(node.attrs, HTML_ARIA_LABELLEDBY_ATTRS);
  if (!labelledBy) return false;
  const value = labelledBy.value ?? '';
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (labelledBy.name !== 'aria-labelledby') return true;
  const ids = trimmed.split(/\s+/).filter(Boolean);
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

function hasHtmlSvgAccessibleName(
  node: ElementNode,
  idMap: Map<string, ElementNode[]>
): boolean {
  const ariaLabel = getHtmlAttrWithName(node.attrs, HTML_ARIA_LABEL_ATTRS);
  if (ariaLabel && String(ariaLabel.value ?? '').trim().length > 0) return true;
  if (hasHtmlAriaLabelledByText(node, idMap)) return true;
  return hasHtmlTitleText(node);
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
  const filtered = states.filter((s) => s !== 'missing');
  if (!filtered.length) return 'empty';
  if (filtered.some((s) => s === 'present')) return 'present';
  if (filtered.some((s) => s === 'possiblyEmpty')) return 'possiblyEmpty';
  return 'empty';
}

function jsxChildTextState(child: JsxChild): JsxValueState {
  if (t.isJSXText(child)) return child.value.trim().length > 0 ? 'present' : 'empty';
  if (t.isJSXExpressionContainer(child)) {
    return getJsxExpressionState(child.expression, true);
  }
  if (t.isJSXElement(child)) {
    return mergeStates(child.children.map(jsxChildTextState));
  }
  if (t.isJSXFragment(child)) {
    return mergeStates(child.children.map(jsxChildTextState));
  }
  if (t.isJSXSpreadChild(child)) return 'present';
  return 'empty';
}

function jsxTitleState(node: t.JSXElement): JsxValueState {
  let state: JsxValueState = 'missing';
  for (const child of node.children) {
    if (!t.isJSXElement(child)) continue;
    const name = getJsxTagName(child.openingElement);
    if (name !== 'title') continue;
    const titleState = mergeStates(child.children.map(jsxChildTextState));
    if (titleState === 'present') return 'present';
    if (titleState === 'possiblyEmpty') state = 'possiblyEmpty';
    if (titleState === 'empty' && state === 'missing') state = 'empty';
  }
  return state;
}

function hasJsxRoleImg(opening: t.JSXOpeningElement): boolean {
  const roleAttr = getJsxAttribute(opening, 'role');
  if (!roleAttr || !roleAttr.value) return false;
  let value: string | null = null;
  if (t.isStringLiteral(roleAttr.value)) value = roleAttr.value.value;
  if (t.isJSXExpressionContainer(roleAttr.value)) {
    const expr = roleAttr.value.expression;
    if (t.isStringLiteral(expr)) value = expr.value;
  }
  if (!value) return false;
  return value
    .split(/\s+/)
    .some((token) => token.trim().toLowerCase() === 'img');
}

function isIgnorableJsxChild(child: JsxChild): boolean {
  if (t.isJSXText(child)) return child.value.trim().length === 0;
  if (t.isJSXExpressionContainer(child)) {
    return getJsxExpressionState(child.expression, true) === 'empty';
  }
  if (t.isJSXFragment(child)) {
    return child.children.every(isIgnorableJsxChild);
  }
  return false;
}

function isJsxIconOnlyParent(parent: t.JSXElement): boolean {
  const meaningful = parent.children.filter((child) => !isIgnorableJsxChild(child));
  if (meaningful.length !== 1) return false;
  const only = meaningful[0];
  return t.isJSXElement(only) && getJsxTagName(only.openingElement) === 'svg';
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
      if (mergeStates(target.children.map(jsxChildTextState)) === 'present') return true;
    }
  }
  return false;
}

function getJsxLabelledByState(
  opening: t.JSXOpeningElement,
  idMap: Map<string, t.JSXElement[]>
): JsxValueState {
  const attrState = getJsxAttributeState(opening, 'aria-labelledby', true);
  if (attrState === 'missing') return 'missing';
  const labelledBy = getStaticJsxAttrText(opening, 'aria-labelledby');
  if (labelledBy === undefined) return attrState;
  if (labelledBy === null) return attrState;
  if (labelledBy.trim().length === 0) return 'empty';
  return hasJsxAriaLabelledByText(opening, idMap) ? 'present' : 'empty';
}

export default function requireAltText(): Rule {
  const htmlIds = new Map<string, ElementNode[]>();
  const htmlSvgs: HtmlSvgEntry[] = [];
  const htmlStack: ElementNode[] = [];

  const jsxIds = new Map<string, t.JSXElement[]>();
  const jsxSvgs: JsxSvgEntry[] = [];

  return {
    name: 'requireAltText',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        const parent = htmlStack.length ? htmlStack[htmlStack.length - 1] : null;
        htmlStack.push(node);
        const id = node.attrs.id;
        if (id && id.trim().length > 0) {
          const trimmedId = id.trim();
          if (!htmlIds.has(trimmedId)) htmlIds.set(trimmedId, []);
          htmlIds.get(trimmedId)!.push(node);
        }
        if (node.tagName === 'img') {
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
        if (node.tagName === 'svg') {
          htmlSvgs.push({ node, parent });
        }
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        htmlStack.pop();
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
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = getJsxTagName(opening);
      const id = getStaticJsxAttrText(opening, 'id');
      if (typeof id === 'string' && id.trim().length > 0) {
        const trimmedId = id.trim();
        if (!jsxIds.has(trimmedId)) jsxIds.set(trimmedId, []);
        jsxIds.get(trimmedId)!.push(path.node);
      }
      if (tag === 'svg') {
        const parentPath = path.findParent((p) => p.isJSXElement()) as
          | NodePath<t.JSXElement>
          | null;
        const line = (opening.loc?.start.line ?? 1) - 1;
        const column = opening.loc?.start.column ?? 0;
        jsxSvgs.push({
          node: path.node,
          parent: parentPath ? parentPath.node : null,
          line,
          column,
        });
      }
      return [];
    },
    end(): LintResult[] {
      const results: LintResult[] = [];

      for (const { node, parent } of htmlSvgs) {
        if (isHtmlHidden(node)) continue;
        const roleImg = hasHtmlRoleImg(node);
        const iconOnly =
          parent &&
          (parent.tagName === 'a' || parent.tagName === 'button') &&
          isHtmlIconOnlyParent(parent, node);
        if (!roleImg && !iconOnly) continue;
        if (!hasHtmlSvgAccessibleName(node, htmlIds)) {
          results.push({
            line: 0,
            column: 0,
            message: '<svg> missing accessible name',
            rule: 'requireAltText',
          });
        }
      }

      for (const { node, parent, line, column } of jsxSvgs) {
        const opening = node.openingElement;
        if (isJsxHiddenFromAT(opening)) continue;
        const roleImg = hasJsxRoleImg(opening);
        const iconOnly =
          parent &&
          (getJsxTagName(parent.openingElement) === 'a' ||
            getJsxTagName(parent.openingElement) === 'button') &&
          isJsxIconOnlyParent(parent);
        if (!roleImg && !iconOnly) continue;

        const ariaState = getJsxAttributeState(opening, 'aria-label', true);
        const labelledByState = getJsxLabelledByState(opening, jsxIds);
        const titleState = jsxTitleState(node);
        const nameState = mergeStates([ariaState, labelledByState, titleState]);
        if (nameState !== 'present') {
          const message =
            nameState === 'possiblyEmpty'
              ? '<svg> accessible name is possibly empty or undefined'
              : '<svg> missing accessible name';
          results.push({
            line,
            column,
            message,
            rule: 'requireAltText',
          });
        }
      }

      return results;
    },
  };
}
