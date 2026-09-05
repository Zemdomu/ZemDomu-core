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
exports.default = requireLabelForFormControls;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
const FORM_CONTROLS = ['input', 'select', 'textarea'];
function isHiddenStyle(style) {
    if (!style)
        return false;
    const normalized = style.toLowerCase().replace(/\s+/g, '');
    return (normalized.includes('display:none') ||
        normalized.includes('visibility:hidden') ||
        normalized.includes('visibility:collapse'));
}
function isHtmlHidden(node) {
    if (Object.prototype.hasOwnProperty.call(node.attrs, 'hidden'))
        return true;
    const ariaHidden = node.attrs['aria-hidden'];
    if (typeof ariaHidden === 'string' && ariaHidden.trim().toLowerCase() === 'true') {
        return true;
    }
    return isHiddenStyle(node.attrs.style);
}
function htmlImgAltPresent(node) {
    const alt = node.attrs.alt;
    return typeof alt === 'string' && alt.trim().length > 0;
}
function hasHtmlAccessibleText(node, hidden) {
    if (hidden)
        return false;
    if (node.type === 'text')
        return node.text.trim().length > 0;
    if (node.type === 'element') {
        const isHidden = hidden || isHtmlHidden(node);
        if (isHidden)
            return false;
        if (node.tagName === 'img')
            return htmlImgAltPresent(node);
        return node.children.some((child) => hasHtmlAccessibleText(child, isHidden));
    }
    return false;
}
function hasHtmlAriaLabelledByText(node, idMap) {
    const labelledBy = node.attrs['aria-labelledby'];
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
function isJsxHidden(opening) {
    const hidden = (0, utils_1.getJsxAttribute)(opening, 'hidden');
    if (hidden) {
        if (!hidden.value)
            return true;
        if (t.isJSXExpressionContainer(hidden.value)) {
            const expression = hidden.value.expression;
            if (t.isBooleanLiteral(expression))
                return expression.value;
            if (t.isNullLiteral(expression))
                return false;
            if (t.isIdentifier(expression, { name: 'undefined' }))
                return false;
        }
        return true;
    }
    const ariaHidden = (0, utils_1.getJsxAttr)(opening, 'aria-hidden');
    if (ariaHidden && ariaHidden.trim().toLowerCase() === 'true')
        return true;
    const style = (0, utils_1.getJsxAttr)(opening, 'style');
    if (style)
        return isHiddenStyle(style);
    return false;
}
function getStaticJsxString(opening, name) {
    const attribute = (0, utils_1.getJsxAttribute)(opening, name);
    if (!(attribute === null || attribute === void 0 ? void 0 : attribute.value))
        return undefined;
    if (t.isStringLiteral(attribute.value))
        return attribute.value.value;
    if (!t.isJSXExpressionContainer(attribute.value))
        return undefined;
    const expression = attribute.value.expression;
    if (t.isStringLiteral(expression))
        return expression.value;
    if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
        return expression.quasis
            .map((quasi) => { var _a; return (_a = quasi.value.cooked) !== null && _a !== void 0 ? _a : quasi.value.raw; })
            .join('');
    }
    return undefined;
}
function isHtmlInputExempt(node) {
    var _a, _b, _c;
    if (node.tagName !== 'input')
        return false;
    if (isHtmlHidden(node))
        return true;
    const type = ((_a = node.attrs.type) !== null && _a !== void 0 ? _a : 'text').trim().toLowerCase();
    if (type === 'hidden')
        return true;
    if (type === 'image')
        return Boolean((_b = node.attrs.alt) === null || _b === void 0 ? void 0 : _b.trim());
    if (type === 'submit' || type === 'reset') {
        return node.attrs.value === undefined || node.attrs.value.trim().length > 0;
    }
    return type === 'button' && Boolean((_c = node.attrs.value) === null || _c === void 0 ? void 0 : _c.trim());
}
function isJsxInputExempt(opening) {
    var _a;
    const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
    if (tag !== 'input')
        return false;
    if (isJsxHidden(opening))
        return true;
    const type = ((_a = getStaticJsxString(opening, 'type')) !== null && _a !== void 0 ? _a : 'text')
        .trim()
        .toLowerCase();
    if (type === 'hidden')
        return true;
    if (type === 'image')
        return (0, utils_1.getJsxAttributeState)(opening, 'alt', true) === 'present';
    const valueState = (0, utils_1.getJsxAttributeState)(opening, 'value', true);
    if (type === 'submit' || type === 'reset') {
        return valueState === 'missing' || valueState === 'present';
    }
    return type === 'button' && valueState === 'present';
}
function mergeStates(states) {
    if (states.some((s) => s === 'present'))
        return 'present';
    if (states.some((s) => s === 'possiblyEmpty'))
        return 'possiblyEmpty';
    return 'empty';
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
    const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
    const hidden = parentHidden || isJsxHidden(opening);
    if (hidden)
        return 'empty';
    if (tag === 'img') {
        const alt = (0, utils_1.getJsxAttr)(opening, 'alt');
        return alt && alt.trim().length > 0 ? 'present' : 'empty';
    }
    return mergeStates(node.children.map((c) => jsxChildTextState(c, hidden)));
}
function hasJsxAriaLabelledByText(opening, idMap) {
    const labelledBy = (0, utils_1.getJsxAttr)(opening, 'aria-labelledby');
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
            if (jsxElementTextState(target, false) === 'present')
                return true;
        }
    }
    return false;
}
function requireLabelForFormControls() {
    const htmlLabels = new Set();
    const htmlIds = new Map();
    const htmlControls = [];
    const htmlLabelStack = [];
    const jsxLabels = new Set();
    const jsxIds = new Map();
    const jsxControls = [];
    return {
        name: 'requireLabelForFormControls',
        enterHtml(node) {
            if (node.type === 'element') {
                const id = node.attrs.id;
                if (id && id.trim()) {
                    const trimmedId = id.trim();
                    if (!htmlIds.has(trimmedId))
                        htmlIds.set(trimmedId, []);
                    htmlIds.get(trimmedId).push(node);
                }
                if (node.tagName === 'label') {
                    htmlLabelStack.push(node);
                    const htmlFor = node.attrs['for'];
                    if (htmlFor && htmlFor.trim())
                        htmlLabels.add(htmlFor.trim());
                }
                if (FORM_CONTROLS.includes(node.tagName)) {
                    htmlControls.push({
                        node,
                        implicitLabel: htmlLabelStack[htmlLabelStack.length - 1],
                    });
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e;
            const opening = path.node.openingElement;
            const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
            if (tag === 'label') {
                const htmlFor = (_a = (0, utils_1.getJsxAttr)(opening, 'htmlFor')) !== null && _a !== void 0 ? _a : (0, utils_1.getJsxAttr)(opening, 'for');
                if (htmlFor && htmlFor.trim())
                    jsxLabels.add(htmlFor.trim());
            }
            const id = (0, utils_1.getJsxAttr)(opening, 'id');
            if (id && id.trim()) {
                const trimmedId = id.trim();
                if (!jsxIds.has(trimmedId))
                    jsxIds.set(trimmedId, []);
                jsxIds.get(trimmedId).push(path.node);
            }
            if (FORM_CONTROLS.includes(tag)) {
                const line = ((_c = (_b = opening.loc) === null || _b === void 0 ? void 0 : _b.start.line) !== null && _c !== void 0 ? _c : 1) - 1;
                const column = (_e = (_d = opening.loc) === null || _d === void 0 ? void 0 : _d.start.column) !== null && _e !== void 0 ? _e : 0;
                const labelPath = path.findParent((parent) => parent.isJSXElement() &&
                    t.isJSXIdentifier(parent.node.openingElement.name) &&
                    parent.node.openingElement.name.name === 'label');
                jsxControls.push({
                    node: path.node,
                    line,
                    column,
                    implicitLabel: (labelPath === null || labelPath === void 0 ? void 0 : labelPath.isJSXElement()) ? labelPath.node : undefined,
                });
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && node.tagName === 'label')
                htmlLabelStack.pop();
            return [];
        },
        end() {
            var _a, _b, _c, _d, _e;
            const results = [];
            for (const { node, implicitLabel } of htmlControls) {
                if ((implicitLabel && hasHtmlAccessibleText(implicitLabel, false)) ||
                    isHtmlInputExempt(node))
                    continue;
                if (Object.prototype.hasOwnProperty.call(node.attrs, 'v-bind') &&
                    node.attrs['v-bind'].trim())
                    continue;
                const aria = (_b = (_a = node.attrs['aria-label']) !== null && _a !== void 0 ? _a : node.attrs[':aria-label']) !== null && _b !== void 0 ? _b : node.attrs['v-bind:aria-label'];
                if (aria && aria.trim())
                    continue;
                const dynamicLabelledBy = (_c = node.attrs[':aria-labelledby']) !== null && _c !== void 0 ? _c : node.attrs['v-bind:aria-labelledby'];
                if (dynamicLabelledBy && dynamicLabelledBy.trim())
                    continue;
                if (hasHtmlAriaLabelledByText(node, htmlIds))
                    continue;
                const id = node.attrs.id;
                if (!id || !id.trim()) {
                    results.push({
                        line: 0,
                        column: 0,
                        offset: node.startIndex,
                        message: 'Form control missing id or aria-label',
                        rule: 'requireLabelForFormControls',
                    });
                    continue;
                }
                if (!htmlLabels.has(id)) {
                    results.push({
                        line: 0,
                        column: 0,
                        offset: node.startIndex,
                        message: `Form control with id="${id}" missing <label for="${id}">`,
                        rule: 'requireLabelForFormControls',
                    });
                }
            }
            for (const entry of jsxControls) {
                const opening = entry.node.openingElement;
                if (opening.attributes.some((attr) => t.isJSXSpreadAttribute(attr)))
                    continue;
                if ((entry.implicitLabel &&
                    jsxElementTextState(entry.implicitLabel, false) === 'present') ||
                    isJsxInputExempt(opening))
                    continue;
                const ariaState = (0, utils_1.getJsxAttributeState)(opening, 'aria-label', true);
                if (ariaState === 'present')
                    continue;
                if (hasJsxAriaLabelledByText(opening, jsxIds))
                    continue;
                const id = (0, utils_1.getJsxAttr)(opening, 'id');
                if (!id || !id.trim()) {
                    results.push({
                        line: entry.line,
                        column: entry.column,
                        offset: (_d = opening.start) !== null && _d !== void 0 ? _d : undefined,
                        message: 'Form control missing id or aria-label',
                        rule: 'requireLabelForFormControls',
                    });
                    continue;
                }
                if (!jsxLabels.has(id)) {
                    results.push({
                        line: entry.line,
                        column: entry.column,
                        offset: (_e = opening.start) !== null && _e !== void 0 ? _e : undefined,
                        message: `Form control with id="${id}" missing <label for="${id}">`,
                        rule: 'requireLabelForFormControls',
                    });
                }
            }
            return results;
        },
    };
}
