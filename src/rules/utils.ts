import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { Node, ElementNode } from '../simpleHtmlParser';

export function getAttr(node: ElementNode, name: string): string | undefined {
  return node.attrs[name];
}

export function getJsxAttr(
  opening: t.JSXOpeningElement,
  name: string
): string | undefined {
  const attr = opening.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name
  );
  return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
}

export function getJsxAttribute(
  opening: t.JSXOpeningElement,
  name: string
): t.JSXAttribute | undefined {
  return opening.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name
  );
}

function isEmptyString(value: string, trimText: boolean): boolean {
  return trimText ? value.trim().length === 0 : value.length === 0;
}

export type JsxValueState = 'missing' | 'empty' | 'possiblyEmpty' | 'present';

function mergeConditionalStates(
  a: JsxValueState,
  b: JsxValueState
): JsxValueState {
  if (a === 'present' && b === 'present') return 'present';
  if (a === 'empty' && b === 'empty') return 'empty';
  return 'possiblyEmpty';
}

function mergeTemplateStates(states: JsxValueState[]): JsxValueState {
  if (states.some((s) => s === 'present')) return 'present';
  if (states.some((s) => s === 'possiblyEmpty')) return 'possiblyEmpty';
  return 'empty';
}

export function getJsxExpressionState(
  expression: t.Expression | t.TSType | t.JSXEmptyExpression,
  trimText: boolean
): JsxValueState {
  if (t.isTSType(expression)) return 'present';
  if (t.isJSXEmptyExpression(expression)) return 'empty';
  if (t.isNullLiteral(expression)) return 'empty';
  if (t.isIdentifier(expression, { name: 'undefined' })) return 'empty';
  if (t.isBooleanLiteral(expression)) return 'empty';
  if (t.isOptionalMemberExpression(expression) || t.isOptionalCallExpression(expression)) {
    return 'possiblyEmpty';
  }
  if (t.isStringLiteral(expression)) {
    return isEmptyString(expression.value, trimText) ? 'empty' : 'present';
  }
  if (t.isTemplateLiteral(expression)) {
    if (expression.expressions.length === 0) {
      const raw = expression.quasis
        .map((q) => q.value.cooked ?? q.value.raw)
        .join('');
      return isEmptyString(raw, trimText) ? 'empty' : 'present';
    }
    const staticText = expression.quasis
      .map((q) => q.value.cooked ?? q.value.raw)
      .join('');
    if (staticText.trim().length > 0) return 'present';
    const exprStates = expression.expressions.map((expr) =>
      getJsxExpressionState(expr, trimText)
    );
    return mergeTemplateStates(exprStates);
  }
  if (t.isConditionalExpression(expression)) {
    return mergeConditionalStates(
      getJsxExpressionState(expression.consequent, trimText),
      getJsxExpressionState(expression.alternate, trimText)
    );
  }
  if (t.isLogicalExpression(expression)) {
    const left = getJsxExpressionState(expression.left, trimText);
    if (expression.operator === '&&') {
      if (left === 'empty') return 'empty';
      if (left === 'present') {
        return getJsxExpressionState(expression.right, trimText);
      }
      return 'possiblyEmpty';
    }
    if (expression.operator === '||' || expression.operator === '??') {
      if (left === 'present') return 'present';
      if (left === 'empty') {
        return getJsxExpressionState(expression.right, trimText);
      }
      const right = getJsxExpressionState(expression.right, trimText);
      if (right === 'present') return 'present';
      return 'possiblyEmpty';
    }
  }
  if (t.isUnaryExpression(expression) && expression.operator === 'void') return 'empty';
  return 'present';
}

export function isJsxExpressionPossiblyEmpty(
  expression: t.Expression | t.JSXEmptyExpression,
  trimText: boolean
): boolean {
  return getJsxExpressionState(expression, trimText) !== 'present';
}

export function isJsxAttrValueEmpty(
  value: t.JSXAttribute['value'],
  trimText: boolean
): boolean {
  if (!value) return true;
  if (t.isStringLiteral(value)) {
    return isEmptyString(value.value, trimText);
  }
  if (t.isJSXExpressionContainer(value)) {
    return isJsxExpressionPossiblyEmpty(value.expression, trimText);
  }
  return false;
}

export function getJsxAttributeState(
  opening: t.JSXOpeningElement,
  name: string,
  trimText: boolean
): JsxValueState {
  const attr = getJsxAttribute(opening, name);
  if (!attr) return 'missing';
  if (!attr.value) return 'empty';
  if (t.isStringLiteral(attr.value)) {
    return isEmptyString(attr.value.value, trimText) ? 'empty' : 'present';
  }
  if (t.isJSXExpressionContainer(attr.value)) {
    return getJsxExpressionState(attr.value.expression, trimText);
  }
  return 'present';
}

const LINK_ATTRS = ['href', 'to', ':href', 'v-bind:href', ':to', 'v-bind:to'];

function isPresentState(state: JsxValueState): boolean {
  return state !== 'missing' && state !== 'empty';
}

export function hasHtmlLinkAttribute(attrs: Record<string, string>): boolean {
  for (const key of LINK_ATTRS) {
    if (!(key in attrs)) continue;
    const value = attrs[key];
    if (typeof value !== 'string') return true;
    if (value.trim().length > 0) return true;
  }
  return false;
}

export function hasJsxLinkAttribute(opening: t.JSXOpeningElement): boolean {
  const hrefState = getJsxAttributeState(opening, 'href', true);
  const toState = getJsxAttributeState(opening, 'to', true);
  return isPresentState(hrefState) || isPresentState(toState);
}

export function getTag(path: NodePath<t.JSXElement>): string {
  const opening = path.node.openingElement;
  return t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
}

function locKey(loc?: t.SourceLocation['start']): string {
  if (!loc) return '0:0';
  return `${loc.line}:${loc.column}`;
}

export function getJsxRenderGroup(path: NodePath<t.Node>): string {
  const returnPath = path.findParent((p) => p.isReturnStatement()) as
    | NodePath<t.ReturnStatement>
    | null;
  let baseGroup: string | null = null;
  if (returnPath) {
    baseGroup = `return:${locKey(returnPath.node.loc?.start)}`;
  }

  const arrowPath = path.findParent((p) => p.isArrowFunctionExpression()) as
    | NodePath<t.ArrowFunctionExpression>
    | null;
  if (arrowPath) {
    const body = arrowPath.node.body;
    if (t.isJSXElement(body) || t.isJSXFragment(body)) {
      const loc = body.loc?.start ?? arrowPath.node.loc?.start;
      baseGroup = `return:${locKey(loc)}`;
    }
  }

  if (!baseGroup) baseGroup = 'root';

  const segments: string[] = [];
  let current: NodePath<t.Node> | null = path;
  while (current?.parentPath) {
    const parentPath = current.parentPath;
    if (parentPath.isConditionalExpression()) {
      const conditional = parentPath.node;
      const inConsequent =
        current.node === conditional.consequent ||
        !!current.findParent((p) => p.node === conditional.consequent);
      const inAlternate =
        current.node === conditional.alternate ||
        !!current.findParent((p) => p.node === conditional.alternate);
      if (inConsequent || inAlternate) {
        const branch = inConsequent ? "then" : "else";
        segments.push(`cond:${locKey(conditional.loc?.start)}:${branch}`);
      }
    }
    current = parentPath as NodePath<t.Node>;
  }

  if (!segments.length) return baseGroup;
  return `${baseGroup}|${segments.reverse().join("|")}`;
}
