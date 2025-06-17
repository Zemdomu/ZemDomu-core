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
exports.default = enforceListNesting;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
function enforceListNesting() {
    const stack = [];
    return {
        name: 'enforceListNesting',
        enterHtml(node) {
            if (node.type === 'element') {
                stack.push(node.tagName);
                if (node.tagName === 'li') {
                    const parent = stack[stack.length - 2];
                    if (!parent || !['ul', 'ol'].includes(parent)) {
                        return [{ line: 0, column: 0, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
                    }
                }
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element') {
                stack.pop();
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d, _e, _f;
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'li') {
                const parent = (_b = (_a = path.parentPath) === null || _a === void 0 ? void 0 : _a.parentPath) === null || _b === void 0 ? void 0 : _b.node;
                if (parent) {
                    const pTag = t.isJSXIdentifier(parent.openingElement.name) ? parent.openingElement.name.name.toLowerCase() : '';
                    if (!['ul', 'ol'].includes(pTag)) {
                        const line = ((_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.line) !== null && _d !== void 0 ? _d : 1) - 1;
                        const column = (_f = (_e = path.node.loc) === null || _e === void 0 ? void 0 : _e.start.column) !== null && _f !== void 0 ? _f : 0;
                        return [{ line, column, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
                    }
                }
            }
            return [];
        },
    };
}
