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
exports.default = requireHtmlLang;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
const HTML_LANG_ATTRS = ['lang', ':lang', 'v-bind:lang'];
function isAlpha(value) {
    return /^[A-Za-z]+$/.test(value);
}
function isAlnum(value) {
    return /^[A-Za-z0-9]+$/.test(value);
}
function isDigit(value) {
    return /^[0-9]+$/.test(value);
}
function isVariant(subtag) {
    if (!isAlnum(subtag))
        return false;
    if (subtag.length >= 5 && subtag.length <= 8)
        return true;
    return subtag.length === 4 && /^[0-9]/.test(subtag);
}
function isExtensionSingleton(subtag) {
    if (!isAlnum(subtag) || subtag.length !== 1)
        return false;
    return subtag.toLowerCase() !== 'x';
}
function isExtensionSubtag(subtag) {
    return isAlnum(subtag) && subtag.length >= 2 && subtag.length <= 8;
}
function isPrivateUseSubtag(subtag) {
    return isAlnum(subtag) && subtag.length >= 1 && subtag.length <= 8;
}
function isDynamicLangValue(value) {
    return value.includes('{') || value.includes('}');
}
function isValidLangTag(lang) {
    if (!lang)
        return false;
    if (lang.includes('_'))
        return false;
    const parts = lang.split('-');
    if (parts.some((p) => p.length === 0))
        return false;
    let index = 0;
    const first = parts[0];
    if (!first)
        return false;
    if (first.toLowerCase() === 'x') {
        if (parts.length === 1)
            return false;
        return parts.slice(1).every(isPrivateUseSubtag);
    }
    if (!isAlpha(first) || (first.length !== 2 && first.length !== 3 && first.length !== 4)) {
        return false;
    }
    index++;
    let extLangCount = 0;
    while (index < parts.length &&
        parts[index].length === 3 &&
        isAlpha(parts[index]) &&
        extLangCount < 3) {
        index++;
        extLangCount++;
    }
    if (index < parts.length && parts[index].length === 4 && isAlpha(parts[index])) {
        index++;
    }
    if (index < parts.length &&
        ((parts[index].length === 2 && isAlpha(parts[index])) ||
            (parts[index].length === 3 && isDigit(parts[index])))) {
        index++;
    }
    while (index < parts.length && isVariant(parts[index])) {
        index++;
    }
    while (index < parts.length && isExtensionSingleton(parts[index])) {
        index++;
        if (index >= parts.length || !isExtensionSubtag(parts[index]))
            return false;
        while (index < parts.length && isExtensionSubtag(parts[index])) {
            index++;
        }
    }
    if (index < parts.length && parts[index].toLowerCase() === 'x') {
        index++;
        if (index >= parts.length)
            return false;
        while (index < parts.length && isPrivateUseSubtag(parts[index])) {
            index++;
        }
    }
    return index === parts.length;
}
function getHtmlLangAttr(attrs) {
    for (const name of HTML_LANG_ATTRS) {
        if (!Object.prototype.hasOwnProperty.call(attrs, name))
            continue;
        const raw = attrs[name];
        return { value: raw !== null && raw !== void 0 ? raw : '', dynamic: name !== 'lang' };
    }
    return null;
}
function requireHtmlLang() {
    let seen = false;
    return {
        name: 'requireHtmlLang',
        enterHtml(node) {
            var _a;
            if (!seen && node.type === 'element' && node.tagName === 'html') {
                seen = true;
                const langAttr = getHtmlLangAttr(node.attrs);
                if (!langAttr) {
                    return [{ line: 0, column: 0, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
                }
                const trimmed = String((_a = langAttr.value) !== null && _a !== void 0 ? _a : '').trim();
                if (!trimmed) {
                    return [{ line: 0, column: 0, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
                }
                if (!langAttr.dynamic && !isDynamicLangValue(trimmed) && !isValidLangTag(trimmed)) {
                    return [{ line: 0, column: 0, message: '<html> lang attribute is invalid', rule: 'requireHtmlLang' }];
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tag = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
            if (!seen && tag === 'html') {
                seen = true;
                const langState = (0, utils_1.getJsxAttributeState)(opening, 'lang', true);
                const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                if (langState === 'missing') {
                    return [{ line, column, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
                }
                if (langState === 'empty') {
                    return [{ line, column, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
                }
                if (langState === 'possiblyEmpty') {
                    return [{ line, column, message: '<html> lang is possibly empty or undefined', rule: 'requireHtmlLang' }];
                }
                const lang = (0, utils_1.getJsxAttr)(opening, 'lang');
                if (lang && !isValidLangTag(lang.trim())) {
                    return [{ line, column, message: '<html> lang attribute is invalid', rule: 'requireHtmlLang' }];
                }
            }
            return [];
        },
    };
}
