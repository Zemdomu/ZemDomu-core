import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ElementNode, Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import {
  getJsxAttr,
  getJsxAttribute,
  getJsxAttributeState,
  getJsxExpressionState,
  JsxValueState,
} from './utils';

const FORM_CONTROLS = ['input', 'select', 'textarea'];

type HtmlControl = { node: ElementNode; implicitLabel?: ElementNode };
type JsxControl = {
  node: t.JSXElement;
  line: number;
  column: number;
  implicitLabel?: t.JSXElement;
};

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
  const hidden = getJsxAttribute(opening, 'hidden');
  if (hidden) {
    if (!hidden.value) return true;
    if (t.isJSXExpressionContainer(hidden.value)) {
      const expression = hidden.value.expression;
      if (t.isBooleanLiteral(expression)) return expression.value;
      if (t.isNullLiteral(expression)) return false;
      if (t.isIdentifier(expression, { name: 'undefined' })) return false;
    }
    return true;
  }
  const ariaHidden = getJsxAttr(opening, 'aria-hidden');
  if (ariaHidden && ariaHidden.trim().toLowerCase() === 'true') return true;
  const style = getJsxAttr(opening, 'style');
  if (style) return isHiddenStyle(style);
  return false;
}

function getStaticJsxString(
  opening: t.JSXOpeningElement,
  name: string
): string | undefined {
  const attribute = getJsxAttribute(opening, name);
  if (!attribute?.value) return undefined;
  if (t.isStringLiteral(attribute.value)) return attribute.value.value;
  if (!t.isJSXExpressionContainer(attribute.value)) return undefined;
  const expression = attribute.value.expression;
  if (t.isStringLiteral(expression)) return expression.value;
  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    return expression.quasis
      .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
      .join('');
  }
  return undefined;
}

function isHtmlInputExempt(node: ElementNode): boolean {
  if (node.tagName !== 'input') return false;
  if (isHtmlHidden(node)) return true;
  const type = (node.attrs.type ?? 'text').trim().toLowerCase();
  if (type === 'hidden') return true;
  if (type === 'image') return Boolean(node.attrs.alt?.trim());
  if (type === 'submit' || type === 'reset') {
    return node.attrs.value === undefined || node.attrs.value.trim().length > 0;
  }
  return type === 'button' && Boolean(node.attrs.value?.trim());
}

function isJsxInputExempt(opening: t.JSXOpeningElement): boolean {
  const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
  if (tag !== 'input') return false;
  if (isJsxHidden(opening)) return true;
  const type = (getStaticJsxString(opening, 'type') ?? 'text')
    .trim()
    .toLowerCase();
  if (type === 'hidden') return true;
  if (type === 'image') return getJsxAttributeState(opening, 'alt', true) === 'present';
  const valueState = getJsxAttributeState(opening, 'value', true);
  if (type === 'submit' || type === 'reset') {
    return valueState === 'missing' || valueState === 'present';
  }
  return type === 'button' && valueState === 'present';
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
  const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
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

export default function requireLabelForFormControls(): Rule {
  const htmlLabels = new Set<string>();
  const htmlIds = new Map<string, ElementNode[]>();
  const htmlControls: HtmlControl[] = [];
  const htmlLabelStack: ElementNode[] = [];

  const jsxLabels = new Set<string>();
  const jsxIds = new Map<string, t.JSXElement[]>();
  const jsxControls: JsxControl[] = [];

  return {
    name: 'requireLabelForFormControls',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        const id = node.attrs.id;
        if (id && id.trim()) {
          const trimmedId = id.trim();
          if (!htmlIds.has(trimmedId)) htmlIds.set(trimmedId, []);
          htmlIds.get(trimmedId)!.push(node);
        }
        if (node.tagName === 'label') {
          htmlLabelStack.push(node);
          const htmlFor = node.attrs['for'];
          if (htmlFor && htmlFor.trim()) htmlLabels.add(htmlFor.trim());
        }
        if (FORM_CONTROLS.includes(node.tagName)) {
          htmlControls.push({
            node,
            implicitLabel: htmlLabelStack[htmlLabelStack.length - 1],
          });
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
      if (tag === 'label') {
        const htmlFor = getJsxAttr(opening, 'htmlFor') ?? getJsxAttr(opening, 'for');
        if (htmlFor && htmlFor.trim()) jsxLabels.add(htmlFor.trim());
      }
      const id = getJsxAttr(opening, 'id');
      if (id && id.trim()) {
        const trimmedId = id.trim();
        if (!jsxIds.has(trimmedId)) jsxIds.set(trimmedId, []);
        jsxIds.get(trimmedId)!.push(path.node);
      }
      if (FORM_CONTROLS.includes(tag)) {
        const line = (opening.loc?.start.line ?? 1) - 1;
        const column = opening.loc?.start.column ?? 0;
        const labelPath = path.findParent(
          (parent) =>
            parent.isJSXElement() &&
            t.isJSXIdentifier(parent.node.openingElement.name) &&
            parent.node.openingElement.name.name.toLowerCase() === 'label'
        );
        jsxControls.push({
          node: path.node,
          line,
          column,
          implicitLabel: labelPath?.isJSXElement() ? labelPath.node : undefined,
        });
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element' && node.tagName === 'label') htmlLabelStack.pop();
      return [];
    },
    end(): LintResult[] {
      const results: LintResult[] = [];

      for (const { node, implicitLabel } of htmlControls) {
        if (
          (implicitLabel && hasHtmlAccessibleText(implicitLabel, false)) ||
          isHtmlInputExempt(node)
        ) continue;
        const aria = node.attrs['aria-label'];
        if (aria && aria.trim()) continue;
        if (hasHtmlAriaLabelledByText(node, htmlIds)) continue;

        const id = node.attrs.id;
        if (!id || !id.trim()) {
          results.push({
            line: 0,
            column: 0,
            offset: node.startIndex,
            message: 'Form control missing id or aria-label',
            rule: 'requireLabelForFormControls',
          });
          continue;
        }
        if (!htmlLabels.has(id)) {
          results.push({
            line: 0,
            column: 0,
            offset: node.startIndex,
            message: `Form control with id="${id}" missing <label for="${id}">`,
            rule: 'requireLabelForFormControls',
          });
        }
      }

      for (const entry of jsxControls) {
        const opening = entry.node.openingElement;
        if (
          (entry.implicitLabel &&
            jsxElementTextState(entry.implicitLabel, false) === 'present') ||
          isJsxInputExempt(opening)
        ) continue;
        const ariaState = getJsxAttributeState(opening, 'aria-label', true);
        if (ariaState === 'present') continue;
        if (hasJsxAriaLabelledByText(opening, jsxIds)) continue;

        const id = getJsxAttr(opening, 'id');
        if (!id || !id.trim()) {
          results.push({
            line: entry.line,
            column: entry.column,
            offset: opening.start ?? undefined,
            message: 'Form control missing id or aria-label',
            rule: 'requireLabelForFormControls',
          });
          continue;
        }
        if (!jsxLabels.has(id)) {
          results.push({
            line: entry.line,
            column: entry.column,
            offset: opening.start ?? undefined,
            message: `Form control with id="${id}" missing <label for="${id}">`,
            rule: 'requireLabelForFormControls',
          });
        }
      }
      return results;
    },
  };
}
