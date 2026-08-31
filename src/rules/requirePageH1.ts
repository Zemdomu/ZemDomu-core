import type { Rule } from "../linter";
import {
  isCompletePage,
  isResolvedPage,
  pageRootSource,
} from "./page-utils";

/** Advisory page-only rule. `singleH1` intentionally remains max-one only. */
export default function requirePageH1(): Rule {
  return {
    name: "requirePageH1",
    analyzePage(context) {
      if (!isResolvedPage(context) || !isCompletePage(context)) return [];
      const headings = context.page.facts.filter(
        (fact) => fact.kind === "heading" && fact.value === 1
      );
      // A conditional H1 does not prove presence, but it also makes a missing-H1
      // diagnostic path-dependent, so remain silent.
      if (headings.length > 0) return [];
      const source = pageRootSource(context);
      return source
        ? [{
            ...source,
            message: "Composed page missing <h1> heading",
            rule: "requirePageH1",
          }]
        : [];
    },
  };
}
