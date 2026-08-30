import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ElementNode, Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import {
  getJsxAttr,
  getJsxAttributeState,
  getJsxExpressionState,
  JsxValueState,
  getTag,
} from './utils';

type HtmlSection = { node: ElementNode; hasHeading: boolean };
type JsxSection = { node: t.JSXElement; hasHeading: boolean; line: number; column: number };

function isHiddenStyle(style?: string): boolean {
  if (!style) return false;
  const normalized = style.toLowerCase().replace(/\s+/g, '');
  return (
    normalized.includes('display:none') ||
    normalized.includes('visibility:hidden') ||
    normalized.includes('visibility:collapse')
  );
}

function isHtmlHidden(node: ElementNode): boolean {
  if (Object.prototype.hasOwnProperty.call(node.attrs, 'hidden')) return true;
  const ariaHidden = node.attrs['aria-hidden'];
  if (typeof ariaHidden === 'string' && ariaHidden.trim().toLowerCase() === 'true') {
    return true;
  }
  return isHiddenStyle(node.attrs.style);
}

function htmlImgAltPresent(node: ElementNode): boolean {
  const alt = node.attrs.alt;
  return typeof alt === 'string' && alt.trim().length > 0;
}

function hasHtmlAccessibleText(node: Node, hidden: boolean): boolean {
  if (hidden) return false;
  if (node.type === 'text') return node.text.trim().length > 0;
  if (node.type === 'element') {
    const isHidden = hidden || isHtmlHidden(node);
    if (isHidden) return false;
    if (node.tagName === 'img') return htmlImgAltPresent(node);
    return node.children.some((child) => hasHtmlAccessibleText(child, isHidden));
  }
  return false;
}

function hasHtmlAriaLabel(node: ElementNode): boolean {
  const aria = node.attrs['aria-label'];
  return typeof aria === 'string' && aria.trim().length > 0;
}

function hasHtmlAriaLabelledByText(
  node: ElementNode,
  idMap: Map<string, ElementNode[]>
): boolean {
  const labelledBy = node.attrs['aria-labelledby'];
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

function isJsxHidden(opening: t.JSXOpeningElement): boolean {
  const hiddenAttr = getJsxAttr(opening, 'hidden');
  if (hiddenAttr !== undefined) return true;
  const ariaHidden = getJsxAttr(opening, 'aria-hidden');
  if (ariaHidden && ariaHidden.trim().toLowerCase() === 'true') return true;
  const style = getJsxAttr(opening, 'style');
  if (style) return isHiddenStyle(style);
  return false;
}

type JsxChild = t.JSXElement['children'][number];

function mergeStates(states: JsxValueState[]): JsxValueState {
  if (states.some((s) => s === 'present')) return 'present';
  if (states.some((s) => s === 'possiblyEmpty')) return 'possiblyEmpty';
  return 'empty';
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
  const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
  const hidden = parentHidden || isJsxHidden(opening);
  if (hidden) return 'empty';
  if (tag === 'img') {
    const alt = getJsxAttr(opening, 'alt');
    return alt && alt.trim().length > 0 ? 'present' : 'empty';
  }
  return mergeStates(node.children.map((c) => jsxChildTextState(c, hidden)));
}

function hasJsxAriaLabelledByText(
  opening: t.JSXOpeningElement,
  idMap: Map<string, t.JSXElement[]>
): boolean {
  const labelledBy = getJsxAttr(opening, 'aria-labelledby');
  if (!labelledBy) return false;
  const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return false;
  for (const id of ids) {
    const targets = idMap.get(id);
    if (!targets) continue;
    for (const target of targets) {
      if (jsxElementTextState(target, false) === 'present') return true;
    }
  }
  return false;
}

export default function requireSectionHeading(): Rule {
  const htmlIdMap = new Map<string, ElementNode[]>();
  const htmlStack: HtmlSection[] = [];
  const htmlSections: HtmlSection[] = [];

  const jsxIdMap = new Map<string, t.JSXElement[]>();
  const jsxStack: JsxSection[] = [];
  const jsxSections: JsxSection[] = [];

  return {
    name: 'requireSectionHeading',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        const id = node.attrs.id;
        if (id && id.trim()) {
          const trimmed = id.trim();
          if (!htmlIdMap.has(trimmed)) htmlIdMap.set(trimmed, []);
          htmlIdMap.get(trimmed)!.push(node);
        }
        if (node.tagName === 'section') htmlStack.push({ node, hasHeading: false });
        if (/^h[1-6]$/i.test(node.tagName) && htmlStack.length) {
          htmlStack[htmlStack.length - 1].hasHeading = true;
        }
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'section') {
        const s = htmlStack.pop();
        if (s) htmlSections.push(s);
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = getTag(path);
      const id = getJsxAttr(opening, 'id');
      if (id && id.trim()) {
        const trimmed = id.trim();
        if (!jsxIdMap.has(trimmed)) jsxIdMap.set(trimmed, []);
        jsxIdMap.get(trimmed)!.push(path.node);
      }
      if (tag === 'section') {
        const line = (opening.loc?.start.line ?? 1) - 1;
        const column = opening.loc?.start.column ?? 0;
        jsxStack.push({ node: path.node, hasHeading: false, line, column });
      }
      if (/^h[1-6]$/.test(tag) && jsxStack.length) {
        jsxStack[jsxStack.length - 1].hasHeading = true;
      }
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'section') {
        const s = jsxStack.pop();
        if (s) jsxSections.push(s);
      }
      return [];
    },
    end(): LintResult[] {
      const results: LintResult[] = [];
      for (const section of htmlSections) {
        if (section.hasHeading) continue;
        if (hasHtmlAriaLabel(section.node)) continue;
        if (hasHtmlAriaLabelledByText(section.node, htmlIdMap)) continue;
        results.push({
          line: 0,
          column: 0,
          offset: section.node.startIndex,
          message:
            '<section> missing heading (<h1>-<h6>) or accessible label (aria-label / aria-labelledby)',
          rule: 'requireSectionHeading',
        });
      }
      for (const section of jsxSections) {
        if (section.hasHeading) continue;
        const opening = section.node.openingElement;
        const ariaState = getJsxAttributeState(opening, 'aria-label', true);
        if (ariaState === 'present' || ariaState === 'possiblyEmpty') continue;
        if (hasJsxAriaLabelledByText(opening, jsxIdMap)) continue;
        results.push({
          line: section.line,
          column: section.column,
          offset: section.node.openingElement.start ?? undefined,
          message:
            '<section> missing heading (<h1>-<h6>) or accessible label (aria-label / aria-labelledby)',
          rule: 'requireSectionHeading',
        });
      }
      return results;
    },
  };
}
