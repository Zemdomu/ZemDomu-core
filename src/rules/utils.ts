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

export function getTag(path: NodePath<t.JSXOpeningElement>): string {
  return t.isJSXIdentifier(path.node.name) ? path.node.name.name.toLowerCase() : '';
}
