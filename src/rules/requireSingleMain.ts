import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getTag } from "./utils";

type SourceLoc = { line: number; column: number; offset?: number };

export default function requireSingleMain(): Rule {
  let seenHtml = false;
  let mainCount = 0;
  let htmlLoc: SourceLoc = { line: 0, column: 0 };
  const duplicateLocs: SourceLoc[] = [];

  return {
    name: "requireSingleMain",

    enterHtml(node: Node): LintResult[] {
      if (node.type !== "element") return [];
      if (node.tagName === "html") {
        seenHtml = true;
        htmlLoc = { line: 0, column: 0, offset: node.startIndex };
      } else if (node.tagName === "main") {
        mainCount += 1;
        if (mainCount > 1) {
          duplicateLocs.push({ line: 0, column: 0, offset: node.startIndex });
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
          offset: path.node.openingElement.start ?? undefined,
        };
      } else if (tag === "main") {
        mainCount += 1;
        if (mainCount > 1) {
          duplicateLocs.push({
            line: (path.node.loc?.start.line ?? 1) - 1,
            column: path.node.loc?.start.column ?? 0,
            offset: path.node.openingElement.start ?? undefined,
          });
        }
      }
      return [];
    },

    end(): LintResult[] {
      if (mainCount > 1) {
        return duplicateLocs.map((location) => ({
          line: location.line,
          column: location.column,
          offset: location.offset,
          message: "Only one <main> landmark allowed per document",
          rule: "requireSingleMain",
        }));
      }

      if (seenHtml && mainCount === 0) {
        return [
          {
            line: htmlLoc.line,
            column: htmlLoc.column,
            offset: htmlLoc.offset,
            message: "Document missing <main> landmark",
            rule: "requireSingleMain",
          },
        ];
      }

      return [];
    },
  };
}
