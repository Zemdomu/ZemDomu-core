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
exports.default = requireLinkText;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function mergeTextStates(states) {
    if (states.some((s) => s === "present"))
        return "present";
    if (states.some((s) => s === "possiblyEmpty"))
        return "possiblyEmpty";
    return "empty";
}
function jsxChildTextState(child) {
    if (t.isJSXText(child))
        return child.value.trim().length > 0 ? "present" : "empty";
    if (t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (t.isJSXElement(expr))
            return jsxElementTextState(expr);
        if (t.isJSXFragment(expr)) {
            return mergeTextStates(expr.children.map(jsxChildTextState));
        }
        return (0, utils_1.getJsxExpressionState)(expr, true);
    }
    if (t.isJSXElement(child))
        return jsxElementTextState(child);
    if (t.isJSXFragment(child)) {
        return mergeTextStates(child.children.map(jsxChildTextState));
    }
    if (t.isJSXSpreadChild(child))
        return "present";
    return "empty";
}
function jsxElementTextState(node) {
    return mergeTextStates(node.children.map(jsxChildTextState));
}
function requireLinkText() {
    const stack = [];
    return {
        name: "requireLinkText",
        enterHtml(node) {
            if (node.type === "element" && node.tagName === "a") {
                stack.push({ found: false });
            }
            else if (node.type === "text") {
                if (stack.length && node.text.trim())
                    stack[stack.length - 1].found = true;
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === "element" && node.tagName === "a") {
                const entry = stack.pop();
                if (entry && !entry.found)
                    return [
                        {
                            line: 0,
                            column: 0,
                            message: "<a> tag missing link text",
                            rule: "requireLinkText",
                        },
                    ];
            }
            return [];
        },
        enterJsx(_) {
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === "a") {
                const textState = jsxElementTextState(path.node);
                if (textState !== "present") {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    const message = textState === "possiblyEmpty"
                        ? "<a> link text is possibly empty or undefined"
                        : "<a> tag missing link text";
                    return [
                        {
                            line,
                            column,
                            message,
                            rule: "requireLinkText",
                        },
                    ];
                }
            }
            return [];
        },
    };
}
