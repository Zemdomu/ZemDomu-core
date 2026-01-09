"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = noTabindexGreaterThanZero;
const utils_1 = require("./utils");
function noTabindexGreaterThanZero() {
    const message = 'Tabindex greater than 0 should be avoided';
    return {
        name: 'noTabindexGreaterThanZero',
        enterHtml(node) {
            if (node.type === 'element' && node.attrs.tabindex !== undefined) {
                const value = Number(node.attrs.tabindex);
                if (!Number.isNaN(value) && value > 0) {
                    return [{ line: 0, column: 0, message, rule: 'noTabindexGreaterThanZero' }];
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tabindex = (0, utils_1.getJsxAttr)(opening, 'tabindex');
            if (tabindex !== undefined) {
                const value = Number(tabindex);
                if (!Number.isNaN(value) && value > 0) {
                    const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message, rule: 'noTabindexGreaterThanZero' }];
                }
            }
            return [];
        },
    };
}
