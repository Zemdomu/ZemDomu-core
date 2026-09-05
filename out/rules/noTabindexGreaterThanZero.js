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
            var _a, _b, _c, _d, _e;
            const opening = path.node.openingElement;
            const tabindex = (_a = (0, utils_1.getJsxAttr)(opening, 'tabIndex')) !== null && _a !== void 0 ? _a : (0, utils_1.getJsxAttr)(opening, 'tabindex');
            if (tabindex !== undefined) {
                const value = Number(tabindex);
                if (!Number.isNaN(value) && value > 0) {
                    const line = ((_c = (_b = opening.loc) === null || _b === void 0 ? void 0 : _b.start.line) !== null && _c !== void 0 ? _c : 1) - 1;
                    const column = (_e = (_d = opening.loc) === null || _d === void 0 ? void 0 : _d.start.column) !== null && _e !== void 0 ? _e : 0;
                    return [{ line, column, message, rule: 'noTabindexGreaterThanZero' }];
                }
            }
            return [];
        },
    };
}
