"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireTableCaption;
const utils_1 = require("./utils");
function requireTableCaption() {
    const stack = [];
    return {
        name: 'requireTableCaption',
        enterHtml(node) {
            if (node.type === 'element') {
                if (node.tagName === 'table')
                    stack.push({ found: false });
                if (node.tagName === 'caption' && stack.length)
                    stack[stack.length - 1].found = true;
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && node.tagName === 'table') {
                const entry = stack.pop();
                if (entry && !entry.found)
                    return [{ line: 0, column: 0, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
            }
            return [];
        },
        enterJsx(path) {
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'table')
                stack.push({ found: false });
            if (tag === 'caption' && stack.length)
                stack[stack.length - 1].found = true;
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'table') {
                const entry = stack.pop();
                if (entry && !entry.found) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
                }
            }
            return [];
        },
    };
}
