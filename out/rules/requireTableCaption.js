"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireTableCaption;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function jsxChildHasText(child) {
    if (t.isJSXText(child))
        return child.value.trim().length > 0;
    if (t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (t.isJSXElement(expr))
            return jsxElementHasText(expr);
        if (t.isJSXFragment(expr))
            return expr.children.some(jsxChildHasText);
        return true;
    }
    if (t.isJSXElement(child))
        return jsxElementHasText(child);
    if (t.isJSXFragment(child))
        return child.children.some(jsxChildHasText);
    if (t.isJSXSpreadChild(child))
        return true;
    return false;
}
function jsxElementHasText(node) {
    return node.children.some(jsxChildHasText);
}
function requireTableCaption() {
    const stack = [];
    let captionDepth = 0;
    return {
        name: 'requireTableCaption',
        enterHtml(node) {
            if (node.type === 'element') {
                if (node.tagName === 'table')
                    stack.push({ found: false, hasText: false, table: node });
                if (node.tagName === 'caption' && stack.length) {
                    stack[stack.length - 1].found = true;
                    stack[stack.length - 1].caption = node;
                    captionDepth += 1;
                }
            }
            else if (node.type === 'text') {
                if (captionDepth > 0 && stack.length) {
                    if (node.text.trim())
                        stack[stack.length - 1].hasText = true;
                }
            }
            return [];
        },
        exitHtml(node) {
            var _a, _b;
            if (node.type === 'element') {
                if (node.tagName === 'caption' && captionDepth > 0) {
                    captionDepth -= 1;
                }
                if (node.tagName === 'table') {
                    const entry = stack.pop();
                    if (entry && !entry.found) {
                        return [{ line: 0, column: 0, offset: (_a = entry.table) === null || _a === void 0 ? void 0 : _a.startIndex, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
                    }
                    if (entry && entry.found && !entry.hasText) {
                        return [{ line: 0, column: 0, offset: (_b = entry.caption) === null || _b === void 0 ? void 0 : _b.startIndex, message: '<caption> is empty', rule: 'requireTableCaption' }];
                    }
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'table') {
                stack.push({
                    found: false,
                    hasText: false,
                    hasUnknownContent: path.node.openingElement.attributes.some((attr) => t.isJSXSpreadAttribute(attr)),
                });
            }
            if (tag === 'caption' && stack.length) {
                stack[stack.length - 1].found = true;
                stack[stack.length - 1].captionLoc = {
                    line: ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1,
                    column: (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0,
                    offset: (_e = path.node.openingElement.start) !== null && _e !== void 0 ? _e : undefined,
                };
                if (jsxElementHasText(path.node))
                    stack[stack.length - 1].hasText = true;
            }
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'table') {
                const entry = stack.pop();
                if (entry && !entry.found && !entry.hasUnknownContent) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<table> missing <caption>', rule: 'requireTableCaption' }];
                }
                if (entry && entry.found && !entry.hasText) {
                    const location = (_e = entry.captionLoc) !== null && _e !== void 0 ? _e : {
                        line: ((_g = (_f = path.node.loc) === null || _f === void 0 ? void 0 : _f.start.line) !== null && _g !== void 0 ? _g : 1) - 1,
                        column: (_j = (_h = path.node.loc) === null || _h === void 0 ? void 0 : _h.start.column) !== null && _j !== void 0 ? _j : 0,
                        offset: (_k = path.node.openingElement.start) !== null && _k !== void 0 ? _k : undefined,
                    };
                    return [{ ...location, message: '<caption> is empty', rule: 'requireTableCaption' }];
                }
            }
            return [];
        },
    };
}
