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
exports.ProjectLinter = void 0;
const fs = __importStar(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const ts = __importStar(require("typescript"));
const linter_1 = require("./linter");
const component_analyzer_1 = require("./component-analyzer");
const collectLocalDeps_1 = require("./utils/collectLocalDeps");
const vue_sfc_1 = require("./utils/vue-sfc");
const rule_codes_1 = require("./rule-codes");
const contextual_diagnostics_1 = require("./contextual-diagnostics");
const page_model_1 = require("./page-model");
const FRAMEWORK_HOST_DOCUMENT_RULES = [
    "requireHtmlLang",
    "requireDocumentTitle",
    "requireSingleMain",
];
function isHtmlFile(filePath) {
    return /\.(html|htm)$/i.test(filePath);
}
function buildLineIndex(content) {
    const lines = [0];
    for (let i = 0; i < content.length; i += 1) {
        if (content[i] === "\n")
            lines.push(i + 1);
    }
    return lines;
}
function locationAt(lineIndex, offset) {
    let low = 0;
    let high = lineIndex.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineIndex[mid] <= offset)
            low = mid + 1;
        else
            high = mid - 1;
    }
    const line = Math.max(0, high);
    return { line, column: offset - lineIndex[line] };
}
function rebaseVueResult(result, templateContent, templateStart, documentContent) {
    var _a, _b;
    const templateLines = buildLineIndex(templateContent);
    const relativeOffset = (_a = result.offset) !== null && _a !== void 0 ? _a : ((_b = templateLines[result.line]) !== null && _b !== void 0 ? _b : 0) + result.column;
    const offset = templateStart + relativeOffset;
    return { ...result, ...locationAt(buildLineIndex(documentContent), offset), offset };
}
function getHtmlTagAttribute(tag, name) {
    var _a, _b, _c;
    const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    return match ? (_c = (_b = (_a = match[1]) !== null && _a !== void 0 ? _a : match[2]) !== null && _b !== void 0 ? _b : match[3]) !== null && _c !== void 0 ? _c : "" : null;
}
function hasFrameworkMountPoint(content) {
    return /<[a-z][\w:-]*\b(?=[^>]*\bid\s*=\s*["'](?:app|root|app-root|mount|__nuxt|__next|svelte)["'])[^>]*>/i.test(content);
}
function isFrameworkEntrySrc(src) {
    const normalized = src.replace(/[?#].*$/, "").replace(/\\/g, "/");
    return /(?:^|\/)(?:src\/)?(?:main|index|app)\.(?:[cm]?[jt]sx?|vue)$/i.test(normalized);
}
function hasFrameworkModuleEntry(content) {
    const scriptRe = /<script\b[^>]*>/gi;
    let match;
    while ((match = scriptRe.exec(content))) {
        const tag = match[0];
        const type = getHtmlTagAttribute(tag, "type");
        if (!type || type.toLowerCase() !== "module")
            continue;
        const src = getHtmlTagAttribute(tag, "src");
        if (src && isFrameworkEntrySrc(src))
            return true;
    }
    return /<script\b(?=[^>]*\btype\s*=\s*["']?module["']?)[^>]*>[\s\S]*?\b(?:createApp|createRoot|ReactDOM\.render|new\s+Vue)\s*\(/i.test(content);
}
function isFrameworkHostHtml(filePath, content) {
    if (path_1.default.basename(filePath).toLowerCase() !== "index.html")
        return false;
    if (!hasFrameworkMountPoint(content))
        return false;
    return hasFrameworkModuleEntry(content);
}
function isNextRootLayout(filePath, content) {
    const normalized = filePath.replace(/\\/g, "/");
    return (/(?:^|\/)(?:src\/)?app\/layout\.[cm]?[jt]sx$/i.test(normalized) &&
        /<html\b/i.test(content));
}
function hasNextMetadataExport(content) {
    return /export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b)/.test(content);
}
function suppressRules(options, ruleNames) {
    var _a;
    const rules = { ...((_a = options.rules) !== null && _a !== void 0 ? _a : {}) };
    for (const ruleName of ruleNames) {
        rules[ruleName] = "off";
    }
    return { ...options, rules };
}
class ProjectLinter {
    constructor(options = {}) {
        this.opts = options;
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts, options.perf);
    }
    clear() {
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts, this.opts.perf);
    }
    async lintFile(filePath, content) {
        if (!content) {
            content = await fs.readFile(filePath, "utf8");
        }
        const ext = path_1.default.extname(filePath).toLowerCase();
        const isVue = ext === ".vue";
        const isHtml = isHtmlFile(filePath);
        let lintContent = content;
        let vueTemplateStart;
        if (isVue) {
            const template = (0, vue_sfc_1.extractVueTemplate)(content);
            lintContent = (0, vue_sfc_1.isHtmlVueTemplate)(template) ? template.content : "";
            vueTemplateStart = (0, vue_sfc_1.isHtmlVueTemplate)(template) ? template.start : undefined;
        }
        let lintOptions = isHtml && isFrameworkHostHtml(filePath, content)
            ? suppressRules(this.opts, FRAMEWORK_HOST_DOCUMENT_RULES)
            : this.opts;
        const nextRootLayout = isNextRootLayout(filePath, content);
        if (nextRootLayout) {
            if (hasNextMetadataExport(content)) {
                lintOptions = suppressRules(lintOptions, ["requireDocumentTitle"]);
            }
        }
        const rawResults = (0, linter_1.lint)(lintContent, {
            ...lintOptions,
            filePath,
            forceHtml: isHtml || isVue || this.opts.forceHtml,
        });
        const results = nextRootLayout
            ? rawResults.filter((result) => result.rule !== "requireSingleMain" ||
                !result.message.startsWith("Document missing <main>"))
            : rawResults;
        const resolvedResults = results.map((result) => {
            const rebased = isVue && vueTemplateStart !== undefined
                ? rebaseVueResult(result, lintContent, vueTemplateStart, content)
                : result;
            return rebased.filePath ? rebased : { ...rebased, filePath };
        });
        const byFile = new Map();
        byFile.set(filePath, [...resolvedResults]);
        const xmlMode = /\.(jsx|tsx)$/.test(filePath) || isVue;
        if (xmlMode) {
            const component = await this.analyzer.analyzeFile(filePath);
            if (component)
                this.analyzer.registerComponent(component, resolvedResults);
            if (this.opts.crossComponentAnalysis) {
                const cross = this.analyzer.analyzeComponentTree();
                for (const r of cross) {
                    if (!r.filePath)
                        continue;
                    if (!byFile.has(r.filePath))
                        byFile.set(r.filePath, []);
                    byFile.get(r.filePath).push((0, rule_codes_1.applyRuleCode)(r));
                }
            }
        }
        this.applyListNestingSuppressions(byFile);
        this.applySectionHeadingSuppressions(byFile);
        await this.applyInlineDisableDirectives(byFile, filePath, content);
        return byFile;
    }
    async lintFiles(filePaths) {
        const uniqueTargets = this.resolveTargets(filePaths, Boolean(this.opts.crossComponentAnalysis));
        const aggregated = new Map();
        for (const filePath of uniqueTargets) {
            const fileMap = await this.lintFile(filePath);
            for (const [fp, res] of fileMap.entries()) {
                if (!aggregated.has(fp))
                    aggregated.set(fp, []);
                aggregated.get(fp).push(...res);
            }
        }
        this.applyListNestingSuppressions(aggregated);
        this.applySectionHeadingSuppressions(aggregated);
        return aggregated;
    }
    /**
     * Analyze the supplied entries and their supported local dependencies into
     * the public semantic graph without running or changing lint rules.
     */
    async buildSemanticGraph(filePaths) {
        this.clear();
        const targets = this.resolveTargets(filePaths, true);
        for (const filePath of targets) {
            await this.analyzer.analyzeFile(filePath);
        }
        return this.analyzer.buildSemanticGraph();
    }
    /** Compose configured or adapter-discovered pages from the public graph. */
    async buildPageModel(filePaths) {
        const graph = await this.buildSemanticGraph(filePaths);
        return (0, page_model_1.composeSemanticPageModel)(graph, this.pageModelAdapters());
    }
    /**
     * Lint a composed page and return canonical diagnostics enriched with page,
     * component-path, related-location, and conservative suggestion context.
     * Existing lintFile/lintFiles return values remain unchanged.
     */
    async lintPageDiagnostics(filePaths) {
        var _a, _b;
        const results = await this.lintFiles(filePaths);
        const graph = await this.buildSemanticGraph(filePaths);
        const model = await (0, page_model_1.composeSemanticPageModel)(graph, this.pageModelAdapters());
        const activeRules = (0, linter_1.createActiveRules)(this.opts).filter(({ rule }) => rule.analyzePage);
        activeRules.forEach(({ rule }) => { var _a; return (_a = rule.init) === null || _a === void 0 ? void 0 : _a.call(rule); });
        const combined = new Map();
        for (const [filePath, entries] of results) {
            combined.set(filePath, [...entries]);
        }
        for (const page of model.pages) {
            for (const { rule, severity } of activeRules) {
                const findings = (_b = (_a = rule.analyzePage) === null || _a === void 0 ? void 0 : _a.call(rule, { page, graph, fileResults: results })) !== null && _b !== void 0 ? _b : [];
                for (const finding of findings) {
                    if (!finding.filePath)
                        continue;
                    if (!hasIncompletePageOccurrence(finding, page.id, graph, model)) {
                        removeMatchingFileResult(combined, finding);
                    }
                    if (finding.pageSuppression)
                        continue;
                    const coded = (0, rule_codes_1.applyRuleCode)({ ...finding, pageId: page.id, severity });
                    if (!combined.has(finding.filePath))
                        combined.set(finding.filePath, []);
                    combined.get(finding.filePath).push(coded);
                }
            }
        }
        await this.applyInlineDisableDirectivesForFiles(combined);
        for (const [filePath, entries] of combined) {
            combined.set(filePath, deduplicateResults(entries));
        }
        return (0, contextual_diagnostics_1.createPageAwareDiagnostics)(combined, graph, model);
    }
    pageModelAdapters() {
        var _a, _b;
        const adapters = [
            ...(((_a = this.opts.pages) === null || _a === void 0 ? void 0 : _a.length)
                ? [(0, page_model_1.createConfiguredRouteAdapter)(this.opts.pages)]
                : []),
            ...((_b = this.opts.routeAdapters) !== null && _b !== void 0 ? _b : []),
        ];
        return adapters;
    }
    resolveTargets(filePaths, includeDependencies) {
        var _a, _b, _c;
        const root = (_a = this.opts.rootDir) !== null && _a !== void 0 ? _a : process.cwd();
        const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
        let baseUrl;
        let paths;
        if (configPath) {
            const cfg = ts.readConfigFile(configPath, ts.sys.readFile).config;
            const cfgDir = path_1.default.dirname(configPath);
            baseUrl = ((_b = cfg === null || cfg === void 0 ? void 0 : cfg.compilerOptions) === null || _b === void 0 ? void 0 : _b.baseUrl)
                ? path_1.default.resolve(cfgDir, cfg.compilerOptions.baseUrl)
                : undefined;
            paths = (_c = cfg === null || cfg === void 0 ? void 0 : cfg.compilerOptions) === null || _c === void 0 ? void 0 : _c.paths;
        }
        const targets = includeDependencies
            ? (0, collectLocalDeps_1.collectLocalDeps)(filePaths, {
                rootDir: root,
                baseUrl,
                paths,
                maxDepth: this.opts.crossComponentDepth,
            })
            : filePaths;
        const uniqueTargets = Array.from(new Set(targets.map((p) => path_1.default.resolve(p))));
        return uniqueTargets;
    }
    applyListNestingSuppressions(results) {
        if (!this.opts.crossComponentAnalysis)
            return;
        const rules = this.opts.rules || {};
        if (!rules.enforceListNesting)
            return;
        const suppressions = this.analyzer.getListNestingSuppressions();
        if (!suppressions.size)
            return;
        for (const [filePath, entries] of results.entries()) {
            const suppressSet = suppressions.get(filePath);
            if (!suppressSet || suppressSet.size === 0)
                continue;
            results.set(filePath, entries.filter((r) => r.rule !== "enforceListNesting" ||
                !suppressSet.has(`${r.line}:${r.column}`)));
        }
    }
    applySectionHeadingSuppressions(results) {
        if (!this.opts.crossComponentAnalysis)
            return;
        const rules = this.opts.rules || {};
        if (!rules.requireSectionHeading)
            return;
        const suppressions = this.analyzer.getSectionHeadingSuppressions();
        if (!suppressions.size)
            return;
        for (const [filePath, entries] of results.entries()) {
            const suppressSet = suppressions.get(filePath);
            if (!suppressSet || suppressSet.size === 0)
                continue;
            results.set(filePath, entries.filter((r) => r.rule !== "requireSectionHeading" ||
                !suppressSet.has(`${r.line}:${r.column}`)));
        }
    }
    async applyInlineDisableDirectives(results, currentFilePath, currentContent) {
        const currentResolved = path_1.default.resolve(currentFilePath);
        for (const [resultFilePath, entries] of results.entries()) {
            let source;
            if (path_1.default.resolve(resultFilePath) === currentResolved) {
                source = currentContent;
            }
            else {
                try {
                    source = await fs.readFile(resultFilePath, "utf8");
                }
                catch {
                    continue;
                }
            }
            results.set(resultFilePath, (0, linter_1.applyInlineDisableDirectives)(source, entries));
        }
    }
    async applyInlineDisableDirectivesForFiles(results) {
        for (const [filePath, entries] of results) {
            try {
                const source = await fs.readFile(filePath, "utf8");
                results.set(filePath, (0, linter_1.applyInlineDisableDirectives)(source, entries));
            }
            catch {
                // Preserve diagnostics for virtual/in-memory paths that cannot be read.
            }
        }
    }
}
exports.ProjectLinter = ProjectLinter;
function deduplicateResults(results) {
    var _a, _b, _c, _d;
    const unique = new Map();
    for (const result of results) {
        const key = [
            result.rule,
            (_a = result.filePath) !== null && _a !== void 0 ? _a : "",
            result.line,
            result.column,
            result.message,
            (_b = result.pageId) !== null && _b !== void 0 ? _b : "",
            (_d = (_c = result.pageCompositionPath) === null || _c === void 0 ? void 0 : _c.join("/")) !== null && _d !== void 0 ? _d : "",
        ].join("\u0000");
        if (!unique.has(key))
            unique.set(key, result);
    }
    return [...unique.values()];
}
function removeMatchingFileResult(results, pageResult) {
    if (!pageResult.filePath)
        return;
    const target = path_1.default.resolve(pageResult.filePath);
    for (const [filePath, entries] of results) {
        if (path_1.default.resolve(filePath) !== target)
            continue;
        results.set(filePath, entries.filter((entry) => entry.pageId ||
            entry.rule !== pageResult.rule ||
            entry.line !== pageResult.line ||
            entry.column !== pageResult.column));
    }
}
function hasIncompletePageOccurrence(result, decidedPageId, graph, model) {
    if (!result.filePath)
        return false;
    const target = comparableProjectFile(result.filePath);
    const componentIds = new Set(graph.components
        .filter((component) => {
        const file = graph.files.find((entry) => entry.id === component.fileId);
        return file && comparableProjectFile(file.path) === target;
    })
        .map((component) => component.id));
    if (!componentIds.size)
        return false;
    const containsComponent = (tree) => Boolean(tree &&
        (componentIds.has(tree.componentId) || tree.children.some(containsComponent)));
    return model.pages.some((page) => page.id !== decidedPageId &&
        containsComponent(page.componentTree) &&
        (page.route.state === "unknown" ||
            page.rootComponent.state === "unknown" ||
            page.confidence === "unknown" ||
            page.unknowns.length > 0));
}
function comparableProjectFile(filePath) {
    const resolved = path_1.default.resolve(filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
