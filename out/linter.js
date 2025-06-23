"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lint = lint;
const simpleHtmlParser_1 = require("./simpleHtmlParser");
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const requireAltText_1 = __importDefault(require("./rules/requireAltText"));
const requireSectionHeading_1 = __importDefault(require("./rules/requireSectionHeading"));
const enforceHeadingOrder_1 = __importDefault(require("./rules/enforceHeadingOrder"));
const singleH1_1 = __importDefault(require("./rules/singleH1"));
const requireLabelForFormControls_1 = __importDefault(require("./rules/requireLabelForFormControls"));
const enforceListNesting_1 = __importDefault(require("./rules/enforceListNesting"));
const requireLinkText_1 = __importDefault(require("./rules/requireLinkText"));
const requireTableCaption_1 = __importDefault(require("./rules/requireTableCaption"));
const preventEmptyInlineTags_1 = __importDefault(require("./rules/preventEmptyInlineTags"));
const requireHrefOnAnchors_1 = __importDefault(require("./rules/requireHrefOnAnchors"));
const requireButtonText_1 = __importDefault(require("./rules/requireButtonText"));
const requireIframeTitle_1 = __importDefault(require("./rules/requireIframeTitle"));
const requireHtmlLang_1 = __importDefault(require("./rules/requireHtmlLang"));
const requireImageInputAlt_1 = __importDefault(require("./rules/requireImageInputAlt"));
const requireNavLinks_1 = __importDefault(require("./rules/requireNavLinks"));
const uniqueIds_1 = __importDefault(require("./rules/uniqueIds"));
const noTabindexGreaterThanZero_1 = __importDefault(require("./rules/noTabindexGreaterThanZero"));
const builtInRules = {
    requireSectionHeading: requireSectionHeading_1.default,
    enforceHeadingOrder: enforceHeadingOrder_1.default,
    singleH1: singleH1_1.default,
    requireAltText: requireAltText_1.default,
    requireLabelForFormControls: requireLabelForFormControls_1.default,
    enforceListNesting: enforceListNesting_1.default,
    requireLinkText: requireLinkText_1.default,
    requireTableCaption: requireTableCaption_1.default,
    preventEmptyInlineTags: preventEmptyInlineTags_1.default,
    requireHrefOnAnchors: requireHrefOnAnchors_1.default,
    requireButtonText: requireButtonText_1.default,
    requireIframeTitle: requireIframeTitle_1.default,
    requireHtmlLang: requireHtmlLang_1.default,
    requireImageInputAlt: requireImageInputAlt_1.default,
    requireNavLinks: requireNavLinks_1.default,
    uniqueIds: uniqueIds_1.default,
    noTabindexGreaterThanZero: noTabindexGreaterThanZero_1.default,
};
const defaultOptions = {
    rules: {
        requireSectionHeading: true,
        enforceHeadingOrder: true,
        singleH1: true,
        requireAltText: true,
        requireLabelForFormControls: true,
        enforceListNesting: true,
        requireLinkText: true,
        requireTableCaption: true,
        preventEmptyInlineTags: true,
        requireHrefOnAnchors: true,
        requireButtonText: true,
        requireIframeTitle: true,
        requireHtmlLang: true,
        requireImageInputAlt: true,
        requireNavLinks: true,
        uniqueIds: true,
        noTabindexGreaterThanZero: true,
    },
    customRules: [],
};
/**
 * Lint HTML/JSX/TSX content.
 */
function lint(content, options = defaultOptions) {
    var _a;
    const opts = {
        rules: { ...defaultOptions.rules, ...(options.rules || {}) },
        customRules: (_a = options.customRules) !== null && _a !== void 0 ? _a : defaultOptions.customRules,
    };
    const results = [];
    const activeRules = [];
    for (const name in opts.rules) {
        const enabled = opts.rules[name];
        if (enabled && builtInRules[name]) {
            activeRules.push(builtInRules[name]());
        }
    }
    if (opts.customRules)
        activeRules.push(...opts.customRules);
    activeRules.forEach(r => r.init && r.init());
    let ast = null;
    try {
        ast = (0, parser_1.parse)(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
    }
    catch {
        ast = null;
    }
    if (ast) {
        (0, traverse_1.default)(ast, {
            JSXElement: {
                enter(path) {
                    var _a;
                    for (const rule of activeRules) {
                        if (rule.enterJsx) {
                            try {
                                results.push(...rule.enterJsx(path));
                            }
                            catch (e) {
                                console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : 'unknown'}):`, e);
                            }
                        }
                    }
                },
                exit(path) {
                    var _a;
                    for (const rule of activeRules) {
                        if (rule.exitJsx) {
                            try {
                                results.push(...rule.exitJsx(path));
                            }
                            catch (e) {
                                console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : 'unknown'}):`, e);
                            }
                        }
                    }
                },
            },
        });
        activeRules.forEach(r => r.end && results.push(...r.end()));
        return results;
    }
    const root = (0, simpleHtmlParser_1.parse)(content);
    const walk = (node) => {
        var _a, _b;
        for (const rule of activeRules) {
            if (rule.enterHtml) {
                try {
                    results.push(...rule.enterHtml(node));
                }
                catch (e) {
                    console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : 'unknown'}):`, e);
                }
            }
        }
        if (node.children) {
            for (const child of node.children) {
                walk(child);
            }
        }
        for (const rule of activeRules) {
            if (rule.exitHtml) {
                try {
                    results.push(...rule.exitHtml(node));
                }
                catch (e) {
                    console.error(`[ZemDomu] Error in rule ${rule.name} (${(_b = opts.filePath) !== null && _b !== void 0 ? _b : 'unknown'}):`, e);
                }
            }
        }
    };
    walk(root);
    activeRules.forEach(r => r.end && results.push(...r.end()));
    return results;
}
