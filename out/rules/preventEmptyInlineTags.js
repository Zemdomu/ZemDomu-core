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
function htmlHasContent(node) {
    var _a;
    if (node.type === 'text')
        return node.text.trim().length > 0;
    if (node.type !== 'element')
        return false;
    if (node.tagName === 'img')
        return String((_a = node.attrs.alt) !== null && _a !== void 0 ? _a : '').trim().length > 0;
    return node.children.some(htmlHasContent);
}
function htmlIsIntentionalIcon(node) {
    var _a, _b, _c;
    if (node.type !== 'element' || node.tagName !== 'i')
        return false;
    return (String((_a = node.attrs.class) !== null && _a !== void 0 ? _a : '').trim().length > 0 ||
        String((_b = node.attrs['aria-hidden']) !== null && _b !== void 0 ? _b : '').toLowerCase() === 'true' ||
        ['img', 'presentation', 'none'].includes(String((_c = node.attrs.role) !== null && _c !== void 0 ? _c : '').toLowerCase()));
}
function jsxIsIntentionalIcon(path) {
    var _a, _b;
    if ((0, utils_1.getTag)(path) !== 'i')
        return false;
    const opening = path.node.openingElement;
    const className = (_a = (0, utils_1.getJsxAttr)(opening, 'className')) !== null && _a !== void 0 ? _a : (0, utils_1.getJsxAttr)(opening, 'class');
    const ariaHidden = (0, utils_1.getJsxAttr)(opening, 'aria-hidden');
    const role = (0, utils_1.getJsxAttr)(opening, 'role');
    return (Boolean(className === null || className === void 0 ? void 0 : className.trim()) ||
        (ariaHidden === null || ariaHidden === void 0 ? void 0 : ariaHidden.trim().toLowerCase()) === 'true' ||
        ['img', 'presentation', 'none'].includes((_b = role === null || role === void 0 ? void 0 : role.trim().toLowerCase()) !== null && _b !== void 0 ? _b : ''));
}
function jsxHasContent(node) {
    return node.children.some((child) => {
        if (t.isJSXText(child))
            return child.value.trim().length > 0;
        if (t.isJSXExpressionContainer(child))
            return !t.isJSXEmptyExpression(child.expression);
        if (t.isJSXFragment(child))
            return jsxHasContent(child);
        if (t.isJSXElement(child)) {
            const tag = t.isJSXIdentifier(child.openingElement.name)
                ? child.openingElement.name.name.toLowerCase()
                : '';
            if (tag === 'img') {
                const alt = child.openingElement.attributes.find((attribute) => t.isJSXAttribute(attribute) &&
                    t.isJSXIdentifier(attribute.name) &&
                    attribute.name.name === 'alt');
                return !!alt && !!alt.value;
            }
            return jsxHasContent(child);
        }
        return false;
    });
}
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
                if (e && !(e.found || htmlHasContent(node) || htmlIsIntentionalIcon(node)))
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
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (inlineTags.has(tag)) {
                const e = stack.pop();
                const hasText = jsxHasContent(path.node);
                if (e && !(e.found || hasText || jsxIsIntentionalIcon(path))) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: `<${tag}> tag should not be empty`, rule: 'preventEmptyInlineTags' }];
                }
            }
            return [];
        },
    };
}
