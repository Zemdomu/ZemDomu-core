"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = enforceHeadingOrder;
const utils_1 = require("./utils");
function enforceHeadingOrder() {
    let last = 0;
    return {
        name: 'enforceHeadingOrder',
        init() { last = 0; },
        enterHtml(node) {
            if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
                const lvl = parseInt(node.tagName.charAt(1), 10);
                if (last && lvl > last + 1) {
                    const message = `Heading level skipped: <${node.tagName}> after <h${last}>`;
                    last = lvl;
                    return [{ line: 0, column: 0, message, rule: 'enforceHeadingOrder' }];
                }
                last = lvl;
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (/^h[1-6]$/.test(tag)) {
                const lvl = parseInt(tag.charAt(1), 10);
                if (last && lvl > last + 1) {
                    const message = `Heading level skipped: <${tag}> after <h${last}>`;
                    last = lvl;
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message, rule: 'enforceHeadingOrder' }];
                }
                last = lvl;
            }
            return [];
        },
    };
}
