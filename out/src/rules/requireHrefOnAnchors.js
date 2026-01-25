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
exports.default = requireHrefOnAnchors;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function requireHrefOnAnchors() {
    return {
        name: 'requireHrefOnAnchors',
        enterHtml(node) {
            var _a, _b;
            if (node.type === 'element' && node.tagName === 'a') {
                const href = (_b = (_a = node.attrs.href) !== null && _a !== void 0 ? _a : node.attrs[':href']) !== null && _b !== void 0 ? _b : node.attrs['v-bind:href'];
                if (!href || !href.trim()) {
                    return [
                        {
                            line: 0,
                            column: 0,
                            message: '<a> tag missing non-empty href attribute',
                            rule: 'requireHrefOnAnchors',
                        },
                    ];
                }
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
            if (tag === 'a') {
                const hrefState = (0, utils_1.getJsxAttributeState)(opening, 'href', true);
                if (hrefState === 'missing' || hrefState === 'empty' || hrefState === 'possiblyEmpty') {
                    const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                    const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                    const message = hrefState === 'possiblyEmpty'
                        ? '<a> href is possibly empty or undefined'
                        : '<a> tag missing non-empty href attribute';
                    return [{ line, column, message, rule: 'requireHrefOnAnchors' }];
                }
            }
            return [];
        },
    };
}
