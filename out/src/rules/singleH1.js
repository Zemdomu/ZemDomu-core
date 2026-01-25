"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = singleH1;
const utils_1 = require("./utils");
function singleH1() {
    const groupCounts = new Map();
    const htmlStack = [];
    let htmlGroupId = 0;
    const incrementGroup = (groupKey) => {
        var _a;
        const next = ((_a = groupCounts.get(groupKey)) !== null && _a !== void 0 ? _a : 0) + 1;
        groupCounts.set(groupKey, next);
        return next;
    };
    const mergeChainIntoBase = (chainId, baseGroup) => {
        var _a;
        let total = 0;
        for (const [key, value] of groupCounts.entries()) {
            if (key.startsWith(`${chainId}:`)) {
                total += value;
                groupCounts.delete(key);
            }
        }
        if (total > 0) {
            groupCounts.set(baseGroup, ((_a = groupCounts.get(baseGroup)) !== null && _a !== void 0 ? _a : 0) + total);
        }
    };
    return {
        name: 'singleH1',
        init() {
            groupCounts.clear();
            htmlStack.length = 0;
            htmlGroupId = 0;
        },
        enterHtml(node) {
            var _a, _b, _c;
            if (node.type === 'element') {
                const parentCtx = (_a = htmlStack[htmlStack.length - 1]) !== null && _a !== void 0 ? _a : {
                    groupKey: 'root',
                };
                const hasIf = Object.prototype.hasOwnProperty.call(node.attrs, 'v-if');
                const hasElseIf = Object.prototype.hasOwnProperty.call(node.attrs, 'v-else-if');
                const hasElse = Object.prototype.hasOwnProperty.call(node.attrs, 'v-else');
                if (!hasElseIf && !hasElse && parentCtx.pendingIfGroup) {
                    if (parentCtx.pendingIfExclusive) {
                        parentCtx.pendingIfGroup = undefined;
                        parentCtx.pendingIfExclusive = undefined;
                    }
                    else {
                        mergeChainIntoBase(parentCtx.pendingIfGroup, parentCtx.groupKey);
                        parentCtx.pendingIfGroup = undefined;
                        parentCtx.pendingIfExclusive = undefined;
                    }
                }
                let groupKey = parentCtx.groupKey;
                if (hasElseIf || hasElse) {
                    const chainId = (_b = parentCtx.pendingIfGroup) !== null && _b !== void 0 ? _b : `${parentCtx.groupKey}|cond:${++htmlGroupId}`;
                    parentCtx.pendingIfGroup = chainId;
                    parentCtx.pendingIfExclusive = true;
                    const branch = hasElse ? 'else' : 'else-if';
                    groupKey = `${chainId}:${branch}`;
                }
                else if (hasIf) {
                    const chainId = `${parentCtx.groupKey}|cond:${++htmlGroupId}`;
                    parentCtx.pendingIfGroup = chainId;
                    parentCtx.pendingIfExclusive = false;
                    groupKey = `${chainId}:if`;
                }
                htmlStack.push({ groupKey });
            }
            if (node.type === 'element' && node.tagName === 'h1') {
                const ctx = htmlStack[htmlStack.length - 1];
                const groupKey = (_c = ctx === null || ctx === void 0 ? void 0 : ctx.groupKey) !== null && _c !== void 0 ? _c : 'root';
                if (incrementGroup(groupKey) > 1) {
                    return [{ line: 0, column: 0, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
                }
            }
            return [];
        },
        exitHtml(node) {
            if (node.type !== 'element')
                return [];
            const ctx = htmlStack[htmlStack.length - 1];
            if (ctx === null || ctx === void 0 ? void 0 : ctx.pendingIfGroup) {
                if (ctx.pendingIfExclusive) {
                    ctx.pendingIfGroup = undefined;
                    ctx.pendingIfExclusive = undefined;
                }
                else {
                    mergeChainIntoBase(ctx.pendingIfGroup, ctx.groupKey);
                    ctx.pendingIfGroup = undefined;
                    ctx.pendingIfExclusive = undefined;
                }
            }
            htmlStack.pop();
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'h1') {
                const group = (0, utils_1.getJsxRenderGroup)(path);
                if (incrementGroup(group) > 1) {
                    const line = ((_b = (_a = path.node.openingElement.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.openingElement.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
                }
            }
            return [];
        },
    };
}
