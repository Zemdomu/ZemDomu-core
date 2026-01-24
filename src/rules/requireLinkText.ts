import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getTag, getJsxExpressionState, JsxValueState } from "./utils";

type JsxChild = t.JSXElement["children"][number];

function mergeTextStates(states: JsxValueState[]): JsxValueState {
  if (states.some((s) => s === "present")) return "present";
  if (states.some((s) => s === "possiblyEmpty")) return "possiblyEmpty";
  return "empty";
}

function jsxChildTextState(child: JsxChild): JsxValueState {
  if (t.isJSXText(child)) return child.value.trim().length > 0 ? "present" : "empty";
  if (t.isJSXExpressionContainer(child)) {
    const expr = child.expression;
    if (t.isJSXElement(expr)) return jsxElementTextState(expr);
    if (t.isJSXFragment(expr)) {
      return mergeTextStates(expr.children.map(jsxChildTextState));
    }
    return getJsxExpressionState(expr, true);
  }
  if (t.isJSXElement(child)) return jsxElementTextState(child);
  if (t.isJSXFragment(child)) {
    return mergeTextStates(child.children.map(jsxChildTextState));
  }
  if (t.isJSXSpreadChild(child)) return "present";
  return "empty";
}

function jsxElementTextState(node: t.JSXElement): JsxValueState {
  return mergeTextStates(node.children.map(jsxChildTextState));
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
        const textState = jsxElementTextState(path.node);
        if (textState !== "present") {
          const line = (path.node.loc?.start.line ?? 1) - 1;
          const column = path.node.loc?.start.column ?? 0;
          const message =
            textState === "possiblyEmpty"
              ? "<a> link text is possibly empty or undefined"
              : "<a> tag missing link text";
          return [
            {
              line,
              column,
              message,
              rule: "requireLinkText",
            },
          ];
        }
      }
      return [];
    },
  };
}
