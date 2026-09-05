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
exports.default = requireNavLinks;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function requireNavLinks() {
    const stack = [];
    return {
        name: 'requireNavLinks',
        enterHtml(node) {
            if (node.type === 'element') {
                if (node.tagName === 'nav')
                    stack.push({ hasLink: false });
                if (stack.length) {
                    if (node.tagName === 'a' || (0, utils_1.hasHtmlLinkAttribute)(node.attrs)) {
                        stack[stack.length - 1].hasLink = true;
                    }
                }
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
            if (tag === 'nav') {
                stack.push({
                    hasLink: false,
                    hasUnknownContent: path.node.openingElement.attributes.some((attr) => t.isJSXSpreadAttribute(attr)),
                });
            }
            if (stack.length) {
                if (tag === 'a') {
                    stack[stack.length - 1].hasLink = true;
                }
                else if ((0, utils_1.hasJsxLinkAttribute)(path.node.openingElement)) {
                    stack[stack.length - 1].hasLink = true;
                }
                else if (t.isJSXIdentifier(path.node.openingElement.name) && /^[A-Z]/.test(path.node.openingElement.name.name)) {
                    stack[stack.length - 1].hasLink = true;
                }
            }
            return [];
        },
        exitJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'nav') {
                const entry = stack.pop();
                if (entry && !entry.hasLink && !entry.hasUnknownContent) {
                    const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<nav> contains no links', rule: 'requireNavLinks' }];
                }
            }
            return [];
        },
    };
}
