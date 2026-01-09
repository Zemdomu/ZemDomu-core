"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uniqueIds;
const utils_1 = require("./utils");
function uniqueIds() {
    const ids = new Set();
    return {
        name: 'uniqueIds',
        enterHtml(node) {
            if (node.type === 'element' && node.attrs.id) {
                const id = String(node.attrs.id);
                if (ids.has(id)) {
                    return [{ line: 0, column: 0, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
                }
                ids.add(id);
            }
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
    };
}
