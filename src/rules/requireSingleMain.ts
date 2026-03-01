import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getTag } from "./utils";

type SourceLoc = { line: number; column: number };

export default function requireSingleMain(): Rule {
  let seenHtml = false;
  let mainCount = 0;
  let htmlLoc: SourceLoc = { line: 0, column: 0 };
  let duplicateLoc: SourceLoc = { line: 0, column: 0 };

  return {
    name: "requireSingleMain",

    enterHtml(node: Node): LintResult[] {
      if (node.type !== "element") return [];
      if (node.tagName === "html") {
        seenHtml = true;
      } else if (node.tagName === "main") {
        mainCount += 1;
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
      } else if (tag === "main") {
        mainCount += 1;
        if (mainCount === 2) {
          duplicateLoc = {
            line: (path.node.loc?.start.line ?? 1) - 1,
            column: path.node.loc?.start.column ?? 0,
          };
        }
      }
      return [];
    },

    end(): LintResult[] {
      if (mainCount > 1) {
        return [
          {
            line: duplicateLoc.line,
            column: duplicateLoc.column,
            message: "Only one <main> landmark allowed per document",
            rule: "requireSingleMain",
          },
        ];
      }

      if (seenHtml && mainCount === 0) {
        return [
          {
            line: htmlLoc.line,
            column: htmlLoc.column,
            message: "Document missing <main> landmark",
            rule: "requireSingleMain",
          },
        ];
      }

      return [];
    },
  };
}

