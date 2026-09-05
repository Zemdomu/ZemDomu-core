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
exports.default = requireSectionHeading;
const t = __importStar(require("@babel/types"));
const utils_1 = require("./utils");
const page_utils_1 = require("./page-utils");
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
function hasHtmlAriaLabel(node) {
    const aria = node.attrs['aria-label'];
    return typeof aria === 'string' && aria.trim().length > 0;
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
    const hiddenAttr = (0, utils_1.getJsxAttr)(opening, 'hidden');
    if (hiddenAttr !== undefined)
        return true;
    const ariaHidden = (0, utils_1.getJsxAttr)(opening, 'aria-hidden');
    if (ariaHidden && ariaHidden.trim().toLowerCase() === 'true')
        return true;
    const style = (0, utils_1.getJsxAttr)(opening, 'style');
    if (style)
        return isHiddenStyle(style);
    return false;
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
function requireSectionHeading() {
    const htmlIdMap = new Map();
    const htmlStack = [];
    const htmlSections = [];
    const jsxIdMap = new Map();
    const jsxStack = [];
    const jsxSections = [];
    return {
        name: 'requireSectionHeading',
        enterHtml(node) {
            if (node.type === 'element') {
                const id = node.attrs.id;
                if (id && id.trim()) {
                    const trimmed = id.trim();
                    if (!htmlIdMap.has(trimmed))
                        htmlIdMap.set(trimmed, []);
                    htmlIdMap.get(trimmed).push(node);
                }
                if (node.tagName === 'section')
                    htmlStack.push({ node, hasHeading: false });
                if (/^h[1-6]$/i.test(node.tagName) && htmlStack.length) {
                    htmlStack[htmlStack.length - 1].hasHeading = true;
                }
            }
            return [];
        },
        exitHtml(node) {
            if (node.type === 'element' && node.tagName === 'section') {
                const s = htmlStack.pop();
                if (s)
                    htmlSections.push(s);
            }
            return [];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const opening = path.node.openingElement;
            const tag = (0, utils_1.getTag)(path);
            const id = (0, utils_1.getJsxAttr)(opening, 'id');
            if (id && id.trim()) {
                const trimmed = id.trim();
                if (!jsxIdMap.has(trimmed))
                    jsxIdMap.set(trimmed, []);
                jsxIdMap.get(trimmed).push(path.node);
            }
            if (tag === 'section') {
                const line = ((_b = (_a = opening.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1;
                const column = (_d = (_c = opening.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
                jsxStack.push({ node: path.node, hasHeading: false, line, column });
            }
            if (/^h[1-6]$/.test(tag) && jsxStack.length) {
                jsxStack[jsxStack.length - 1].hasHeading = true;
            }
            return [];
        },
        exitJsx(path) {
            const tag = (0, utils_1.getTag)(path);
            if (tag === 'section') {
                const s = jsxStack.pop();
                if (s)
                    jsxSections.push(s);
            }
            return [];
        },
        end() {
            var _a;
            const results = [];
            for (const section of htmlSections) {
                if (section.hasHeading)
                    continue;
                if (hasHtmlAriaLabel(section.node))
                    continue;
                if (hasHtmlAriaLabelledByText(section.node, htmlIdMap))
                    continue;
                results.push({
                    line: 0,
                    column: 0,
                    offset: section.node.startIndex,
                    message: '<section> missing heading (<h1>-<h6>) or accessible label (aria-label / aria-labelledby)',
                    rule: 'requireSectionHeading',
                });
            }
            for (const section of jsxSections) {
                if (section.hasHeading)
                    continue;
                const opening = section.node.openingElement;
                const ariaState = (0, utils_1.getJsxAttributeState)(opening, 'aria-label', true);
                if (ariaState === 'present' || ariaState === 'possiblyEmpty')
                    continue;
                if (hasJsxAriaLabelledByText(opening, jsxIdMap))
                    continue;
                results.push({
                    line: section.line,
                    column: section.column,
                    offset: (_a = section.node.openingElement.start) !== null && _a !== void 0 ? _a : undefined,
                    message: '<section> missing heading (<h1>-<h6>) or accessible label (aria-label / aria-labelledby)',
                    rule: 'requireSectionHeading',
                });
            }
            return results;
        },
        analyzePage(context) {
            if (!(0, page_utils_1.isResolvedPage)(context) || !(0, page_utils_1.isCompletePage)(context))
                return [];
            const headings = context.page.facts.filter((fact) => fact.kind === 'heading' && (0, page_utils_1.isUnconditional)(fact));
            return context.page.facts
                .filter((fact) => fact.kind === 'section' && (0, page_utils_1.isUnconditional)(fact))
                .flatMap((section) => {
                // The file rule is the source of truth for local headings and
                // accessible labels. Page analysis only refines its candidates with
                // resolved descendant component output.
                const localCandidate = (0, page_utils_1.matchingFileResult)(context, 'requireSectionHeading', section);
                if (!localCandidate)
                    return [];
                const resolvedChildHeading = headings.some((heading) => {
                    var _a;
                    const ancestors = (_a = heading.sectionAncestorIds) !== null && _a !== void 0 ? _a : [];
                    const nearestSection = ancestors[ancestors.length - 1];
                    return nearestSection === section.renderNodeId;
                });
                const source = (0, page_utils_1.sourceForFact)(section, context);
                if (resolvedChildHeading) {
                    return source
                        ? [{
                                ...localCandidate,
                                ...source,
                                filePath: source.filePath,
                                pageSuppression: true,
                            }]
                        : [];
                }
                return source
                    ? [{ ...localCandidate, ...source, filePath: source.filePath }]
                    : [];
            });
        },
    };
}
