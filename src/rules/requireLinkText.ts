import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getTag, isJsxExpressionPossiblyEmpty } from "./utils";

type JsxChild = t.JSXElement["children"][number];

function jsxChildHasText(child: JsxChild): boolean {
  if (t.isJSXText(child)) return child.value.trim().length > 0;
  if (t.isJSXExpressionContainer(child)) {
    const expr = child.expression;
    if (t.isJSXElement(expr)) return jsxElementHasText(expr);
    if (t.isJSXFragment(expr)) return expr.children.some(jsxChildHasText);
    return !isJsxExpressionPossiblyEmpty(expr, true);
  }
  if (t.isJSXElement(child)) return jsxElementHasText(child);
  if (t.isJSXFragment(child)) return child.children.some(jsxChildHasText);
  if (t.isJSXSpreadChild(child)) return true;
  return false;
}

function jsxElementHasText(node: t.JSXElement): boolean {
  return node.children.some(jsxChildHasText);
}

export default function requireLinkText(): Rule {
  const stack: Array<{ found: boolean }> = [];
  return {
    name: "requireLinkText",
    enterHtml(node: Node): LintResult[] {
      if (node.type === "element" && node.tagName === "a") {
        stack.push({ found: false });
      } else if (node.type === "text") {
        if (stack.length && node.text.trim())
          stack[stack.length - 1].found = true;
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === "element" && node.tagName === "a") {
        const entry = stack.pop();
        if (entry && !entry.found)
          return [
            {
              line: 0,
              column: 0,
              message: "<a> tag missing link text",
              rule: "requireLinkText",
            },
          ];
      }
      return [];
    },
    enterJsx(_: NodePath<t.JSXElement>): LintResult[] {
      return [];
    },
    exitJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === "a") {
        const hasText = jsxElementHasText(path.node);
        if (!hasText) {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          return [
            {
              line,
              column,
              message: "<a> tag missing link text",
              rule: "requireLinkText",
            },
          ];
        }
      }
      return [];
    },
  };
}
