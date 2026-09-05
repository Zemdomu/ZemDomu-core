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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActiveRules = createActiveRules;
exports.applyInlineDisableDirectives = applyInlineDisableDirectives;
exports.lint = lint;
const simpleHtmlParser_1 = require("./simpleHtmlParser");
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
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
const preventZemdomuPlaceholders_1 = __importDefault(require("./rules/preventZemdomuPlaceholders"));
const requireDocumentTitle_1 = __importDefault(require("./rules/requireDocumentTitle"));
const requireSingleMain_1 = __importDefault(require("./rules/requireSingleMain"));
const ariaValidAttrValue_1 = __importDefault(require("./rules/ariaValidAttrValue"));
const requirePageH1_1 = __importDefault(require("./rules/requirePageH1"));
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
    preventZemdomuPlaceholders: preventZemdomuPlaceholders_1.default,
    requireDocumentTitle: requireDocumentTitle_1.default,
    requireSingleMain: requireSingleMain_1.default,
    ariaValidAttrValue: ariaValidAttrValue_1.default,
    requirePageH1: requirePageH1_1.default,
};
const defaultOptions = {
    rules: {
        requireSectionHeading: "warning",
        enforceHeadingOrder: "error",
        singleH1: "warning",
        requireAltText: "error",
        requireLabelForFormControls: "error",
        enforceListNesting: "error",
        requireLinkText: "error",
        requireTableCaption: "warning",
        preventEmptyInlineTags: "warning",
        requireHrefOnAnchors: "error",
        requireButtonText: "error",
        requireIframeTitle: "error",
        requireHtmlLang: "error",
        requireImageInputAlt: "error",
        requireNavLinks: "warning",
        uniqueIds: "error",
        noTabindexGreaterThanZero: "warning",
        preventZemdomuPlaceholders: "warning",
        requireDocumentTitle: "error",
        requireSingleMain: "error",
        ariaValidAttrValue: "error",
        requirePageH1: "off",
    },
    customRules: [],
};
function createActiveRules(options = defaultOptions) {
    var _a, _b, _c;
    const rules = { ...defaultOptions.rules, ...((_a = options.rules) !== null && _a !== void 0 ? _a : {}) };
    const active = [];
    for (const name in rules) {
        const severity = rules[name];
        if (severity !== "off" && builtInRules[name]) {
            active.push({ rule: builtInRules[name](), severity });
        }
    }
    for (const rule of (_c = (_b = options.customRules) !== null && _b !== void 0 ? _b : defaultOptions.customRules) !== null && _c !== void 0 ? _c : []) {
        active.push({ rule, severity: "error" });
    }
    return active;
}
function buildLineIndex(content) {
    const lines = [0];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n")
            lines.push(i + 1);
    }
    return lines;
}
function locationAt(lineIndex, offset) {
    const safeOffset = Math.max(0, offset);
    let low = 0;
    let high = lineIndex.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineIndex[mid] <= safeOffset)
            low = mid + 1;
        else
            high = mid - 1;
    }
    const line = Math.max(0, high);
    return { line, column: safeOffset - lineIndex[line] };
}
function attributeNameForResult(result) {
    var _a, _b;
    if (result.rule === "noTabindexGreaterThanZero")
        return "tabindex";
    if (result.rule === "uniqueIds")
        return "id";
    const quotedAria = (_a = /ARIA attribute "([^"]+)"/.exec(result.message)) === null || _a === void 0 ? void 0 : _a[1];
    if (quotedAria)
        return quotedAria;
    const namedAttribute = (_b = /\b(alt|href|lang|title) attribute (?:is empty|is invalid)/i.exec(result.message)) === null || _b === void 0 ? void 0 : _b[1];
    return namedAttribute === null || namedAttribute === void 0 ? void 0 : namedAttribute.toLowerCase();
}
function attributeOffset(content, node, name) {
    const tagEnd = content.indexOf(">", node.startIndex);
    if (tagEnd === -1)
        return undefined;
    const openingTag = content.slice(node.startIndex, tagEnd + 1);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\s)(${escaped})(?=\\s|=|/?>)`, "i").exec(openingTag);
    if (!match || match.index === undefined)
        return undefined;
    return node.startIndex + match.index + match[0].indexOf(match[1]);
}
function withHtmlLocation(result, node, content, lineIndex) {
    var _a;
    let offset = result.offset;
    if (offset === undefined && (result.line !== 0 || result.column !== 0)) {
        offset = ((_a = lineIndex[result.line]) !== null && _a !== void 0 ? _a : 0) + result.column;
    }
    if (offset === undefined && node.type === "element") {
        const attribute = attributeNameForResult(result);
        offset = attribute ? attributeOffset(content, node, attribute) : undefined;
    }
    if (offset === undefined)
        offset = node.startIndex;
    return { ...result, ...locationAt(lineIndex, offset), offset };
}
function withJsxOffset(result, path, lineIndex) {
    var _a, _b, _c, _d, _e, _f, _g;
    const attributeName = attributeNameForResult(result);
    const attributeOffset = attributeName
        ? (_a = path.node.openingElement.attributes.find((attribute) => t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name) &&
            attribute.name.name.toLowerCase() === attributeName.toLowerCase())) === null || _a === void 0 ? void 0 : _a.start
        : undefined;
    const openingLoc = (_b = path.node.openingElement.loc) === null || _b === void 0 ? void 0 : _b.start;
    const hasExplicitLocation = result.line !== 0 ||
        result.column !== 0 ||
        ((openingLoc === null || openingLoc === void 0 ? void 0 : openingLoc.line) === 1 && openingLoc.column === 0);
    const locationOffset = hasExplicitLocation
        ? ((_c = lineIndex[result.line]) !== null && _c !== void 0 ? _c : 0) + result.column
        : undefined;
    const offset = (_g = (_f = (_e = (_d = result.offset) !== null && _d !== void 0 ? _d : attributeOffset) !== null && _e !== void 0 ? _e : locationOffset) !== null && _f !== void 0 ? _f : path.node.openingElement.start) !== null && _g !== void 0 ? _g : path.node.start;
    return offset === null || offset === undefined
        ? result
        : { ...result, ...locationAt(lineIndex, offset), offset };
}
function getJsxComments(content) {
    var _a;
    try {
        const ast = (0, parser_1.parse)(content, {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
            errorRecovery: true,
        });
        return ((_a = ast.comments) !== null && _a !== void 0 ? _a : []).flatMap((comment) => {
            const start = comment.start;
            const end = comment.end;
            if (start === null || start === undefined || end === null || end === undefined) {
                return [];
            }
            if (content[start - 1] !== "{" || content[end] !== "}")
                return [];
            return [{ text: comment.value, start: start - 1, end: end + 1 }];
        });
    }
    catch {
        return null;
    }
}
function getHtmlComments(content) {
    const comments = [];
    const root = (0, simpleHtmlParser_1.parse)(content);
    const visit = (node, excluded) => {
        if (node.type === "comment") {
            if (!excluded) {
                comments.push({
                    text: node.text,
                    start: node.startIndex,
                    end: node.startIndex + 7 + node.text.length,
                });
            }
            return;
        }
        if (node.type !== "element")
            return;
        const childExcluded = excluded || node.tagName === "script" || node.tagName === "style";
        for (const child of node.children)
            visit(child, childExcluded);
    };
    visit(root, false);
    return comments;
}
function getSourceComments(content) {
    var _a;
    return (_a = getJsxComments(content)) !== null && _a !== void 0 ? _a : getHtmlComments(content);
}
function parseInlineDirectives(content, lineIndex) {
    var _a, _b;
    const directives = [];
    const comments = getSourceComments(content);
    const directivePattern = /^\s*zemdomu-(disable-next|disable|enable)\b([\s\S]*?)\s*$/i;
    const masked = content.split("");
    for (const comment of comments) {
        for (let index = comment.start; index < comment.end; index += 1) {
            if (masked[index] !== "\n" && masked[index] !== "\r")
                masked[index] = " ";
        }
    }
    const maskedLines = masked.join("").split(/\r?\n/);
    for (const comment of comments) {
        const match = directivePattern.exec(comment.text);
        if (!match)
            continue;
        const action = match[1].toLowerCase();
        const rawRules = match[2].trim();
        const rules = rawRules
            ? new Set(rawRules.split(/[\s,]+/).filter(Boolean))
            : null;
        const line = locationAt(lineIndex, comment.start).line;
        let targetLine;
        if (action === "disable-next") {
            const endColumn = locationAt(lineIndex, comment.end).column;
            const restOfLine = (_b = (_a = maskedLines[line]) === null || _a === void 0 ? void 0 : _a.slice(endColumn)) !== null && _b !== void 0 ? _b : "";
            if (restOfLine.trim())
                targetLine = line;
            else {
                targetLine = line + 1;
                while (targetLine < maskedLines.length &&
                    !maskedLines[targetLine].trim()) {
                    targetLine += 1;
                }
            }
        }
        directives.push({
            action,
            rules,
            offset: comment.start,
            endOffset: comment.end,
            line,
            targetLine,
        });
    }
    return directives;
}
function ruleMatches(rules, rule) {
    return rules === null || rules.has(rule) || rules.has("*");
}
function applyInlineDisableDirectives(content, results) {
    if (!content.includes("zemdomu-disable") && !content.includes("zemdomu-enable")) {
        return results;
    }
    const lineIndex = buildLineIndex(content);
    const directives = parseInlineDirectives(content, lineIndex);
    if (!directives.length)
        return results;
    return results.filter((result) => {
        var _a, _b;
        const offset = (_a = result.offset) !== null && _a !== void 0 ? _a : ((_b = lineIndex[result.line]) !== null && _b !== void 0 ? _b : 0) + result.column;
        const disabled = new Set();
        const enabledWhileAllDisabled = new Set();
        let disableAll = false;
        for (const directive of directives) {
            if (directive.action === "disable-next") {
                const afterDirective = result.line !== directive.line || offset >= directive.endOffset;
                if (directive.targetLine === result.line &&
                    afterDirective &&
                    ruleMatches(directive.rules, result.rule)) {
                    return false;
                }
                continue;
            }
            if (directive.offset > offset)
                break;
            if (directive.action === "disable") {
                if (directive.rules === null || directive.rules.has("*")) {
                    disableAll = true;
                    enabledWhileAllDisabled.clear();
                }
                else {
                    for (const rule of directive.rules) {
                        disabled.add(rule);
                        enabledWhileAllDisabled.delete(rule);
                    }
                }
            }
            else if (directive.rules === null || directive.rules.has("*")) {
                disableAll = false;
                disabled.clear();
                enabledWhileAllDisabled.clear();
            }
            else {
                for (const rule of directive.rules) {
                    disabled.delete(rule);
                    if (disableAll)
                        enabledWhileAllDisabled.add(rule);
                }
            }
        }
        const isDisabledByAll = disableAll && !enabledWhileAllDisabled.has(result.rule);
        return !(isDisabledByAll || disabled.has(result.rule));
    });
}
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
    const sourceLineIndex = buildLineIndex(content);
    const timings = {};
    const ruleTimes = {};
    const totalStart = Date.now();
    // Pair each rule with its severity
    const activeRules = createActiveRules(opts);
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
                                    .map((r) => (0, rule_codes_1.applyRuleCode)(withJsxOffset({ ...r, severity }, path, sourceLineIndex))));
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
                                    results.push(withJsxOffset({
                                        line: 0,
                                        column: 0,
                                        message: rule.message,
                                        rule: rule.name,
                                        severity,
                                    }, path, sourceLineIndex));
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
                                    .map((r) => (0, rule_codes_1.applyRuleCode)(withJsxOffset({ ...r, severity }, path, sourceLineIndex))));
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
        return applyInlineDisableDirectives(content, results);
    }
    const root = (0, simpleHtmlParser_1.parse)(content);
    // If the source contained only comments or whitespace, ignore parse errors
    const onlyComments = root.children.every((n) => n.type === "comment" || (n.type === "text" && n.text.trim() === ""));
    if (onlyComments) {
        parseErrors = [];
    }
    const lineIndex = sourceLineIndex;
    activeRules.forEach(({ rule }) => {
        var _a;
        if (rule.setHtmlContext) {
            try {
                rule.setHtmlContext({ content, lineIndex });
            }
            catch (e) {
                console.error(`[ZemDomu] Error in rule ${rule.name} (${(_a = opts.filePath) !== null && _a !== void 0 ? _a : "unknown"}):`, e);
            }
        }
    });
    const walk = (node) => {
        var _a, _b, _c;
        for (const { rule, severity } of activeRules) {
            if (rule.enterHtml) {
                try {
                    const s = Date.now();
                    results.push(...rule
                        .enterHtml(node)
                        .map((r) => (0, rule_codes_1.applyRuleCode)(withHtmlLocation({ ...r, severity }, node, content, lineIndex))));
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
                        results.push(withHtmlLocation({
                            line: 0,
                            column: 0,
                            message: rule.message,
                            rule: rule.name,
                            severity,
                        }, node, content, lineIndex));
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
                    results.push(...rule
                        .exitHtml(node)
                        .map((r) => (0, rule_codes_1.applyRuleCode)(withHtmlLocation({ ...r, severity }, node, content, lineIndex))));
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
            results.push(...rule.end().map((r) => {
                const located = r.offset === undefined
                    ? { ...r, severity }
                    : { ...r, ...locationAt(lineIndex, r.offset), severity };
                return (0, rule_codes_1.applyRuleCode)(located);
            }));
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
    return applyInlineDisableDirectives(content, results);
}
