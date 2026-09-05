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
exports.default = requireDocumentTitle;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function collectText(node) {
    if (node.type === "text")
        return node.text;
    if (node.type !== "element")
        return "";
    return node.children.map(collectText).join("");
}
function jsxTitleHasContent(children) {
    for (const child of children) {
        if (t.isJSXText(child)) {
            if (child.value.trim().length > 0)
                return true;
            continue;
        }
        if (t.isJSXExpressionContainer(child)) {
            const state = (0, utils_1.getJsxExpressionState)(child.expression, true);
            if (state !== "empty")
                return true;
            continue;
        }
        if (t.isJSXElement(child) || t.isJSXFragment(child)) {
            return true;
        }
    }
    return false;
}
function requireDocumentTitle() {
    let seenHtml = false;
    let seenTitle = false;
    let hasNonEmptyTitle = false;
    let headDepth = 0;
    let htmlLoc = { line: 0, column: 0 };
    let titleLoc = null;
    return {
        name: "requireDocumentTitle",
        enterHtml(node) {
            if (node.type !== "element")
                return [];
            if (node.tagName === "html") {
                seenHtml = true;
                htmlLoc = { line: 0, column: 0, offset: node.startIndex };
            }
            else if (node.tagName === "head") {
                headDepth += 1;
            }
            else if (node.tagName === "title" && headDepth > 0) {
                seenTitle = true;
                if (!titleLoc)
                    titleLoc = { line: 0, column: 0, offset: node.startIndex };
                if (collectText(node).trim().length > 0) {
                    hasNonEmptyTitle = true;
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const tag = (0, utils_1.getTag)(path);
            if (tag === "html") {
                seenHtml = true;
                htmlLoc = {
                    line: ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1,
                    column: (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0,
                    offset: (_e = path.node.openingElement.start) !== null && _e !== void 0 ? _e : undefined,
                };
                return [];
            }
            if (tag === "head") {
                headDepth += 1;
                return [];
            }
            if (tag === "title" && headDepth > 0) {
                seenTitle = true;
                if (!titleLoc) {
                    titleLoc = {
                        line: ((_g = (_f = path.node.loc) === null || _f === void 0 ? void 0 : _f.start.line) !== null && _g !== void 0 ? _g : 1) - 1,
                        column: (_j = (_h = path.node.loc) === null || _h === void 0 ? void 0 : _h.start.column) !== null && _j !== void 0 ? _j : 0,
                        offset: (_k = path.node.openingElement.start) !== null && _k !== void 0 ? _k : undefined,
                    };
                }
                if (jsxTitleHasContent(path.node.children)) {
                    hasNonEmptyTitle = true;
                }
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === "element" && node.tagName === "head") {
                headDepth = Math.max(0, headDepth - 1);
            }
            return [];
        },
        exitJsx(path) {
            if ((0, utils_1.getTag)(path) === "head") {
                headDepth = Math.max(0, headDepth - 1);
            }
            return [];
        },
        end() {
            if (!seenHtml)
                return [];
            if (!seenTitle) {
                return [
                    {
                        line: htmlLoc.line,
                        column: htmlLoc.column,
                        offset: htmlLoc.offset,
                        message: "Document missing non-empty <title> in <head>",
                        rule: "requireDocumentTitle",
                    },
                ];
            }
            if (!hasNonEmptyTitle) {
                const loc = titleLoc !== null && titleLoc !== void 0 ? titleLoc : htmlLoc;
                return [
                    {
                        line: loc.line,
                        column: loc.column,
                        offset: loc.offset,
                        message: "<title> element must not be empty",
                        rule: "requireDocumentTitle",
                    },
                ];
            }
            return [];
        },
    };
}
