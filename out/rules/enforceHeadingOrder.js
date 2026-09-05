"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = enforceHeadingOrder;
const utils_1 = require("./utils");
const page_utils_1 = require("./page-utils");
/**
 * Enforce heading order by detecting skipped levels when opening subsections.
 *
 * Flags:
 *  - Upward skip:   h2 -> h4 (new > last + 1)
 * First heading in a file never warns.
 * Returning to a lower rank closes subsections and is valid (for example h4 -> h2).
 */
function enforceHeadingOrder() {
    let last = 0; // 0 means “no heading seen yet”
    return {
        name: "enforceHeadingOrder",
        init() {
            last = 0;
        },
        enterHtml(node) {
            if (!(node.type === "element" && /^h[1-6]$/.test(node.tagName)))
                return [];
            const lvl = parseInt(node.tagName[1], 10);
            const msg = computeMessage(lvl, last, node.tagName);
            last = lvl;
            if (!msg)
                return [];
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
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (!/^h[1-6]$/.test(tag))
                return [];
            const lvl = parseInt(tag[1], 10);
            const msg = computeMessage(lvl, last, tag);
            last = lvl;
            if (!msg)
                return [];
            const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1; // VS Code is 0-based
            const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
            return [
                {
                    line,
                    column,
                    message: msg,
                    rule: "enforceHeadingOrder",
                },
            ];
        },
        analyzePage(context) {
            var _a;
            if (!(0, page_utils_1.isResolvedPage)(context))
                return [];
            const results = [];
            let previous = 0;
            let uncertainSincePrevious = false;
            const events = [
                ...context.page.facts
                    .filter((entry) => entry.kind === "heading")
                    .map((fact) => {
                    var _a;
                    return ({
                        kind: "heading",
                        sequence: (_a = fact.sequence) !== null && _a !== void 0 ? _a : fact.order,
                        fact,
                    });
                }),
                ...((_a = context.page.gaps) !== null && _a !== void 0 ? _a : []).map((gap) => ({
                    kind: "gap",
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
                if (!(0, page_utils_1.isUnconditional)(fact) || typeof fact.value !== "number") {
                    previous = 0;
                    uncertainSincePrevious = true;
                    continue;
                }
                const message = computeMessage(fact.value, previous, fact.tagName);
                if (!message && previous === 0 && uncertainSincePrevious) {
                    const localCandidate = (0, page_utils_1.matchingFileResult)(context, "enforceHeadingOrder", fact);
                    const source = localCandidate ? (0, page_utils_1.sourceForFact)(fact, context) : undefined;
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
                const source = message ? (0, page_utils_1.sourceForFact)(fact, context) : undefined;
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
function computeMessage(newLvl, lastLvl, newTag) {
    if (lastLvl === 0)
        return null; // first heading seen
    // Upward skip (e.g. h2 -> h4)
    if (newLvl > lastLvl + 1) {
        return `Heading level skipped: <${newTag}> after <h${lastLvl}>`;
    }
    return null;
}
