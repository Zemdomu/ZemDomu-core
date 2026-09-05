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
exports.default = requireButtonText;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
const HTML_ARIA_LABEL_ATTRS = ['aria-label'];
const HTML_ARIA_LABELLEDBY_ATTRS = ['aria-labelledby'];
const HTML_TITLE_ATTRS = ['title', ':title', 'v-bind:title'];
const HTML_ARIA_HIDDEN_ATTRS = ['aria-hidden'];
const HTML_HIDDEN_ATTRS = ['hidden'];
function getHtmlAttrValue(attrs, names) {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(attrs, name)) {
            return attrs[name];
        }
    }
    return undefined;
}
function hasHtmlAttr(attrs, names) {
    return names.some((name) => Object.prototype.hasOwnProperty.call(attrs, name));
}
function normalizeStyle(style) {
    return style.toLowerCase().replace(/\s+/g, '');
}
function isHiddenStyle(style) {
    if (!style)
        return false;
    const normalized = normalizeStyle(style);
    return (normalized.includes('display:none') ||
        normalized.includes('visibility:hidden') ||
        normalized.includes('visibility:collapse'));
}
function isHtmlHidden(node) {
    if (hasHtmlAttr(node.attrs, HTML_HIDDEN_ATTRS))
        return true;
    const ariaHidden = getHtmlAttrValue(node.attrs, HTML_ARIA_HIDDEN_ATTRS);
    if (typeof ariaHidden === 'string' && ariaHidden.trim().toLowerCase() === 'true') {
        return true;
    }
    const style = node.attrs.style;
    return isHiddenStyle(style);
}
function hasHtmlNonEmptyAriaLabel(node) {
    const aria = getHtmlAttrValue(node.attrs, HTML_ARIA_LABEL_ATTRS);
    if (aria === undefined)
        return false;
    return aria.trim().length > 0;
}
function hasHtmlNonEmptyTitle(node) {
    const title = getHtmlAttrValue(node.attrs, HTML_TITLE_ATTRS);
    return typeof title === 'string' && title.trim().length > 0;
}
function hasJsxSpreadAttribute(opening) {
    return opening.attributes.some((attr) => t.isJSXSpreadAttribute(attr));
}
function htmlImgAltPresent(node) {
    const alt = node.attrs.alt;
    return typeof alt === 'string' && alt.trim().length > 0;
}
function hasHtmlAccessibleText(node, hidden) {
    if (hidden)
        return false;
    if (node.type === 'text') {
        return node.text.trim().length > 0;
    }
    if (node.type === 'element') {
        const isHidden = hidden || isHtmlHidden(node);
        if (isHidden)
            return false;
        if (node.tagName === 'img') {
            return htmlImgAltPresent(node);
        }
        return node.children.some((child) => hasHtmlAccessibleText(child, isHidden));
    }
    return false;
}
function hasHtmlAriaLabelledByText(node, idMap) {
    const labelledBy = getHtmlAttrValue(node.attrs, HTML_ARIA_LABELLEDBY_ATTRS);
    if (!labelledBy)
        return false;
    const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
    if (!ids.length)
        return false;
    for (const id of ids) {
        const targets = idMap.get(id);
        if (!targets)
            continue;
        for (const target of targets) {
            if (hasHtmlAccessibleText(target, false))
                return true;
        }
    }
    return false;
}
function getJsxTagName(opening) {
    if (!t.isJSXIdentifier(opening.name))
        return '';
    const name = opening.name.name;
    return name === name.toLowerCase() ? name : '';
}
function getStaticJsxAttrText(opening, name) {
    const attr = (0, utils_1.getJsxAttribute)(opening, name);
    if (!attr)
        return undefined;
    if (!attr.value)
        return '';
    if (t.isStringLiteral(attr.value))
        return attr.value.value;
    if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        if (t.isStringLiteral(expr))
            return expr.value;
        if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
            const raw = expr.quasis.map((q) => { var _a; return (_a = q.value.cooked) !== null && _a !== void 0 ? _a : q.value.raw; }).join('');
            return raw;
        }
    }
    return null;
}
function isJsxHidden(opening) {
    const attr = (0, utils_1.getJsxAttribute)(opening, 'hidden');
    if (!attr)
        return false;
    if (!attr.value)
        return true;
    if (t.isStringLiteral(attr.value))
        return true;
    if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        if (t.isBooleanLiteral(expr))
            return expr.value;
    }
    return false;
}
function isJsxAriaHidden(opening) {
    const attr = (0, utils_1.getJsxAttribute)(opening, 'aria-hidden');
    if (!attr)
        return false;
    if (!attr.value)
        return true;
    if (t.isStringLiteral(attr.value)) {
        return attr.value.value.trim().toLowerCase() === 'true';
    }
    if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        if (t.isBooleanLiteral(expr))
            return expr.value;
        if (t.isStringLiteral(expr)) {
            return expr.value.trim().toLowerCase() === 'true';
        }
    }
    return false;
}
function isJsxStyleHidden(opening) {
    const attr = (0, utils_1.getJsxAttribute)(opening, 'style');
    if (!attr || !attr.value)
        return false;
    if (t.isStringLiteral(attr.value)) {
        return isHiddenStyle(attr.value.value);
    }
    if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        if (t.isStringLiteral(expr))
            return isHiddenStyle(expr.value);
    }
    return false;
}
function isJsxHiddenFromAT(opening) {
    return isJsxHidden(opening) || isJsxAriaHidden(opening) || isJsxStyleHidden(opening);
}
function mergeStates(states) {
    if (states.some((s) => s === 'present'))
        return 'present';
    if (states.some((s) => s === 'possiblyEmpty'))
        return 'possiblyEmpty';
    return 'empty';
}
function jsxImgAltState(opening) {
    const alt = getStaticJsxAttrText(opening, 'alt');
    if (alt === undefined)
        return 'empty';
    if (alt === null)
        return 'empty';
    return alt.trim().length > 0 ? 'present' : 'empty';
}
function jsxChildTextState(child, hidden) {
    if (hidden)
        return 'empty';
    if (t.isJSXText(child))
        return child.value.trim().length > 0 ? 'present' : 'empty';
    if (t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (t.isJSXElement(expr))
            return jsxElementTextState(expr, hidden);
        if (t.isJSXFragment(expr)) {
            return mergeStates(expr.children.map((c) => jsxChildTextState(c, hidden)));
        }
        return (0, utils_1.getJsxExpressionState)(expr, true);
    }
    if (t.isJSXElement(child))
        return jsxElementTextState(child, hidden);
    if (t.isJSXFragment(child)) {
        return mergeStates(child.children.map((c) => jsxChildTextState(c, hidden)));
    }
    if (t.isJSXSpreadChild(child))
        return 'present';
    return 'empty';
}
function jsxElementTextState(node, parentHidden) {
    const opening = node.openingElement;
    const isHidden = parentHidden || isJsxHiddenFromAT(opening);
    if (isHidden)
        return 'empty';
    const tag = getJsxTagName(opening);
    if (tag === 'img') {
        return jsxImgAltState(opening);
    }
    return mergeStates(node.children.map((c) => jsxChildTextState(c, isHidden)));
}
function hasJsxAriaLabelledByText(opening, idMap) {
    const labelledBy = getStaticJsxAttrText(opening, 'aria-labelledby');
    if (!labelledBy)
        return false;
    const ids = labelledBy.trim().split(/\s+/).filter(Boolean);
    if (!ids.length)
        return false;
    for (const id of ids) {
        const targets = idMap.get(id);
        if (!targets)
            continue;
        for (const target of targets) {
            const state = jsxElementTextState(target, false);
            if (state === 'present')
                return true;
        }
    }
    return false;
}
function requireButtonText() {
    const htmlButtons = [];
    const htmlIds = new Map();
    const jsxButtons = [];
    const jsxIds = new Map();
    return {
        name: 'requireButtonText',
        enterHtml(node) {
            if (node.type === 'element') {
                const id = node.attrs.id;
                if (id && id.trim().length > 0) {
                    if (!htmlIds.has(id))
                        htmlIds.set(id, []);
                    htmlIds.get(id).push(node);
                }
                if (node.tagName === 'button') {
                    htmlButtons.push({ node });
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tag = getJsxTagName(opening);
            const id = getStaticJsxAttrText(opening, 'id');
            if (typeof id === 'string' && id.trim().length > 0) {
                if (!jsxIds.has(id))
                    jsxIds.set(id, []);
                jsxIds.get(id).push(path.node);
            }
            if (tag === 'button') {
                const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                jsxButtons.push({ node: path.node, line, column });
            }
            return [];
        },
        end() {
            var _a;
            const results = [];
            for (const { node } of htmlButtons) {
                if (isHtmlHidden(node))
                    continue;
                const hasLabel = hasHtmlNonEmptyAriaLabel(node);
                const hasLabelledBy = hasHtmlAriaLabelledByText(node, htmlIds);
                const hasTitle = hasHtmlNonEmptyTitle(node);
                const hasContent = hasHtmlAccessibleText(node, false);
                if (!hasLabel && !hasLabelledBy && !hasTitle && !hasContent) {
                    results.push({
                        line: 0,
                        column: 0,
                        offset: node.startIndex,
                        message: '<button> missing accessible text',
                        rule: 'requireButtonText',
                    });
                }
            }
            for (const { node, line, column } of jsxButtons) {
                const opening = node.openingElement;
                if (isJsxHiddenFromAT(opening))
                    continue;
                if (hasJsxSpreadAttribute(opening))
                    continue;
                const ariaState = (0, utils_1.getJsxAttributeState)(opening, 'aria-label', true);
                const hasLabel = ariaState === 'present';
                const hasLabelledBy = hasJsxAriaLabelledByText(opening, jsxIds);
                const hasTitle = (0, utils_1.getJsxAttributeState)(opening, 'title', true) === 'present';
                const contentState = jsxElementTextState(node, false);
                const hasContent = contentState === 'present';
                if (!hasLabel && !hasLabelledBy && !hasTitle && !hasContent) {
                    results.push({
                        line,
                        column,
                        offset: (_a = opening.start) !== null && _a !== void 0 ? _a : undefined,
                        message: '<button> missing accessible text',
                        rule: 'requireButtonText',
                    });
                }
            }
            return results;
        },
    };
}
