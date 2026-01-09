"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = singleH1;
const utils_1 = require("./utils");
function singleH1() {
    let count = 0;
    return {
        name: 'singleH1',
        init() { count = 0; },
        enterHtml(node) {
            if (node.type === 'element' && node.tagName === 'h1') {
                count++;
                if (count > 1) {
                    return [{ line: 0, column: 0, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'h1') {
                count++;
                if (count > 1) {
                    const line = ((_b = (_a = path.node.openingElement.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.openingElement.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
                }
            }
            return [];
        },
    };
}
