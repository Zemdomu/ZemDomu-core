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
exports.default = requireAltText;
const t = __importStar(require("@babel/types"));
function requireAltText() {
    return {
        name: 'requireAltText',
        enterHtml(node) {
            if (node.type === 'element' &&
                node.tagName === 'img' &&
                (!('alt' in node.attrs) || !node.attrs.alt.trim())) {
                return [
                    {
                        line: 0, // line/column handling omitted for brevity
                        column: 0,
                        message: '<img> tag missing alt attribute',
                        rule: 'requireAltText',
                    },
                ];
            }
            return [];
        },
        enterJsx(path) {
            const opening = path.node.openingElement;
            const name = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
            if (name !== 'img')
                return [];
            const altAttr = opening.attributes.find((a) => t.isJSXAttribute(a) &&
                t.isJSXIdentifier(a.name) &&
                a.name.name === 'alt');
            if (!altAttr || !t.isStringLiteral(altAttr.value) || altAttr.value.value.trim() === '') {
                const loc = opening.loc.start;
                return [
                    {
                        line: loc.line - 1,
                        column: loc.column,
                        message: '<img> tag missing alt attribute',
                        rule: 'requireAltText',
                    },
                ];
            }
            return [];
        },
    };
}
