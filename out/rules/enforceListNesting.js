"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = enforceListNesting;
const utils_1 = require("./utils");
function enforceListNesting() {
    const stack = [];
    return {
        name: 'enforceListNesting',
        enterHtml(node) {
            if (node.type === 'element') {
                stack.push(node.tagName);
                if (node.tagName === 'li') {
                    const parent = stack[stack.length - 2];
                    if (!parent || !['ul', 'ol'].includes(parent)) {
                        return [{ line: 0, column: 0, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
                    }
                }
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element') {
                stack.pop();
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'li') {
                const parentElement = path.findParent((p) => p.isJSXElement());
                // A root <li> can be a component whose consumer supplies the list.
                // Report only when a non-list JSX parent is present and therefore certain.
                if (!parentElement)
                    return [];
                const parentTag = parentElement ? (0, utils_1.getTag)(parentElement) : '';
                const inList = parentTag === 'ul' || parentTag === 'ol';
                if (!inList) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
                }
            }
            return [];
        },
    };
}
