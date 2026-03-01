import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getJsxExpressionState, getTag } from "./utils";

function collectText(node: Node): string {
  if (node.type === "text") return node.text;
  if (node.type !== "element") return "";
  return node.children.map(collectText).join("");
}

function jsxTitleHasContent(children: t.JSXElement["children"]): boolean {
  for (const child of children) {
    if (t.isJSXText(child)) {
      if (child.value.trim().length > 0) return true;
      continue;
    }
    if (t.isJSXExpressionContainer(child)) {
      const state = getJsxExpressionState(child.expression, true);
      if (state !== "empty") return true;
      continue;
    }
    if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      return true;
    }
  }
  return false;
}

export default function requireDocumentTitle(): Rule {
  let seenHtml = false;
  let seenTitle = false;
  let hasNonEmptyTitle = false;
  let htmlLoc: { line: number; column: number } = { line: 0, column: 0 };
  let titleLoc: { line: number; column: number } | null = null;

  return {
    name: "requireDocumentTitle",

    enterHtml(node: Node): LintResult[] {
      if (node.type !== "element") return [];
      if (node.tagName === "html") {
        seenHtml = true;
      } else if (node.tagName === "title") {
        seenTitle = true;
        if (!titleLoc) titleLoc = { line: 0, column: 0 };
        if (collectText(node).trim().length > 0) {
          hasNonEmptyTitle = true;
        }
      }
      return [];
    },

    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === "html") {
        seenHtml = true;
        htmlLoc = {
          line: (path.node.loc?.start.line ?? 1) - 1,
          column: path.node.loc?.start.column ?? 0,
        };
        return [];
      }
      if (tag === "title") {
        seenTitle = true;
        if (!titleLoc) {
          titleLoc = {
            line: (path.node.loc?.start.line ?? 1) - 1,
            column: path.node.loc?.start.column ?? 0,
          };
        }
        if (jsxTitleHasContent(path.node.children)) {
          hasNonEmptyTitle = true;
        }
      }
      return [];
    },

    end(): LintResult[] {
      if (!seenHtml) return [];

      if (!seenTitle) {
        return [
          {
            line: htmlLoc.line,
            column: htmlLoc.column,
            message: "Document missing non-empty <title> in <head>",
            rule: "requireDocumentTitle",
          },
        ];
      }

      if (!hasNonEmptyTitle) {
        const loc = titleLoc ?? htmlLoc;
        return [
          {
            line: loc.line,
            column: loc.column,
            message: "<title> element must not be empty",
            rule: "requireDocumentTitle",
          },
        ];
      }

      return [];
    },
  };
}

