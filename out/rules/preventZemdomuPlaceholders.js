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
exports.default = preventZemdomuPlaceholders;
const t = __importStar(require("@babel/types"));
const PLACEHOLDER = "TODO-ZMD";
function buildLineIndex(content) {
    const lines = [0];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n")
            lines.push(i + 1);
    }
    return lines;
}
function indexToLoc(lineIndex, index) {
    let low = 0;
    let high = lineIndex.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineIndex[mid] <= index) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    const line = Math.max(high, 0);
    const column = index - lineIndex[line];
    return { line, column };
}
function collectOccurrences(text, startLine, startColumn) {
    const hits = [];
    let idx = text.indexOf(PLACEHOLDER);
    while (idx !== -1) {
        const before = text.slice(0, idx);
        const parts = before.split(/\r?\n/);
        const lineOffset = parts.length - 1;
        const column = lineOffset === 0 ? startColumn + parts[parts.length - 1].length : parts[parts.length - 1].length;
        hits.push({ line: startLine + lineOffset, column });
        idx = text.indexOf(PLACEHOLDER, idx + PLACEHOLDER.length);
    }
    return hits;
}
function addHtmlResults(results, htmlContext, absoluteIndex) {
    if (!htmlContext) {
        results.push({
            line: 0,
            column: 0,
            message: "Unresolved Zemdomu placeholder detected",
            rule: "preventZemdomuPlaceholders",
        });
        return;
    }
    const loc = indexToLoc(htmlContext.lineIndex, absoluteIndex);
    results.push({
        line: loc.line,
        column: loc.column,
        message: "Unresolved Zemdomu placeholder detected",
        rule: "preventZemdomuPlaceholders",
    });
}
function textNodePlaceholderResults(node, htmlContext) {
    if (node.type !== "text")
        return [];
    const occurrences = [];
    let idx = node.text.indexOf(PLACEHOLDER);
    while (idx !== -1) {
        occurrences.push(node.startIndex + idx);
        idx = node.text.indexOf(PLACEHOLDER, idx + PLACEHOLDER.length);
    }
    if (!occurrences.length)
        return [];
    const results = [];
    for (const absIdx of occurrences) {
        addHtmlResults(results, htmlContext, absIdx);
    }
    return results;
}
function tagPlaceholderResults(node, htmlContext) {
    if (!htmlContext) {
        for (const value of Object.values(node.attrs)) {
            if (value && value.includes(PLACEHOLDER)) {
                return [
                    {
                        line: 0,
                        column: 0,
                        message: "Unresolved Zemdomu placeholder detected",
                        rule: "preventZemdomuPlaceholders",
                    },
                ];
            }
        }
        return [];
    }
    const { content } = htmlContext;
    const tagEnd = content.indexOf(">", node.startIndex);
    if (tagEnd === -1)
        return [];
    const tagSource = content.slice(node.startIndex, tagEnd + 1);
    const results = [];
    let idx = tagSource.indexOf(PLACEHOLDER);
    while (idx !== -1) {
        addHtmlResults(results, htmlContext, node.startIndex + idx);
        idx = tagSource.indexOf(PLACEHOLDER, idx + PLACEHOLDER.length);
    }
    return results;
}
function resultsFromJsxText(text, loc, startColumnAdjustment = 0) {
    if (!loc)
        return [];
    const startLine = loc.start.line - 1;
    const startColumn = loc.start.column + startColumnAdjustment;
    const hits = collectOccurrences(text, startLine, startColumn);
    return hits.map((hit) => ({
        line: hit.line,
        column: hit.column,
        message: "Unresolved Zemdomu placeholder detected",
        rule: "preventZemdomuPlaceholders",
    }));
}
function checkJsxExpression(expr) {
    if (t.isStringLiteral(expr)) {
        return { text: expr.value, loc: expr.loc, startColumnAdjustment: 1 };
    }
    if (t.isTemplateLiteral(expr)) {
        const raw = expr.quasis.map((q) => { var _a; return (_a = q.value.cooked) !== null && _a !== void 0 ? _a : q.value.raw; }).join("");
        return { text: raw, loc: expr.loc, startColumnAdjustment: 1 };
    }
    return null;
}
function jsxAttributeResults(attr) {
    var _a, _b, _c;
    const value = attr.value;
    if (!value)
        return [];
    if (t.isStringLiteral(value)) {
        if (!value.value.includes(PLACEHOLDER))
            return [];
        return resultsFromJsxText(value.value, (_a = value.loc) !== null && _a !== void 0 ? _a : attr.loc, 1);
    }
    if (t.isJSXExpressionContainer(value)) {
        const expr = checkJsxExpression(value.expression);
        if (!expr || !expr.text.includes(PLACEHOLDER))
            return [];
        return resultsFromJsxText(expr.text, (_c = (_b = expr.loc) !== null && _b !== void 0 ? _b : value.loc) !== null && _c !== void 0 ? _c : attr.loc, expr.startColumnAdjustment);
    }
    return [];
}
function jsxChildResults(child) {
    var _a;
    if (t.isJSXText(child)) {
        if (!child.value.includes(PLACEHOLDER))
            return [];
        return resultsFromJsxText(child.value, child.loc);
    }
    if (t.isJSXExpressionContainer(child)) {
        const expr = checkJsxExpression(child.expression);
        if (!expr || !expr.text.includes(PLACEHOLDER))
            return [];
        return resultsFromJsxText(expr.text, (_a = expr.loc) !== null && _a !== void 0 ? _a : child.loc, expr.startColumnAdjustment);
    }
    if (t.isJSXFragment(child)) {
        const results = [];
        for (const fragmentChild of child.children) {
            results.push(...jsxChildResults(fragmentChild));
        }
        return results;
    }
    return [];
}
function preventZemdomuPlaceholders() {
    let htmlContext = null;
    return {
        name: "preventZemdomuPlaceholders",
        setHtmlContext(ctx) {
            htmlContext = {
                content: ctx.content,
                lineIndex: ctx.lineIndex.length ? ctx.lineIndex : buildLineIndex(ctx.content),
            };
        },
        enterHtml(node) {
            if (node.type === "text") {
                return textNodePlaceholderResults(node, htmlContext);
            }
            if (node.type === "element") {
                return tagPlaceholderResults(node, htmlContext);
            }
            return [];
        },
        enterJsx(path) {
            const results = [];
            const opening = path.node.openingElement;
            for (const attr of opening.attributes) {
                if (t.isJSXAttribute(attr)) {
                    results.push(...jsxAttributeResults(attr));
                }
            }
            for (const child of path.node.children) {
                results.push(...jsxChildResults(child));
            }
            return results;
        },
    };
}
