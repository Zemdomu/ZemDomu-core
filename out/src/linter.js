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
const rule_codes_1 = require("./rule-codes");
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
        requireSectionHeading: "error",
        enforceHeadingOrder: "error",
        singleH1: "error",
        requireAltText: "error",
        requireLabelForFormControls: "error",
        enforceListNesting: "error",
        requireLinkText: "error",
        requireTableCaption: "error",
        preventEmptyInlineTags: "warning",
        requireHrefOnAnchors: "error",
        requireButtonText: "error",
        requireIframeTitle: "error",
        requireHtmlLang: "error",
        requireImageInputAlt: "error",
        requireNavLinks: "warning",
        uniqueIds: "error",
        noTabindexGreaterThanZero: "warning",
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
        filePath: options.filePath,
        forceHtml: options.forceHtml,
        perf: options.perf,
    };
    const results = [];
    const timings = {};
    const ruleTimes = {};
    const totalStart = Date.now();
    // Pair each rule with its severity
    const activeRules = [];
    for (const name in opts.rules) {
        const severity = opts.rules[name];
        if (severity !== "off" && builtInRules[name]) {
            activeRules.push({ rule: builtInRules[name](), severity });
        }
    }
    if (opts.customRules) {
        for (const rule of opts.customRules) {
            activeRules.push({ rule, severity: "error" }); // default custom to error
        }
    }
    activeRules.forEach(({ rule }) => rule.init && rule.init());
    let ast = null;
    let parseErrors = [];
    if (!opts.forceHtml) {
        const t0 = Date.now();
        try {
            ast = (0, parser_1.parse)(content, {
                sourceType: "module",
                plugins: ["typescript", "jsx"],
                errorRecovery: true,
            });
            if (Array.isArray(ast.errors)) {
                parseErrors = ast.errors;
            }
        }
        catch (e) {
            ast = null;
            parseErrors = [e];
        }
        timings.parse = Date.now() - t0;
    }
    if (ast) {
        (0, traverse_1.default)(ast, {
            JSXElement: {
                enter(path) {
                    var _a, _b;
                    for (const { rule, severity } of activeRules) {
                        if (rule.enterJsx) {
                            try {
                                const s = Date.now();
                                results.push(...rule
                                    .enterJsx(path)
                                    .map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
                                ruleTimes[rule.name] =
                                    (ruleTimes[rule.name] || 0) + (Date.now() - s);
                            }
                            catch (e) {
                                console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : "unknown"}):`, e);
                            }
                        }
                        // Handle simple custom rules with test/message for JSX
                        if (rule.test && rule.message) {
                            try {
                                const ts = Date.now();
                                if (rule.test(path.node)) {
                                    results.push({
                                        line: 0,
                                        column: 0,
                                        message: rule.message,
                                        rule: rule.name,
                                        severity,
                                    });
                                }
                                ruleTimes[rule.name] =
                                    (ruleTimes[rule.name] || 0) + (Date.now() - ts);
                            }
                            catch (e) {
                                console.error(`[ZemDomu] Error in custom rule ${rule.name} (${(_b = opts.filePath) !== null && _b !== void 0 ? _b : "unknown"}):`, e);
                            }
                        }
                    }
                },
                exit(path) {
                    var _a;
                    for (const { rule, severity } of activeRules) {
                        if (rule.exitJsx) {
                            try {
                                const s = Date.now();
                                results.push(...rule
                                    .exitJsx(path)
                                    .map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
                                ruleTimes[rule.name] =
                                    (ruleTimes[rule.name] || 0) + (Date.now() - s);
                            }
                            catch (e) {
                                console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : "unknown"}):`, e);
                            }
                        }
                    }
                },
            },
        });
        activeRules.forEach(({ rule, severity }) => {
            if (rule.end) {
                const s = Date.now();
                results.push(...rule.end().map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
                ruleTimes[rule.name] =
                    (ruleTimes[rule.name] || 0) + (Date.now() - s);
            }
        });
        for (const [r, tms] of Object.entries(ruleTimes)) {
            timings[`rule:${r}`] = tms;
        }
        for (const err of parseErrors) {
            const loc = err.loc
                ? { line: err.loc.line - 1, column: err.loc.column }
                : { line: 0, column: 0 };
            results.push({
                ...loc,
                message: `Parse error: ${err.message}`,
                rule: "parseError",
            });
        }
        timings.total = Date.now() - totalStart;
        if (opts.perf && opts.filePath)
            opts.perf.record(opts.filePath, timings);
        return results;
    }
    const root = (0, simpleHtmlParser_1.parse)(content);
    // If the source contained only comments or whitespace, ignore parse errors
    const onlyComments = root.children.every((n) => n.type === "comment" || (n.type === "text" && n.text.trim() === ""));
    if (onlyComments) {
        parseErrors = [];
    }
    const walk = (node) => {
        var _a, _b, _c;
        for (const { rule, severity } of activeRules) {
            if (rule.enterHtml) {
                try {
                    const s = Date.now();
                    results.push(...rule
                        .enterHtml(node)
                        .map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
                    ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
                }
                catch (e) {
                    console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : "unknown"}):`, e);
                }
            }
            // Handle simple custom rules with test/message
            if (rule.test && rule.message) {
                try {
                    const ts = Date.now();
                    if (rule.test(node)) {
                        results.push({
                            line: 0,
                            column: 0,
                            message: rule.message,
                            rule: rule.name,
                            severity,
                        });
                    }
                    ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - ts);
                }
                catch (e) {
                    console.error(`[ZemDomu] Error in custom rule ${rule.name} (${(_b = opts.filePath) !== null && _b !== void 0 ? _b : "unknown"}):`, e);
                }
            }
        }
        if (node.children) {
            for (const child of node.children) {
                walk(child);
            }
        }
        for (const { rule, severity } of activeRules) {
            if (rule.exitHtml) {
                try {
                    const s = Date.now();
                    results.push(...rule.exitHtml(node).map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
                    ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
                }
                catch (e) {
                    console.error(`[ZemDomu] Error in rule ${rule.name} (${(_c = opts.filePath) !== null && _c !== void 0 ? _c : "unknown"}):`, e);
                }
            }
        }
    };
    walk(root);
    activeRules.forEach(({ rule, severity }) => {
        if (rule.end) {
            const s = Date.now();
            results.push(...rule.end().map((r) => (0, rule_codes_1.applyRuleCode)({ ...r, severity })));
            ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
        }
    });
    for (const [r, tms] of Object.entries(ruleTimes)) {
        timings[`rule:${r}`] = tms;
    }
    for (const err of parseErrors) {
        const loc = err.loc ? { line: err.loc.line - 1, column: err.loc.column } : { line: 0, column: 0 };
        results.push({
            ...loc,
            message: `Parse error: ${err.message}`,
            rule: "parseError",
        });
    }
    timings.total = Date.now() - totalStart;
    if (opts.perf && opts.filePath)
        opts.perf.record(opts.filePath, timings);
    return results;
}
