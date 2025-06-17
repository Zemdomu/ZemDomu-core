"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireSectionHeading;
const utils_1 = require("./utils");
function requireSectionHeading() {
    const stack = [];
    return {
        name: 'requireSectionHeading',
        enterHtml(node) {
            if (node.type === 'element') {
                if (node.tagName === 'section')
                    stack.push({ found: false });
                if (/^h[1-6]$/i.test(node.tagName) && stack.length)
                    stack[stack.length - 1].found = true;
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && node.tagName === 'section') {
                const s = stack.pop();
                if (s && !s.found)
                    return [{ line: 0, column: 0, message: '<section> missing heading (<h1>-<h6>)', rule: 'requireSectionHeading' }];
            }
            return [];
        },
        enterJsx(path) {
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'section')
                stack.push({ found: false });
            if (/^h[1-6]$/.test(tag) && stack.length)
                stack[stack.length - 1].found = true;
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'section') {
                const s = stack.pop();
                if (s && !s.found) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<section> missing heading (<h1>-<h6>)', rule: 'requireSectionHeading' }];
                }
            }
            return [];
        },
    };
}
