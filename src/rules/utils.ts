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

export function isJsxExpressionPossiblyEmpty(
  expression: t.Expression | t.JSXEmptyExpression,
  trimText: boolean
): boolean {
  if (t.isJSXEmptyExpression(expression)) return true;
  if (t.isNullLiteral(expression)) return true;
  if (t.isIdentifier(expression, { name: 'undefined' })) return true;
  if (t.isBooleanLiteral(expression)) return true;
  if (t.isOptionalMemberExpression(expression) || t.isOptionalCallExpression(expression)) {
    return true;
  }
  if (t.isStringLiteral(expression)) {
    return isEmptyString(expression.value, trimText);
  }
  if (t.isTemplateLiteral(expression)) {
    if (expression.expressions.length === 0) {
      const raw = expression.quasis
        .map((q) => q.value.cooked ?? q.value.raw)
        .join('');
      return isEmptyString(raw, trimText);
    }
    const staticText = expression.quasis
      .map((q) => q.value.cooked ?? q.value.raw)
      .join('');
    if (staticText.trim().length > 0) return false;
    return false;
  }
  if (t.isConditionalExpression(expression)) {
    return (
      isJsxExpressionPossiblyEmpty(expression.consequent, trimText) ||
      isJsxExpressionPossiblyEmpty(expression.alternate, trimText)
    );
  }
  if (t.isLogicalExpression(expression)) {
    if (expression.operator === '&&') {
      return (
        isJsxExpressionPossiblyEmpty(expression.left, trimText) ||
        isJsxExpressionPossiblyEmpty(expression.right, trimText)
      );
    }
    if (expression.operator === '||' || expression.operator === '??') {
      return (
        isJsxExpressionPossiblyEmpty(expression.left, trimText) &&
        isJsxExpressionPossiblyEmpty(expression.right, trimText)
      );
    }
  }
  if (t.isUnaryExpression(expression) && expression.operator === 'void') return true;
  return false;
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

export function getTag(path: NodePath<t.JSXElement>): string {
  const opening = path.node.openingElement;
  return t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
}
