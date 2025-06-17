"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireNavLinks;
const utils_1 = require("./utils");
function requireNavLinks() {
    const stack = [];
    return {
        name: 'requireNavLinks',
        enterHtml(node) {
            if (node.type === 'element') {
                if (node.tagName === 'nav')
                    stack.push({ hasLink: false });
                if (node.tagName === 'a' && stack.length)
                    stack[stack.length - 1].hasLink = true;
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && node.tagName === 'nav') {
                const entry = stack.pop();
                if (entry && !entry.hasLink)
                    return [{ line: 0, column: 0, message: '<nav> contains no links', rule: 'requireNavLinks' }];
            }
            return [];
        },
        enterJsx(path) {
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'nav')
                stack.push({ hasLink: false });
            if (tag === 'a' && stack.length)
                stack[stack.length - 1].hasLink = true;
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'nav') {
                const entry = stack.pop();
                if (entry && !entry.hasLink) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<nav> contains no links', rule: 'requireNavLinks' }];
                }
            }
            return [];
        },
    };
}
