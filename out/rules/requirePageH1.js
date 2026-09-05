"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requirePageH1;
const page_utils_1 = require("./page-utils");
/** Advisory page-only rule. `singleH1` intentionally remains max-one only. */
function requirePageH1() {
    return {
        name: "requirePageH1",
        analyzePage(context) {
            if (!(0, page_utils_1.isResolvedPage)(context) || !(0, page_utils_1.isCompletePage)(context))
                return [];
            const headings = context.page.facts.filter((fact) => fact.kind === "heading" && fact.value === 1);
            // A conditional H1 does not prove presence, but it also makes a missing-H1
            // diagnostic path-dependent, so remain silent.
            if (headings.length > 0)
                return [];
            const source = (0, page_utils_1.pageRootSource)(context);
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
