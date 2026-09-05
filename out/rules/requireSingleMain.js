"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireSingleMain;
const utils_1 = require("./utils");
const page_utils_1 = require("./page-utils");
function requireSingleMain() {
    let seenHtml = false;
    let mainCount = 0;
    let htmlLoc = { line: 0, column: 0 };
    const duplicateLocs = [];
    return {
        name: "requireSingleMain",
        enterHtml(node) {
            if (node.type !== "element")
                return [];
            if (node.tagName === "html") {
                seenHtml = true;
                htmlLoc = { line: 0, column: 0, offset: node.startIndex };
            }
            else if (node.tagName === "main") {
                mainCount += 1;
                if (mainCount > 1) {
                    duplicateLocs.push({ line: 0, column: 0, offset: node.startIndex });
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const tag = (0, utils_1.getTag)(path);
            if (tag === "html") {
                seenHtml = true;
                htmlLoc = {
                    line: ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1,
                    column: (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0,
                    offset: (_e = path.node.openingElement.start) !== null && _e !== void 0 ? _e : undefined,
                };
            }
            else if (tag === "main") {
                mainCount += 1;
                if (mainCount > 1) {
                    duplicateLocs.push({
                        line: ((_g = (_f = path.node.loc) === null || _f === void 0 ? void 0 : _f.start.line) !== null && _g !== void 0 ? _g : 1) - 1,
                        column: (_j = (_h = path.node.loc) === null || _h === void 0 ? void 0 : _h.start.column) !== null && _j !== void 0 ? _j : 0,
                        offset: (_k = path.node.openingElement.start) !== null && _k !== void 0 ? _k : undefined,
                    });
                }
            }
            return [];
        },
        end() {
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
        analyzePage(context) {
            if (!(0, page_utils_1.isResolvedPage)(context))
                return [];
            const allMain = context.page.facts.filter((fact) => fact.kind === "landmark" && fact.value === "main");
            const certainMain = allMain.filter(page_utils_1.isUnconditional);
            const first = certainMain[0];
            if (certainMain.length > 1 && first) {
                return certainMain.slice(1).flatMap((fact) => {
                    const source = (0, page_utils_1.sourceForFact)(fact, context);
                    if (!source)
                        return [];
                    const repeatedInstance = first.renderNodeId === fact.renderNodeId;
                    const related = [
                        ...(repeatedInstance ? [] : [(0, page_utils_1.relatedForFact)(first, context, "First unconditional <main> landmark on this composed page")]),
                        (0, page_utils_1.relatedCompositionForFact)(first, context, "First conflicting component usage"),
                    ].filter((entry) => Boolean(entry));
                    return [{
                            ...source,
                            message: "Only one <main> landmark allowed per composed page",
                            rule: "requireSingleMain",
                            ...(related.length ? { related } : {}),
                            pageEditSafe: !repeatedInstance,
                        }];
                });
            }
            if (allMain.length > 0 || !(0, page_utils_1.isCompletePage)(context))
                return [];
            const source = (0, page_utils_1.pageRootSource)(context);
            return source
                ? [{
                        ...source,
                        message: "Composed page missing <main> landmark",
                        rule: "requireSingleMain",
                    }]
                : [];
        },
    };
}
