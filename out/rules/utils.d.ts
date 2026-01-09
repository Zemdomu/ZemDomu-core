import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ElementNode } from '../simpleHtmlParser';
export declare function getAttr(node: ElementNode, name: string): string | undefined;
export declare function getJsxAttr(opening: t.JSXOpeningElement, name: string): string | undefined;
export declare function getTag(path: NodePath<t.JSXElement>): string;
