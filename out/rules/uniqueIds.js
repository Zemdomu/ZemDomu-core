"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uniqueIds;
const utils_1 = require("./utils");
const page_utils_1 = require("./page-utils");
function uniqueIds() {
    const ids = new Set();
    const htmlIdOwners = new Map();
    const htmlStack = [];
    return {
        name: 'uniqueIds',
        enterHtml(node) {
            var _a;
            if (node.type !== 'element')
                return [];
            const parent = (_a = htmlStack[htmlStack.length - 1]) !== null && _a !== void 0 ? _a : null;
            htmlStack.push(node);
            if (node.attrs.id) {
                const id = String(node.attrs.id);
                if (ids.has(id)) {
                    const first = htmlIdOwners.get(id);
                    const firstStartsBranch = first && (Object.prototype.hasOwnProperty.call(first.node.attrs, 'v-if') ||
                        Object.prototype.hasOwnProperty.call(first.node.attrs, 'v-else-if'));
                    const currentContinuesBranch = Object.prototype.hasOwnProperty.call(node.attrs, 'v-else-if') ||
                        Object.prototype.hasOwnProperty.call(node.attrs, 'v-else');
                    const branchAdjacent = (first === null || first === void 0 ? void 0 : first.parent) && first.parent === parent && (() => {
                        const firstIndex = first.parent.children.indexOf(first.node);
                        const currentIndex = first.parent.children.indexOf(node);
                        return firstIndex >= 0 && currentIndex > firstIndex && first.parent.children
                            .slice(firstIndex + 1, currentIndex)
                            .every((child) => child.type === 'comment' || (child.type === 'text' && !child.text.trim()));
                    })();
                    if (branchAdjacent && firstStartsBranch && currentContinuesBranch) {
                        return [];
                    }
                    return [{ line: 0, column: 0, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
                }
                ids.add(id);
                htmlIdOwners.set(id, { node, parent });
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element')
                htmlStack.pop();
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const id = (0, utils_1.getJsxAttr)(path.node.openingElement, 'id');
            if (id) {
                if (ids.has(id)) {
                    const line = ((_b = (_a = path.node.openingElement.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.openingElement.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
                }
                ids.add(id);
            }
            return [];
        },
        analyzePage(context) {
            if (!(0, page_utils_1.isResolvedPage)(context))
                return [];
            const firstById = new Map();
            const results = [];
            for (const fact of context.page.facts) {
                if (fact.kind !== 'document-id' || typeof fact.value !== 'string' || !(0, page_utils_1.isUnconditional)(fact)) {
                    continue;
                }
                const first = firstById.get(fact.value);
                if (!first) {
                    firstById.set(fact.value, fact);
                    continue;
                }
                const source = (0, page_utils_1.sourceForFact)(fact, context);
                if (!source)
                    continue;
                const repeatedInstance = first.renderNodeId === fact.renderNodeId;
                const related = [
                    ...(repeatedInstance ? [] : [(0, page_utils_1.relatedForFact)(first, context, `First element with id "${fact.value}"`)]),
                    (0, page_utils_1.relatedCompositionForFact)(first, context, 'First conflicting component usage'),
                ].filter((entry) => Boolean(entry));
                results.push({
                    ...source,
                    message: `Duplicate id "${fact.value}" in composed page`,
                    rule: 'uniqueIds',
                    ...(related.length ? { related } : {}),
                    pageEditSafe: !repeatedInstance,
                });
            }
            return results;
        },
    };
}
