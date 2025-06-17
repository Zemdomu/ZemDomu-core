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
exports.default = preventEmptyInlineTags;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
const inlineTags = new Set(['strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'del', 'ins']);
function preventEmptyInlineTags() {
    const stack = [];
    return {
        name: 'preventEmptyInlineTags',
        enterHtml(node) {
            if (node.type === 'element' && inlineTags.has(node.tagName)) {
                stack.push({ tag: node.tagName, found: false });
            }
            else if (node.type === 'text') {
                if (stack.length && node.text.trim())
                    stack[stack.length - 1].found = true;
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && inlineTags.has(node.tagName)) {
                const e = stack.pop();
                if (e && !e.found)
                    return [{ line: 0, column: 0, message: `<${e.tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
            }
            return [];
        },
        enterJsx(path) {
            const tag = (0, utils_1.getTag)(path);
            if (inlineTags.has(tag))
                stack.push({ tag, found: false });
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d, _e;
            const tag = (0, utils_1.getTag)(path);
            if (inlineTags.has(tag)) {
                const e = stack.pop();
                const hasText = ((_a = path.parentPath) === null || _a === void 0 ? void 0 : _a.node).children.some(c => (t.isJSXText(c) && c.value.trim()) || t.isJSXExpressionContainer(c));
                if (e && !(e.found || hasText)) {
                    const line = ((_c = (_b = path.node.loc) === null || _b === void 0 ? void 0 : _b.start.line) !== null && _c !== void 0 ? _c : 1) - 1;
                    const column = (_e = (_d = path.node.loc) === null || _d === void 0 ? void 0 : _d.start.column) !== null && _e !== void 0 ? _e : 0;
                    return [{ line, column, message: `<${tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
                }
            }
            return [];
        },
    };
}
