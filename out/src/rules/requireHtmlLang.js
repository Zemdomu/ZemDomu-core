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
function requireHtmlLang() {
    let seen = false;
    return {
        name: 'requireHtmlLang',
        enterHtml(node) {
            if (!seen && node.type === 'element' && node.tagName === 'html') {
                seen = true;
                const lang = node.attrs.lang;
                if (lang === undefined) {
                    return [{ line: 0, column: 0, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
                }
                if (!String(lang).trim()) {
                    return [{ line: 0, column: 0, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
            if (!seen && tag === 'html') {
                seen = true;
                const lang = (0, utils_1.getJsxAttr)(opening, 'lang');
                if (lang === undefined || !lang.trim()) {
                    const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    return [{ line, column, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
                }
            }
            return [];
        },
    };
}
