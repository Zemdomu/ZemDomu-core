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
exports.getAttr = getAttr;
exports.getJsxAttr = getJsxAttr;
exports.getJsxAttribute = getJsxAttribute;
exports.getJsxExpressionState = getJsxExpressionState;
exports.isJsxExpressionPossiblyEmpty = isJsxExpressionPossiblyEmpty;
exports.isJsxAttrValueEmpty = isJsxAttrValueEmpty;
exports.getJsxAttributeState = getJsxAttributeState;
exports.hasHtmlLinkAttribute = hasHtmlLinkAttribute;
exports.hasJsxLinkAttribute = hasJsxLinkAttribute;
exports.getTag = getTag;
exports.getJsxRenderGroup = getJsxRenderGroup;
const t = __importStar(require("@babel/types"));
function getAttr(node, name) {
    return node.attrs[name];
}
function getJsxAttr(opening, name) {
    const attr = opening.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name);
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
}
function getJsxAttribute(opening, name) {
    return opening.attributes.find((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name);
}
function isEmptyString(value, trimText) {
    return trimText ? value.trim().length === 0 : value.length === 0;
}
function mergeConditionalStates(a, b) {
    if (a === 'present' && b === 'present')
        return 'present';
    if (a === 'empty' && b === 'empty')
        return 'empty';
    return 'possiblyEmpty';
}
function mergeTemplateStates(states) {
    if (states.some((s) => s === 'present'))
        return 'present';
    if (states.some((s) => s === 'possiblyEmpty'))
        return 'possiblyEmpty';
    return 'empty';
}
function getJsxExpressionState(expression, trimText) {
    if (t.isTSType(expression))
        return 'present';
    if (t.isJSXEmptyExpression(expression))
        return 'empty';
    if (t.isNullLiteral(expression))
        return 'empty';
    if (t.isIdentifier(expression, { name: 'undefined' }))
        return 'empty';
    if (t.isBooleanLiteral(expression))
        return 'empty';
    if (t.isOptionalMemberExpression(expression) || t.isOptionalCallExpression(expression)) {
        return 'possiblyEmpty';
    }
    if (t.isStringLiteral(expression)) {
        return isEmptyString(expression.value, trimText) ? 'empty' : 'present';
    }
    if (t.isTemplateLiteral(expression)) {
        if (expression.expressions.length === 0) {
            const raw = expression.quasis
                .map((q) => { var _a; return (_a = q.value.cooked) !== null && _a !== void 0 ? _a : q.value.raw; })
                .join('');
            return isEmptyString(raw, trimText) ? 'empty' : 'present';
        }
        const staticText = expression.quasis
            .map((q) => { var _a; return (_a = q.value.cooked) !== null && _a !== void 0 ? _a : q.value.raw; })
            .join('');
        if (staticText.trim().length > 0)
            return 'present';
        const exprStates = expression.expressions.map((expr) => getJsxExpressionState(expr, trimText));
        return mergeTemplateStates(exprStates);
    }
    if (t.isConditionalExpression(expression)) {
        return mergeConditionalStates(getJsxExpressionState(expression.consequent, trimText), getJsxExpressionState(expression.alternate, trimText));
    }
    if (t.isLogicalExpression(expression)) {
        const left = getJsxExpressionState(expression.left, trimText);
        if (expression.operator === '&&') {
            if (left === 'empty')
                return 'empty';
            if (left === 'present') {
                return getJsxExpressionState(expression.right, trimText);
            }
            return 'possiblyEmpty';
        }
        if (expression.operator === '||' || expression.operator === '??') {
            if (left === 'present')
                return 'present';
            if (left === 'empty') {
                return getJsxExpressionState(expression.right, trimText);
            }
            const right = getJsxExpressionState(expression.right, trimText);
            if (right === 'present')
                return 'present';
            return 'possiblyEmpty';
        }
    }
    if (t.isUnaryExpression(expression) && expression.operator === 'void')
        return 'empty';
    return 'present';
}
function isJsxExpressionPossiblyEmpty(expression, trimText) {
    return getJsxExpressionState(expression, trimText) !== 'present';
}
function isJsxAttrValueEmpty(value, trimText) {
    if (!value)
        return true;
    if (t.isStringLiteral(value)) {
        return isEmptyString(value.value, trimText);
    }
    if (t.isJSXExpressionContainer(value)) {
        return isJsxExpressionPossiblyEmpty(value.expression, trimText);
    }
    return false;
}
function getJsxAttributeState(opening, name, trimText) {
    const attr = getJsxAttribute(opening, name);
    if (!attr)
        return 'missing';
    if (!attr.value)
        return 'empty';
    if (t.isStringLiteral(attr.value)) {
        return isEmptyString(attr.value.value, trimText) ? 'empty' : 'present';
    }
    if (t.isJSXExpressionContainer(attr.value)) {
        return getJsxExpressionState(attr.value.expression, trimText);
    }
    return 'present';
}
const LINK_ATTRS = ['href', 'to', ':href', 'v-bind:href', ':to', 'v-bind:to'];
function isPresentState(state) {
    return state !== 'missing' && state !== 'empty';
}
function hasHtmlLinkAttribute(attrs) {
    for (const key of LINK_ATTRS) {
        if (!(key in attrs))
            continue;
        const value = attrs[key];
        if (typeof value !== 'string')
            return true;
        if (value.trim().length > 0)
            return true;
    }
    return false;
}
function hasJsxLinkAttribute(opening) {
    const hrefState = getJsxAttributeState(opening, 'href', true);
    const toState = getJsxAttributeState(opening, 'to', true);
    return isPresentState(hrefState) || isPresentState(toState);
}
function getTag(path) {
    const opening = path.node.openingElement;
    return t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
}
function locKey(loc) {
    if (!loc)
        return '0:0';
    return `${loc.line}:${loc.column}`;
}
function getJsxRenderGroup(path) {
    var _a, _b, _c, _d, _e;
    const returnPath = path.findParent((p) => p.isReturnStatement());
    let baseGroup = null;
    if (returnPath) {
        baseGroup = `return:${locKey((_a = returnPath.node.loc) === null || _a === void 0 ? void 0 : _a.start)}`;
    }
    const arrowPath = path.findParent((p) => p.isArrowFunctionExpression());
    if (arrowPath) {
        const body = arrowPath.node.body;
        if (t.isJSXElement(body) || t.isJSXFragment(body)) {
            const loc = (_c = (_b = body.loc) === null || _b === void 0 ? void 0 : _b.start) !== null && _c !== void 0 ? _c : (_d = arrowPath.node.loc) === null || _d === void 0 ? void 0 : _d.start;
            baseGroup = `return:${locKey(loc)}`;
        }
    }
    if (!baseGroup)
        baseGroup = 'root';
    const segments = [];
    let current = path;
    while (current === null || current === void 0 ? void 0 : current.parentPath) {
        const parentPath = current.parentPath;
        if (parentPath.isConditionalExpression()) {
            const conditional = parentPath.node;
            const inConsequent = current.node === conditional.consequent ||
                !!current.findParent((p) => p.node === conditional.consequent);
            const inAlternate = current.node === conditional.alternate ||
                !!current.findParent((p) => p.node === conditional.alternate);
            if (inConsequent || inAlternate) {
                const branch = inConsequent ? "then" : "else";
                segments.push(`cond:${locKey((_e = conditional.loc) === null || _e === void 0 ? void 0 : _e.start)}:${branch}`);
            }
        }
        current = parentPath;
    }
    if (!segments.length)
        return baseGroup;
    return `${baseGroup}|${segments.reverse().join("|")}`;
}
