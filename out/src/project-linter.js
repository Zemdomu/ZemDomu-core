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
const component_path_resolver_1 = require("./component-path-resolver");
const collectLocalDeps_1 = require("./utils/collectLocalDeps");
const vue_sfc_1 = require("./utils/vue-sfc");
const rule_codes_1 = require("./rule-codes");
class ProjectLinter {
    constructor(options = {}) {
        var _a;
        this.opts = options;
        const rootDir = (_a = this.opts.rootDir) !== null && _a !== void 0 ? _a : process.cwd();
        component_path_resolver_1.ComponentPathResolver.setRootDir(rootDir);
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts, options.perf);
    }
    clear() {
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts, this.opts.perf);
    }
    async lintFile(filePath, content) {
        if (!content) {
            content = await fs.readFile(filePath, "utf8");
        }
        const isVue = path_1.default.extname(filePath).toLowerCase() === ".vue";
        let lintContent = content;
        if (isVue) {
            const template = (0, vue_sfc_1.extractVueTemplate)(content);
            lintContent = (0, vue_sfc_1.isHtmlVueTemplate)(template) ? template.content : "";
        }
        const results = (0, linter_1.lint)(lintContent, {
            ...this.opts,
            filePath,
            forceHtml: isVue || this.opts.forceHtml,
        });
        const byFile = new Map();
        byFile.set(filePath, [...results]);
        const xmlMode = /\.(jsx|tsx)$/.test(filePath) || isVue;
        if (xmlMode) {
            const component = await this.analyzer.analyzeFile(filePath);
            if (component)
                this.analyzer.registerComponent(component, results);
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
        return byFile;
    }
    async lintFiles(filePaths) {
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
        const targets = this.opts.crossComponentAnalysis
            ? (0, collectLocalDeps_1.collectLocalDeps)(filePaths, {
                rootDir: root,
                baseUrl,
                paths,
                maxDepth: this.opts.crossComponentDepth,
            })
            : filePaths;
        const uniqueTargets = Array.from(new Set(targets.map((p) => path_1.default.resolve(p))));
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
}
exports.ProjectLinter = ProjectLinter;
