import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";
import { getTag } from "./utils";
import {
  isResolvedPage,
  isUnconditional,
  matchingFileResult,
  sourceForFact,
} from "./page-utils";

/**
 * Enforce heading order by detecting skipped levels when opening subsections.
 *
 * Flags:
 *  - Upward skip:   h2 -> h4 (new > last + 1)
 * First heading in a file never warns.
 * Returning to a lower rank closes subsections and is valid (for example h4 -> h2).
 */
export default function enforceHeadingOrder(): Rule {
  let last = 0; // 0 means “no heading seen yet”

  return {
    name: "enforceHeadingOrder",

    init() {
      last = 0;
    },

    enterHtml(node: Node): LintResult[] {
      if (!(node.type === "element" && /^h[1-6]$/.test(node.tagName)))
        return [];

      const lvl = parseInt(node.tagName[1], 10);
      const msg = computeMessage(lvl, last, node.tagName);

      last = lvl;

      if (!msg) return [];
      return [
        {
          line: 0,
          column: 0,
          offset: node.startIndex,
          message: msg,
          rule: "enforceHeadingOrder",
        },
      ];
    },

    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (!/^h[1-6]$/.test(tag)) return [];

      const lvl = parseInt(tag[1], 10);
      const msg = computeMessage(lvl, last, tag);

      last = lvl;

      if (!msg) return [];

      const line = (path.node.loc?.start.line ?? 1) - 1; // VS Code is 0-based
      const column = path.node.loc?.start.column ?? 0;

      return [
        {
          line,
          column,
          message: msg,
          rule: "enforceHeadingOrder",
        },
      ];
    },
    analyzePage(context): LintResult[] {
      if (!isResolvedPage(context)) return [];
      const results: LintResult[] = [];
      let previous = 0;
      let uncertainSincePrevious = false;
      const events = [
        ...context.page.facts
          .filter((entry) => entry.kind === "heading")
          .map((fact) => ({
            kind: "heading" as const,
            sequence: fact.sequence ?? fact.order,
            fact,
          })),
        ...(context.page.gaps ?? []).map((gap) => ({
          kind: "gap" as const,
          sequence: gap.sequence,
          gap,
        })),
      ].sort((left, right) => left.sequence - right.sequence);
      for (const event of events) {
        if (event.kind === "gap") {
          previous = 0;
          uncertainSincePrevious = true;
          continue;
        }
        const { fact } = event;
        if (!isUnconditional(fact) || typeof fact.value !== "number") {
          previous = 0;
          uncertainSincePrevious = true;
          continue;
        }
        const message = computeMessage(fact.value, previous, fact.tagName);
        if (!message && previous === 0 && uncertainSincePrevious) {
          const localCandidate = matchingFileResult(
            context,
            "enforceHeadingOrder",
            fact
          );
          const source = localCandidate ? sourceForFact(fact, context) : undefined;
          if (localCandidate && source) {
            results.push({
              ...localCandidate,
              ...source,
              filePath: source.filePath,
              pageSuppression: true,
            });
          }
        }
        previous = fact.value;
        uncertainSincePrevious = false;
        const source = message ? sourceForFact(fact, context) : undefined;
        if (message && source) {
          results.push({ ...source, message, rule: "enforceHeadingOrder" });
        }
      }
      return results;
    },
  };
}

/**
 * Return a human-readable message if the new level violates order, else null.
 */
function computeMessage(
  newLvl: number,
  lastLvl: number,
  newTag: string
): string | null {
  if (lastLvl === 0) return null; // first heading seen

  // Upward skip (e.g. h2 -> h4)
  if (newLvl > lastLvl + 1) {
    return `Heading level skipped: <${newTag}> after <h${lastLvl}>`;
  }

  return null;
}
