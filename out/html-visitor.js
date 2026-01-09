"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitHtml = visitHtml;
function visitHtml(node, visitor) {
    var _a, _b;
    (_a = visitor.enter) === null || _a === void 0 ? void 0 : _a.call(visitor, node);
    if (node.type === 'element') {
        for (const child of node.children) {
            visitHtml(child, visitor);
        }
    }
    (_b = visitor.exit) === null || _b === void 0 ? void 0 : _b.call(visitor, node);
}
