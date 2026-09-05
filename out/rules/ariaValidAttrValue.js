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
exports.default = ariaValidAttrValue;
const t = __importStar(require("@babel/types"));
const BOOLEAN_ATTRS = new Set([
    "aria-hidden",
    "aria-expanded",
    "aria-selected",
    "aria-disabled",
    "aria-required",
    "aria-modal",
    "aria-multiline",
    "aria-multiselectable",
    "aria-readonly",
    "aria-busy",
    "aria-atomic",
]);
const TRISTATE_ATTRS = new Set(["aria-checked", "aria-pressed"]);
const NUMERIC_ATTRS = new Set([
    "aria-level",
    "aria-valuemin",
    "aria-valuemax",
    "aria-valuenow",
    "aria-colindex",
    "aria-rowindex",
    "aria-colcount",
    "aria-rowcount",
    "aria-setsize",
    "aria-posinset",
]);
const IDREF_LIST_ATTRS = new Set([
    "aria-labelledby",
    "aria-describedby",
    "aria-controls",
    "aria-owns",
    "aria-details",
    "aria-errormessage",
    "aria-flowto",
]);
const TOKEN_ATTRS = {
    "aria-current": new Set([
        "page",
        "step",
        "location",
        "date",
        "time",
        "true",
        "false",
    ]),
    "aria-live": new Set(["off", "polite", "assertive"]),
    "aria-sort": new Set(["none", "ascending", "descending", "other"]),
    "aria-orientation": new Set(["horizontal", "vertical"]),
    "aria-haspopup": new Set([
        "false",
        "true",
        "menu",
        "listbox",
        "tree",
        "grid",
        "dialog",
    ]),
    "aria-autocomplete": new Set(["inline", "list", "both", "none"]),
    "aria-invalid": new Set(["false", "true", "grammar", "spelling"]),
};
const MULTI_TOKEN_ATTRS = {
    "aria-relevant": new Set(["additions", "removals", "text", "all"]),
};
function normalize(value) {
    return value.trim().toLowerCase();
}
function isNumeric(value) {
    if (!value.trim())
        return false;
    return Number.isFinite(Number(value));
}
function isNonEmptyIdRefList(value) {
    const tokens = value
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
    return tokens.length > 0;
}
function isSupportedAriaAttr(attr) {
    return (BOOLEAN_ATTRS.has(attr) ||
        TRISTATE_ATTRS.has(attr) ||
        NUMERIC_ATTRS.has(attr) ||
        IDREF_LIST_ATTRS.has(attr) ||
        Object.prototype.hasOwnProperty.call(TOKEN_ATTRS, attr) ||
        Object.prototype.hasOwnProperty.call(MULTI_TOKEN_ATTRS, attr));
}
function isValidAriaValue(attr, rawValue) {
    const value = normalize(rawValue);
    if (!isSupportedAriaAttr(attr))
        return true;
    if (!value)
        return false;
    if (BOOLEAN_ATTRS.has(attr)) {
        return value === "true" || value === "false";
    }
    if (TRISTATE_ATTRS.has(attr)) {
        return (value === "true" ||
            value === "false" ||
            value === "mixed" ||
            value === "undefined");
    }
    if (NUMERIC_ATTRS.has(attr)) {
        return isNumeric(value);
    }
    if (IDREF_LIST_ATTRS.has(attr)) {
        return isNonEmptyIdRefList(rawValue);
    }
    const tokenSet = TOKEN_ATTRS[attr];
    if (tokenSet) {
        return tokenSet.has(value);
    }
    const multiTokenSet = MULTI_TOKEN_ATTRS[attr];
    if (multiTokenSet) {
        const tokens = value.split(/\s+/).filter(Boolean);
        return tokens.length > 0 && tokens.every((token) => multiTokenSet.has(token));
    }
    return true;
}
function jsxStaticAriaValue(attr) {
    // JSX shorthand attributes evaluate to boolean true. React serializes valid
    // boolean-like ARIA values such as `aria-hidden` as "true".
    if (!attr.value)
        return { value: "true", dynamic: false };
    if (t.isStringLiteral(attr.value))
        return { value: attr.value.value, dynamic: false };
    if (!t.isJSXExpressionContainer(attr.value))
        return { value: "", dynamic: true };
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr))
        return { value: expr.value, dynamic: false };
    if (t.isBooleanLiteral(expr))
        return { value: String(expr.value), dynamic: false };
    if (t.isNumericLiteral(expr))
        return { value: String(expr.value), dynamic: false };
    if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
        const staticValue = expr.quasis.map((q) => { var _a; return (_a = q.value.cooked) !== null && _a !== void 0 ? _a : q.value.raw; }).join("");
        return { value: staticValue, dynamic: false };
    }
    return { value: "", dynamic: true };
}
function invalidValueResult(attr, rawValue, line, column) {
    return {
        line,
        column,
        message: `ARIA attribute "${attr}" has invalid value "${rawValue}"`,
        rule: "ariaValidAttrValue",
    };
}
function ariaValidAttrValue() {
    return {
        name: "ariaValidAttrValue",
        enterHtml(node) {
            if (node.type !== "element")
                return [];
            const results = [];
            for (const [rawName, rawValue] of Object.entries(node.attrs)) {
                const name = rawName.toLowerCase();
                if (name.startsWith(":aria-") || name.startsWith("v-bind:aria-"))
                    continue;
                if (!name.startsWith("aria-"))
                    continue;
                if (!isSupportedAriaAttr(name))
                    continue;
                const value = String(rawValue !== null && rawValue !== void 0 ? rawValue : "");
                if (!isValidAriaValue(name, value)) {
                    results.push(invalidValueResult(name, value, 0, 0));
                }
            }
            return results;
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const results = [];
            const attrs = path.node.openingElement.attributes;
            for (const attr of attrs) {
                if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name))
                    continue;
                const name = attr.name.name.toLowerCase();
                if (!name.startsWith("aria-"))
                    continue;
                if (!isSupportedAriaAttr(name))
                    continue;
                const { value, dynamic } = jsxStaticAriaValue(attr);
                if (dynamic)
                    continue;
                if (!isValidAriaValue(name, value)) {
                    const line = ((_d = (_b = (_a = attr.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.line) !== null && _d !== void 0 ? _d : 1) - 1;
                    const column = (_h = (_f = (_e = attr.loc) === null || _e === void 0 ? void 0 : _e.start.column) !== null && _f !== void 0 ? _f : (_g = path.node.loc) === null || _g === void 0 ? void 0 : _g.start.column) !== null && _h !== void 0 ? _h : 0;
                    results.push(invalidValueResult(name, value, line, column));
                }
            }
            return results;
        },
    };
}
