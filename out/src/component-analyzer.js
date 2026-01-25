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
exports.ComponentAnalyzer = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const component_path_resolver_1 = require("./component-path-resolver");
const utils_1 = require("./rules/utils");
const simpleHtmlParser_1 = require("./simpleHtmlParser");
const vue_sfc_1 = require("./utils/vue-sfc");
class ComponentAnalyzer {
    constructor(options, perf) {
        this.componentRegistry = new Map();
        this.importToComponentMap = new Map();
        this.processingComponentStack = new Set(); // To prevent circular references
        this.resolver = new component_path_resolver_1.ComponentPathResolver();
        this.options = options;
        this.perf = perf;
        this.maxDepth = typeof options.crossComponentDepth === 'number' ? options.crossComponentDepth : undefined;
    }
    async analyzeFile(filePath) {
        var _a, _b;
        const start = Date.now();
        try {
            filePath = path.resolve(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.vue') {
                const vueResult = await this.extractVueComponentInfo(content, filePath);
                if (!vueResult)
                    return null;
                vueResult.timings.total = Date.now() - start;
                (_a = this.perf) === null || _a === void 0 ? void 0 : _a.record(filePath, vueResult.timings);
                return vueResult.component;
            }
            if (!/\.(jsx|tsx)$/.test(filePath))
                return null;
            const { component, timings } = await this.extractComponentInfo(content, filePath);
            timings.total = Date.now() - start;
            (_b = this.perf) === null || _b === void 0 ? void 0 : _b.record(filePath, timings);
            return component;
        }
        catch (e) {
            console.error(`[ZemDomu] Error analyzing file ${filePath}:`, e);
            return null;
        }
    }
    async extractComponentInfo(content, filePath) {
        var _a, _b;
        const timings = {};
        let t0 = Date.now();
        const ast = (0, parser_1.parse)(content, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
        timings.parse = Date.now() - t0;
        const componentName = path.basename(filePath, path.extname(filePath));
        const componentDef = {
            name: componentName,
            filePath,
            issues: new Map(),
            usesComponents: [],
            headings: [],
            ids: [],
            navs: [],
            hasLocalAnchor: false,
            sections: [],
            hasHeadingOutsideSection: false,
            listItems: [],
        };
        // Track imported components
        const importedComponents = new Map();
        // Collect imports
        t0 = Date.now();
        (0, traverse_1.default)(ast, {
            ImportDeclaration(path) {
                const source = path.node.source.value;
                path.node.specifiers.forEach(spec => {
                    if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
                        const name = spec.local.name;
                        if (/^[A-Z]/.test(name)) {
                            importedComponents.set(name, source);
                        }
                    }
                });
            }
        });
        timings.collectImports = Date.now() - t0;
        // Collect JSX usages, headings, ids and nav info
        t0 = Date.now();
        const navStack = [];
        const sectionStack = [];
        (0, traverse_1.default)(ast, {
            JSXElement: {
                enter(path) {
                    var _a, _b, _c, _d, _e, _f;
                    const elt = path.node.openingElement.name;
                    if (!t.isJSXIdentifier(elt))
                        return;
                    const name = elt.name;
                    const tag = name.toLowerCase();
                    // Track <section> elements
                    if (tag === 'section') {
                        const loc = (_a = path.node.openingElement.loc) === null || _a === void 0 ? void 0 : _a.start;
                        const sectionInfo = {
                            filePath,
                            line: loc ? loc.line - 1 : 0,
                            column: loc ? loc.column : 0,
                            hasLocalHeading: false,
                            childComponents: [],
                        };
                        sectionStack.push(sectionInfo);
                        componentDef.sections.push(sectionInfo);
                    }
                    // Track list items for cross-component nesting
                    if (tag === 'li') {
                        const parentElement = path.findParent((p) => p.isJSXElement());
                        const parentTag = parentElement
                            ? (t.isJSXIdentifier(parentElement.node.openingElement.name)
                                ? parentElement.node.openingElement.name.name.toLowerCase()
                                : '')
                            : '';
                        const nesting = !parentElement
                            ? 'root'
                            : parentTag === 'ul' || parentTag === 'ol'
                                ? 'inList'
                                : 'inOther';
                        const loc = (_b = path.node.openingElement.loc) === null || _b === void 0 ? void 0 : _b.start;
                        componentDef.listItems.push({
                            filePath,
                            line: loc ? loc.line - 1 : 0,
                            column: loc ? loc.column : 0,
                            nesting,
                        });
                    }
                    // Record headings
                    if (/^h[1-6]$/.test(tag)) {
                        const level = parseInt(tag.charAt(1), 10);
                        const loc = (_c = path.node.openingElement.loc) === null || _c === void 0 ? void 0 : _c.start;
                        if (loc) {
                            componentDef.headings.push({
                                level,
                                line: loc.line - 1,
                                column: loc.column,
                                filePath,
                            });
                        }
                        if (sectionStack.length) {
                            sectionStack[sectionStack.length - 1].hasLocalHeading = true;
                        }
                        else {
                            componentDef.hasHeadingOutsideSection = true;
                        }
                    }
                    // Track <nav> elements
                    if (tag === 'nav') {
                        const loc = (_d = path.node.openingElement.loc) === null || _d === void 0 ? void 0 : _d.start;
                        const navInfo = {
                            filePath,
                            line: loc ? loc.line - 1 : 0,
                            column: loc ? loc.column : 0,
                            hasLocalLink: false,
                            childComponents: [],
                        };
                        navStack.push(navInfo);
                        componentDef.navs.push(navInfo);
                    }
                    // Track link-like elements
                    const isComponentTag = t.isJSXIdentifier(path.node.openingElement.name) &&
                        /^[A-Z]/.test(path.node.openingElement.name.name);
                    if (tag === 'a' || (isComponentTag && (0, utils_1.hasJsxLinkAttribute)(path.node.openingElement))) {
                        componentDef.hasLocalAnchor = true;
                        navStack.forEach(n => (n.hasLocalLink = true));
                    }
                    // Track id attributes
                    const idAttr = (0, utils_1.getJsxAttr)(path.node.openingElement, 'id');
                    if (idAttr) {
                        const loc = (_e = path.node.openingElement.loc) === null || _e === void 0 ? void 0 : _e.start;
                        componentDef.ids.push({
                            id: idAttr,
                            line: loc ? loc.line - 1 : 0,
                            column: loc ? loc.column : 0,
                            filePath,
                        });
                    }
                    // Record component usage (only for capitalized components)
                    if (/^[A-Z]/.test(name)) {
                        const existingRef = componentDef.usesComponents.find(c => c.name === name);
                        const loc = (_f = elt.loc) === null || _f === void 0 ? void 0 : _f.start;
                        const parentElement = path.findParent((p) => p.isJSXElement());
                        const parentTag = parentElement
                            ? (t.isJSXIdentifier(parentElement.node.openingElement.name)
                                ? parentElement.node.openingElement.name.name.toLowerCase()
                                : '')
                            : '';
                        const inListDirect = parentTag === 'ul' || parentTag === 'ol';
                        const inSection = sectionStack.length > 0;
                        const renderGroup = (0, utils_1.getJsxRenderGroup)(path);
                        const location = loc
                            ? {
                                line: loc.line - 1,
                                column: loc.column,
                                inListDirect,
                                inSection,
                                renderGroup,
                            }
                            : { line: 0, column: 0, inListDirect, inSection, renderGroup };
                        let ref;
                        if (existingRef) {
                            existingRef.usageLocations.push(location);
                            ref = existingRef;
                        }
                        else {
                            const rawImportPath = importedComponents.get(name) || null;
                            ref = {
                                name,
                                path: null,
                                rawImportPath,
                                sourceLocation: location,
                                usageLocations: [location],
                            };
                            componentDef.usesComponents.push(ref);
                        }
                        if (navStack.length) {
                            navStack[navStack.length - 1].childComponents.push(ref);
                        }
                        if (sectionStack.length) {
                            sectionStack[sectionStack.length - 1].childComponents.push(ref);
                        }
                    }
                },
                exit(path) {
                    const elt = path.node.openingElement.name;
                    if (t.isJSXIdentifier(elt)) {
                        const tag = elt.name.toLowerCase();
                        if (tag === 'nav') {
                            navStack.pop();
                        }
                        if (tag === 'section') {
                            sectionStack.pop();
                        }
                    }
                },
            },
        });
        timings.jsxCollect = Date.now() - t0;
        // Store import mappings for this file
        this.importToComponentMap.set(filePath, importedComponents);
        // Resolve import paths
        t0 = Date.now();
        for (const ref of componentDef.usesComponents) {
            if (ref.rawImportPath) {
                const t1 = Date.now();
                ref.path = await this.resolveComponentPath(ref.rawImportPath, filePath);
                timings[`resolve:${ref.rawImportPath}`] = Date.now() - t1;
            }
        }
        timings.resolvePaths = Date.now() - t0;
        // Check for heading order issues within this component
        t0 = Date.now();
        if ((_a = this.options.rules) === null || _a === void 0 ? void 0 : _a.enforceHeadingOrder) {
            let lastHeadingLevel = 0;
            const sortedHeadings = [...componentDef.headings].sort((a, b) => {
                if (a.line !== b.line)
                    return a.line - b.line;
                return a.column - b.column;
            });
            for (const heading of sortedHeadings) {
                if (lastHeadingLevel &&
                    shouldWarnForHeadingOrder(heading.level, lastHeadingLevel)) {
                    componentDef.issues.set('enforceHeadingOrder', [
                        ...(componentDef.issues.get('enforceHeadingOrder') || []),
                        {
                            line: heading.line,
                            column: heading.column,
                            message: `Heading level skipped: <h${heading.level}> after <h${lastHeadingLevel}>`,
                            rule: 'enforceHeadingOrder'
                        }
                    ]);
                }
                lastHeadingLevel = heading.level;
            }
        }
        // Synthetic single-H1 issues
        if ((_b = this.options.rules) === null || _b === void 0 ? void 0 : _b.singleH1) {
            const h1Results = componentDef.headings
                .filter(h => h.level === 1)
                .map(h => ({ line: h.line, column: h.column, message: '<h1>', rule: 'singleH1' }));
            if (h1Results.length > 0) {
                componentDef.issues.set('singleH1', h1Results);
            }
        }
        timings.headingAnalysis = Date.now() - t0;
        // Register component
        this.componentRegistry.set(filePath, componentDef);
        return { component: componentDef, timings };
    }
    async extractVueComponentInfo(content, filePath) {
        var _a, _b;
        const templateBlock = (0, vue_sfc_1.extractVueTemplate)(content);
        if (!(0, vue_sfc_1.isHtmlVueTemplate)(templateBlock))
            return null;
        const timings = {};
        const componentName = path.basename(filePath, path.extname(filePath));
        const componentDef = {
            name: componentName,
            filePath,
            issues: new Map(),
            usesComponents: [],
            headings: [],
            ids: [],
            navs: [],
            hasLocalAnchor: false,
            sections: [],
            hasHeadingOutsideSection: false,
            listItems: [],
        };
        const importedComponents = new Map();
        const normalizedImports = new Map();
        let t0 = Date.now();
        const scripts = (0, vue_sfc_1.extractVueScripts)(content);
        for (const script of scripts) {
            if (!script.content.trim())
                continue;
            const lang = typeof script.attrs.lang === "string" ? script.attrs.lang.toLowerCase() : "";
            const plugins = ["typescript"];
            if (lang.includes("jsx") || lang.includes("tsx")) {
                plugins.push("jsx");
            }
            try {
                const ast = (0, parser_1.parse)(script.content, {
                    sourceType: "module",
                    plugins,
                    errorRecovery: true,
                });
                (0, traverse_1.default)(ast, {
                    ImportDeclaration(path) {
                        const source = path.node.source.value;
                        path.node.specifiers.forEach((spec) => {
                            if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
                                const name = spec.local.name;
                                if (/^[A-Z]/.test(name)) {
                                    importedComponents.set(name, source);
                                }
                            }
                        });
                    },
                });
            }
            catch {
                // Ignore malformed script blocks
            }
        }
        for (const name of importedComponents.keys()) {
            const key = normalizeComponentKey(name);
            if (!normalizedImports.has(key))
                normalizedImports.set(key, name);
        }
        timings.collectImports = Date.now() - t0;
        const tParse = Date.now();
        const root = (0, simpleHtmlParser_1.parse)(templateBlock.content);
        timings.parseTemplate = Date.now() - tParse;
        t0 = Date.now();
        const lineIndex = buildLineIndex(content);
        const templateStart = templateBlock.start;
        const navStack = [];
        const sectionStack = [];
        const groupStack = [];
        let groupId = 0;
        const mergePendingUsageGroup = (pendingId, baseGroup) => {
            for (const ref of componentDef.usesComponents) {
                for (const loc of ref.usageLocations) {
                    if (!loc.renderGroup)
                        continue;
                    if (loc.renderGroup.startsWith(`${pendingId}:`)) {
                        loc.renderGroup = baseGroup;
                    }
                }
            }
        };
        const finalizePending = (ctx) => {
            if (!ctx.pendingIfGroup)
                return;
            if (ctx.pendingIfExclusive) {
                ctx.pendingIfGroup = undefined;
                ctx.pendingIfExclusive = undefined;
                return;
            }
            mergePendingUsageGroup(ctx.pendingIfGroup, ctx.groupKey);
            ctx.pendingIfGroup = undefined;
            ctx.pendingIfExclusive = undefined;
        };
        const visit = (node, parentTag) => {
            var _a, _b, _c, _d;
            if (node.type === "element") {
                const parentCtx = (_a = groupStack[groupStack.length - 1]) !== null && _a !== void 0 ? _a : { groupKey: "root" };
                const hasIf = node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, "v-if");
                const hasElseIf = node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, "v-else-if");
                const hasElse = node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, "v-else");
                if (!hasElseIf && !hasElse) {
                    finalizePending(parentCtx);
                }
                let groupKey = parentCtx.groupKey;
                if (hasElseIf || hasElse) {
                    const chainId = (_b = parentCtx.pendingIfGroup) !== null && _b !== void 0 ? _b : `${parentCtx.groupKey}|cond:${++groupId}`;
                    parentCtx.pendingIfGroup = chainId;
                    parentCtx.pendingIfExclusive = true;
                    groupKey = `${chainId}:${hasElse ? "else" : "else-if"}`;
                }
                else if (hasIf) {
                    const chainId = `${parentCtx.groupKey}|cond:${++groupId}`;
                    parentCtx.pendingIfGroup = chainId;
                    parentCtx.pendingIfExclusive = false;
                    groupKey = `${chainId}:if`;
                }
                groupStack.push({ groupKey });
                const tag = node.tagName;
                const loc = indexToLoc(lineIndex, templateStart + node.startIndex);
                if (tag === "section") {
                    const sectionInfo = {
                        filePath,
                        line: loc.line,
                        column: loc.column,
                        hasLocalHeading: false,
                        childComponents: [],
                    };
                    sectionStack.push(sectionInfo);
                    componentDef.sections.push(sectionInfo);
                }
                if (/^h[1-6]$/.test(tag)) {
                    const level = parseInt(tag.charAt(1), 10);
                    componentDef.headings.push({
                        level,
                        line: loc.line,
                        column: loc.column,
                        filePath,
                    });
                    if (sectionStack.length) {
                        sectionStack[sectionStack.length - 1].hasLocalHeading = true;
                    }
                    else {
                        componentDef.hasHeadingOutsideSection = true;
                    }
                }
                if (tag === "nav") {
                    const navInfo = {
                        filePath,
                        line: loc.line,
                        column: loc.column,
                        hasLocalLink: false,
                        childComponents: [],
                    };
                    navStack.push(navInfo);
                    componentDef.navs.push(navInfo);
                }
                if (tag === "a" || (0, utils_1.hasHtmlLinkAttribute)((_c = node.attrs) !== null && _c !== void 0 ? _c : {})) {
                    componentDef.hasLocalAnchor = true;
                    navStack.forEach((n) => (n.hasLocalLink = true));
                }
                if (tag === "li") {
                    const nesting = parentTag === "ul" || parentTag === "ol"
                        ? "inList"
                        : parentTag === "root"
                            ? "root"
                            : "inOther";
                    componentDef.listItems.push({
                        filePath,
                        line: loc.line,
                        column: loc.column,
                        nesting,
                    });
                }
                if (node.attrs && node.attrs.id !== undefined) {
                    componentDef.ids.push({
                        id: String(node.attrs.id),
                        line: loc.line,
                        column: loc.column,
                        filePath,
                    });
                }
                if (isVueComponentTag(tag)) {
                    const lookupKey = normalizeComponentKey(tag);
                    const importName = normalizedImports.get(lookupKey);
                    const componentName = importName !== null && importName !== void 0 ? importName : tag;
                    const rawImportPath = importName ? (_d = importedComponents.get(importName)) !== null && _d !== void 0 ? _d : null : null;
                    const existingRef = componentDef.usesComponents.find((c) => c.name === componentName);
                    const location = { line: loc.line, column: loc.column };
                    let ref;
                    if (existingRef) {
                        existingRef.usageLocations.push({
                            ...location,
                            inListDirect: parentTag === "ul" || parentTag === "ol",
                            inSection: sectionStack.length > 0,
                            renderGroup: groupKey,
                        });
                        ref = existingRef;
                    }
                    else {
                        ref = {
                            name: componentName,
                            path: null,
                            rawImportPath,
                            sourceLocation: location,
                            usageLocations: [
                                {
                                    ...location,
                                    inListDirect: parentTag === "ul" || parentTag === "ol",
                                    inSection: sectionStack.length > 0,
                                    renderGroup: groupKey,
                                },
                            ],
                        };
                        componentDef.usesComponents.push(ref);
                    }
                    if (navStack.length) {
                        navStack[navStack.length - 1].childComponents.push(ref);
                    }
                    if (sectionStack.length) {
                        sectionStack[sectionStack.length - 1].childComponents.push(ref);
                    }
                }
                for (const child of node.children) {
                    visit(child, tag);
                }
                if (tag === "nav") {
                    navStack.pop();
                }
                if (tag === "section") {
                    sectionStack.pop();
                }
                const ctx = groupStack.pop();
                if (ctx)
                    finalizePending(ctx);
            }
        };
        visit(root, "root");
        timings.templateCollect = Date.now() - t0;
        this.importToComponentMap.set(filePath, importedComponents);
        t0 = Date.now();
        for (const ref of componentDef.usesComponents) {
            if (ref.rawImportPath) {
                const t1 = Date.now();
                ref.path = await this.resolveComponentPath(ref.rawImportPath, filePath);
                timings[`resolve:${ref.rawImportPath}`] = Date.now() - t1;
            }
        }
        timings.resolvePaths = Date.now() - t0;
        t0 = Date.now();
        if ((_a = this.options.rules) === null || _a === void 0 ? void 0 : _a.enforceHeadingOrder) {
            let lastHeadingLevel = 0;
            const sortedHeadings = [...componentDef.headings].sort((a, b) => {
                if (a.line !== b.line)
                    return a.line - b.line;
                return a.column - b.column;
            });
            for (const heading of sortedHeadings) {
                if (lastHeadingLevel &&
                    shouldWarnForHeadingOrder(heading.level, lastHeadingLevel)) {
                    componentDef.issues.set("enforceHeadingOrder", [
                        ...(componentDef.issues.get("enforceHeadingOrder") || []),
                        {
                            line: heading.line,
                            column: heading.column,
                            message: `Heading level skipped: <h${heading.level}> after <h${lastHeadingLevel}>`,
                            rule: "enforceHeadingOrder",
                        },
                    ]);
                }
                lastHeadingLevel = heading.level;
            }
        }
        if ((_b = this.options.rules) === null || _b === void 0 ? void 0 : _b.singleH1) {
            const h1Results = componentDef.headings
                .filter((h) => h.level === 1)
                .map((h) => ({
                line: h.line,
                column: h.column,
                message: "<h1>",
                rule: "singleH1",
            }));
            if (h1Results.length > 0) {
                componentDef.issues.set("singleH1", h1Results);
            }
        }
        timings.headingAnalysis = Date.now() - t0;
        this.componentRegistry.set(filePath, componentDef);
        return { component: componentDef, timings };
    }
    async resolveComponentPath(importPath, currentPath) {
        return this.resolver.resolve(importPath, currentPath);
    }
    registerComponent(component, issues) {
        for (const issue of issues) {
            const rule = issue.rule || this.getRuleType(issue.message);
            if (!component.issues.has(rule))
                component.issues.set(rule, []);
            component.issues.get(rule).push(issue);
        }
        this.componentRegistry.set(component.filePath, component);
    }
    getRuleType(msg) {
        if (msg.includes('<h1>'))
            return 'singleH1';
        if (msg.includes('Heading level'))
            return 'enforceHeadingOrder';
        if (msg.includes('<section>'))
            return 'requireSectionHeading';
        if (msg.includes('<img>'))
            return 'requireAltText';
        if (msg.includes('missing title attribute'))
            return 'requireIframeTitle';
        if (msg.includes('missing alt attribute') && msg.includes('input type="image"'))
            return 'requireImageInputAlt';
        if (msg.includes('<html>'))
            return 'requireHtmlLang';
        if (msg.includes('<button>'))
            return 'requireButtonText';
        if (msg.includes('Form control'))
            return 'requireLabelForFormControls';
        if (msg.includes('<li>'))
            return 'enforceListNesting';
        if (msg.includes('<a>'))
            return msg.includes('href') ? 'requireHrefOnAnchors' : 'requireLinkText';
        if (msg.includes('<table>'))
            return 'requireTableCaption';
        if (msg.includes('should not be empty'))
            return 'preventEmptyInlineTags';
        return 'other';
    }
    analyzeComponentTree() {
        var _a;
        const results = [];
        const cross = (_a = this.options.crossComponentAnalysis) !== null && _a !== void 0 ? _a : true;
        const rules = this.options.rules || {};
        if (!cross)
            return results;
        if (rules.singleH1)
            this.findCrossComponentH1Issues(results);
        if (rules.enforceHeadingOrder)
            this.findCrossComponentHeadingOrderIssues(results);
        if (rules.uniqueIds)
            this.findCrossComponentDuplicateIds(results);
        if (rules.requireNavLinks)
            this.findCrossComponentNavLinks(results);
        if (rules.enforceListNesting)
            this.findCrossComponentListNestingIssues(results);
        return results;
    }
    findCrossComponentH1Issues(results) {
        var _a, _b, _c;
        const entryPoints = this.findEntryPoints();
        const emitted = new Set();
        const getDisplayName = (component) => {
            if (component.name)
                return component.name;
            return path.basename(component.filePath, path.extname(component.filePath));
        };
        const addResult = (result) => {
            const key = `${result.rule}|${result.filePath}|${result.line}|${result.column}|${result.message}`;
            if (emitted.has(key))
                return;
            emitted.add(key);
            results.push(result);
        };
        for (const entry of entryPoints) {
            const usageGroups = new Map();
            const usageEntries = new Map();
            const usageStack = new Set();
            const collectUsage = (component, groupKey, depth = 0) => {
                if (this.maxDepth !== undefined && depth > this.maxDepth)
                    return;
                if (usageStack.has(component.filePath))
                    return;
                usageStack.add(component.filePath);
                if (!usageGroups.has(component.filePath)) {
                    usageGroups.set(component.filePath, new Set());
                }
                usageGroups.get(component.filePath).add(groupKey);
                for (const ref of component.usesComponents) {
                    if (!ref.path || !this.componentRegistry.has(ref.path))
                        continue;
                    const child = this.componentRegistry.get(ref.path);
                    if (!usageEntries.has(child.filePath))
                        usageEntries.set(child.filePath, []);
                    const locations = ref.usageLocations.length > 0 ? ref.usageLocations : [ref.sourceLocation];
                    for (const loc of locations) {
                        const locGroup = typeof loc.renderGroup === 'string'
                            ? loc.renderGroup
                            : 'root';
                        const childGroup = `${groupKey}|${locGroup}`;
                        usageEntries.get(child.filePath).push({
                            parent: component,
                            location: { filePath: component.filePath, line: loc.line, column: loc.column },
                            groupKey: childGroup,
                        });
                        collectUsage(child, childGroup, depth + 1);
                    }
                }
                usageStack.delete(component.filePath);
            };
            collectUsage(entry, 'root', 0);
            const allGroups = new Set();
            for (const groups of usageGroups.values()) {
                for (const group of groups)
                    allGroups.add(group);
            }
            const groupComponents = new Map();
            for (const [filePath, groups] of usageGroups) {
                const comp = this.componentRegistry.get(filePath);
                if (!comp)
                    continue;
                if (!comp.headings.some((h) => h.level === 1))
                    continue;
                for (const group of groups) {
                    for (const candidate of allGroups) {
                        if (candidate === group || candidate.startsWith(`${group}|`)) {
                            if (!groupComponents.has(candidate)) {
                                groupComponents.set(candidate, new Set());
                            }
                            groupComponents.get(candidate).add(filePath);
                        }
                    }
                }
            }
            for (const [groupKey, componentSet] of groupComponents) {
                if (componentSet.size <= 1)
                    continue;
                const componentNames = new Map();
                for (const filePath of componentSet) {
                    const comp = this.componentRegistry.get(filePath);
                    if (comp)
                        componentNames.set(filePath, getDisplayName(comp));
                }
                for (const filePath of componentSet) {
                    const comp = this.componentRegistry.get(filePath);
                    if (!comp)
                        continue;
                    const compName = (_a = componentNames.get(filePath)) !== null && _a !== void 0 ? _a : getDisplayName(comp);
                    const conflicts = Array.from(componentNames.entries())
                        .filter(([otherPath]) => otherPath !== filePath)
                        .map(([, name]) => `'${name}'`);
                    if (!conflicts.length)
                        continue;
                    const conflictText = conflicts.join(', ');
                    const issues = (_b = comp.issues.get('singleH1')) !== null && _b !== void 0 ? _b : [];
                    if (!issues.length)
                        continue;
                    const usageEntriesForGroup = ((_c = usageEntries.get(filePath)) !== null && _c !== void 0 ? _c : []).filter((u) => u.groupKey === groupKey);
                    const usageRelated = usageEntriesForGroup.map((u) => ({
                        filePath: u.location.filePath,
                        line: u.location.line,
                        column: u.location.column,
                        message: `Rendered via '${getDisplayName(u.parent)}'`,
                    }));
                    for (const issue of issues) {
                        addResult({
                            filePath: comp.filePath,
                            line: issue.line,
                            column: issue.column,
                            message: `Multiple <h1> tags across components. This <h1> in '${compName}' conflicts with ${conflictText}.`,
                            rule: 'singleH1',
                            related: usageRelated.length ? usageRelated : undefined,
                        });
                    }
                    if (!usageEntriesForGroup.length)
                        continue;
                    const childIssueLocations = issues.map((issue) => ({
                        filePath: comp.filePath,
                        line: issue.line,
                        column: issue.column,
                        message: `Defined in '${compName}'`,
                    }));
                    for (const usage of usageEntriesForGroup) {
                        addResult({
                            filePath: usage.location.filePath,
                            line: usage.location.line,
                            column: usage.location.column,
                            message: `Component '${compName}' renders an extra <h1> that conflicts with ${conflictText}.`,
                            rule: 'singleH1',
                            related: childIssueLocations.length ? childIssueLocations : undefined,
                        });
                    }
                }
            }
        }
    }
    /**
     * Improved implementation to find heading order issues across components
     */
    findCrossComponentHeadingOrderIssues(results) {
        const entryPoints = this.findEntryPoints();
        for (const entry of entryPoints) {
            // Process each entry point as a document root
            this.processingComponentStack.clear();
            this.analyzeHeadingHierarchy(entry, results, 0);
        }
    }
    /**
     * Collects all headings from a component and its children in document order
     * and checks for heading level issues
     */
    analyzeHeadingHierarchy(component, results, depth = 0) {
        var _a, _b;
        if (this.maxDepth !== undefined && depth > this.maxDepth)
            return;
        if (this.processingComponentStack.has(component.filePath)) {
            // Avoid circular references
            return;
        }
        this.processingComponentStack.add(component.filePath);
        // Build a flattened view of all headings in document order
        const allHeadings = this.collectHeadingsInDocumentOrder(component, depth);
        // Check for heading level issues
        let lastLevel = 0;
        for (const heading of allHeadings) {
            if (lastLevel > 0 &&
                shouldWarnForHeadingOrder(heading.heading.level, lastLevel)) {
                const locationFile = heading.heading.filePath;
                const locationLine = heading.heading.line;
                const locationColumn = heading.heading.column;
                const usageComponent = ((_a = heading.usageLocation) === null || _a === void 0 ? void 0 : _a.filePath)
                    ? this.componentRegistry.get(heading.usageLocation.filePath)
                    : null;
                const usageName = usageComponent
                    ? path.basename(usageComponent.filePath, path.extname(usageComponent.filePath))
                    : ((_b = heading.usageLocation) === null || _b === void 0 ? void 0 : _b.filePath)
                        ? path.basename(heading.usageLocation.filePath, path.extname(heading.usageLocation.filePath))
                        : null;
                const messageSuffix = usageName ? ` (rendered via '${usageName}')` : '';
                results.push({
                    filePath: locationFile,
                    line: locationLine,
                    column: locationColumn,
                    message: `Cross-component heading level skipped: <h${heading.heading.level}> after <h${lastLevel}>${messageSuffix}`,
                    rule: 'enforceHeadingOrder'
                });
            }
            lastLevel = heading.heading.level;
        }
        this.processingComponentStack.delete(component.filePath);
    }
    /**
     * Collects all headings from a component and its children in document order
     */
    collectHeadingsInDocumentOrder(component, depth = 0) {
        if (this.maxDepth !== undefined && depth > this.maxDepth) {
            return [];
        }
        // Sort headings within this component by line/column
        const localHeadings = [...component.headings].sort((a, b) => {
            if (a.line !== b.line)
                return a.line - b.line;
            return a.column - b.column;
        }).map(h => ({
            heading: h,
            usageLocation: null
        }));
        // Sort child components by their usage location
        const childComponents = component.usesComponents
            .filter(ref => ref.path && this.componentRegistry.has(ref.path))
            .sort((a, b) => {
            const aLoc = a.usageLocations[0] || a.sourceLocation;
            const bLoc = b.usageLocations[0] || b.sourceLocation;
            if (aLoc.line !== bLoc.line)
                return aLoc.line - bLoc.line;
            return aLoc.column - bLoc.column;
        });
        // Merge headings and child component headings in document order
        const allHeadings = [];
        let headingIndex = 0;
        let childIndex = 0;
        // This merges the local headings with child component headings
        // based on their position in the document
        while (headingIndex < localHeadings.length || childIndex < childComponents.length) {
            if (headingIndex >= localHeadings.length) {
                // No more local headings, process remaining children
                const childRef = childComponents[childIndex++];
                if (childRef.path && this.componentRegistry.has(childRef.path) && !this.processingComponentStack.has(childRef.path) && (this.maxDepth === undefined || depth < this.maxDepth)) {
                    const childComponent = this.componentRegistry.get(childRef.path);
                    const usageLoc = childRef.usageLocations[0] || childRef.sourceLocation;
                    const usageLocation = {
                        filePath: component.filePath,
                        line: usageLoc.line,
                        column: usageLoc.column
                    };
                    this.processingComponentStack.add(childRef.path);
                    const childHeadings = this.collectHeadingsInDocumentOrder(childComponent, depth + 1)
                        .map(h => ({
                        heading: h.heading,
                        usageLocation: h.usageLocation || usageLocation
                    }));
                    this.processingComponentStack.delete(childRef.path);
                    allHeadings.push(...childHeadings);
                }
            }
            else if (childIndex >= childComponents.length) {
                // No more children, add remaining local headings
                allHeadings.push(localHeadings[headingIndex++]);
            }
            else {
                // Compare positions to decide whether to add a local heading or process a child
                const nextHeading = localHeadings[headingIndex];
                const nextChild = childComponents[childIndex];
                const childLoc = nextChild.usageLocations[0] || nextChild.sourceLocation;
                if (nextHeading.heading.line < childLoc.line ||
                    (nextHeading.heading.line === childLoc.line && nextHeading.heading.column < childLoc.column)) {
                    // Local heading comes first
                    allHeadings.push(nextHeading);
                    headingIndex++;
                }
                else {
                    // Child component comes first
                    childIndex++;
                    if (nextChild.path && this.componentRegistry.has(nextChild.path) && !this.processingComponentStack.has(nextChild.path) && (this.maxDepth === undefined || depth < this.maxDepth)) {
                        const childComponent = this.componentRegistry.get(nextChild.path);
                        const usageLocation = {
                            filePath: component.filePath,
                            line: childLoc.line,
                            column: childLoc.column
                        };
                        this.processingComponentStack.add(nextChild.path);
                        const childHeadings = this.collectHeadingsInDocumentOrder(childComponent, depth + 1)
                            .map(h => ({
                            heading: h.heading,
                            usageLocation: h.usageLocation || usageLocation
                        }));
                        this.processingComponentStack.delete(nextChild.path);
                        allHeadings.push(...childHeadings);
                    }
                }
            }
        }
        return allHeadings;
    }
    findCrossComponentDuplicateIds(results) {
        const entryPoints = this.findEntryPoints();
        for (const entry of entryPoints) {
            this.collectIds(entry, new Map(), results, new Set(), 0);
        }
    }
    collectIds(component, seen, results, stack, depth = 0) {
        if (this.maxDepth !== undefined && depth > this.maxDepth)
            return;
        if (stack.has(component.filePath))
            return;
        stack.add(component.filePath);
        for (const id of component.ids) {
            if (seen.has(id.id)) {
                results.push({
                    filePath: id.filePath,
                    line: id.line,
                    column: id.column,
                    message: `Duplicate id "${id.id}"`,
                    rule: 'uniqueIds',
                });
            }
            else {
                seen.set(id.id, id);
            }
        }
        for (const ref of component.usesComponents) {
            if (ref.path && this.componentRegistry.has(ref.path)) {
                const target = this.componentRegistry.get(ref.path);
                const count = ref.usageLocations.length || 1;
                for (let i = 0; i < count; i++) {
                    this.collectIds(target, seen, results, stack, depth + 1);
                }
            }
        }
        stack.delete(component.filePath);
    }
    findCrossComponentNavLinks(results) {
        const entryPoints = this.findEntryPoints();
        for (const entry of entryPoints) {
            this.checkNavs(entry, results, new Set(), 0);
        }
    }
    findCrossComponentListNestingIssues(results) {
        const entryPoints = this.findEntryPoints();
        const emitted = new Set();
        const addResult = (result) => {
            const key = `${result.rule}|${result.filePath}|${result.line}|${result.column}|${result.message}`;
            if (emitted.has(key))
                return;
            emitted.add(key);
            results.push(result);
        };
        const getDisplayName = (component) => component.name || path.basename(component.filePath, path.extname(component.filePath));
        const visit = (component, stack, depth = 0) => {
            if (this.maxDepth !== undefined && depth > this.maxDepth)
                return;
            if (stack.has(component.filePath))
                return;
            stack.add(component.filePath);
            for (const ref of component.usesComponents) {
                if (!ref.path || !this.componentRegistry.has(ref.path))
                    continue;
                const child = this.componentRegistry.get(ref.path);
                const rootItems = child.listItems.filter((item) => item.nesting === "root");
                if (rootItems.length) {
                    const locations = ref.usageLocations.length > 0 ? ref.usageLocations : [ref.sourceLocation];
                    for (const loc of locations) {
                        const inListDirect = typeof loc.inListDirect === "boolean"
                            ? loc.inListDirect
                            : false;
                        if (inListDirect)
                            continue;
                        const childName = getDisplayName(child);
                        addResult({
                            filePath: component.filePath,
                            line: loc.line,
                            column: loc.column,
                            message: `Component '${childName}' renders <li> elements that must be inside <ul> or <ol>.`,
                            rule: "enforceListNesting",
                            related: rootItems.map((item) => ({
                                filePath: child.filePath,
                                line: item.line,
                                column: item.column,
                                message: `Rendered <li> in '${childName}'`,
                            })),
                        });
                    }
                }
                visit(child, stack, depth + 1);
            }
            stack.delete(component.filePath);
        };
        for (const entry of entryPoints) {
            visit(entry, new Set(), 0);
        }
    }
    checkNavs(component, results, stack, depth = 0) {
        if (this.maxDepth !== undefined && depth > this.maxDepth)
            return;
        if (stack.has(component.filePath))
            return;
        stack.add(component.filePath);
        for (const nav of component.navs) {
            if (!this.navHasLink(nav, new Set(), depth)) {
                results.push({
                    filePath: nav.filePath,
                    line: nav.line,
                    column: nav.column,
                    message: '<nav> contains no links',
                    rule: 'requireNavLinks',
                });
            }
        }
        for (const ref of component.usesComponents) {
            if (ref.path && this.componentRegistry.has(ref.path)) {
                this.checkNavs(this.componentRegistry.get(ref.path), results, stack, depth + 1);
            }
        }
        stack.delete(component.filePath);
    }
    navHasLink(nav, visited, depth = 0) {
        if (this.maxDepth !== undefined && depth > this.maxDepth)
            return false;
        if (nav.hasLocalLink)
            return true;
        for (const ref of nav.childComponents) {
            if (ref.path && this.componentRegistry.has(ref.path)) {
                if (this.componentHasAnchor(this.componentRegistry.get(ref.path), visited, depth + 1)) {
                    return true;
                }
            }
        }
        return false;
    }
    componentHasAnchor(component, visited, depth = 0) {
        if (this.maxDepth !== undefined && depth > this.maxDepth)
            return false;
        if (visited.has(component.filePath))
            return false;
        if (component.hasLocalAnchor)
            return true;
        visited.add(component.filePath);
        for (const ref of component.usesComponents) {
            if (ref.path && this.componentRegistry.has(ref.path)) {
                if (this.componentHasAnchor(this.componentRegistry.get(ref.path), visited, depth + 1)) {
                    return true;
                }
            }
        }
        return false;
    }
    getListNestingSuppressions() {
        const used = new Set();
        for (const component of this.componentRegistry.values()) {
            for (const ref of component.usesComponents) {
                if (ref.path)
                    used.add(ref.path);
            }
        }
        const suppressions = new Map();
        for (const filePath of used) {
            const component = this.componentRegistry.get(filePath);
            if (!component)
                continue;
            const rootItems = component.listItems.filter((item) => item.nesting === "root");
            if (!rootItems.length)
                continue;
            const keySet = new Set();
            for (const item of rootItems) {
                keySet.add(`${item.line}:${item.column}`);
            }
            const ext = path.extname(filePath).toLowerCase();
            if (ext === ".vue" || ext === ".html") {
                keySet.add("0:0");
            }
            suppressions.set(filePath, keySet);
        }
        return suppressions;
    }
    getSectionHeadingSuppressions() {
        const suppressions = new Map();
        const cache = new Map();
        const visiting = new Set();
        const hasHeadingOutsideSection = (component, depth = 0) => {
            if (this.maxDepth !== undefined && depth > this.maxDepth)
                return false;
            if (cache.has(component.filePath))
                return cache.get(component.filePath);
            if (visiting.has(component.filePath))
                return false;
            visiting.add(component.filePath);
            if (component.hasHeadingOutsideSection) {
                cache.set(component.filePath, true);
                visiting.delete(component.filePath);
                return true;
            }
            for (const ref of component.usesComponents) {
                if (!ref.path || !this.componentRegistry.has(ref.path))
                    continue;
                const usedOutsideSection = ref.usageLocations.length === 0
                    ? true
                    : ref.usageLocations.some((loc) => typeof loc.inSection === "boolean"
                        ? !loc.inSection
                        : true);
                if (!usedOutsideSection)
                    continue;
                const child = this.componentRegistry.get(ref.path);
                if (hasHeadingOutsideSection(child, depth + 1)) {
                    cache.set(component.filePath, true);
                    visiting.delete(component.filePath);
                    return true;
                }
            }
            cache.set(component.filePath, false);
            visiting.delete(component.filePath);
            return false;
        };
        for (const component of this.componentRegistry.values()) {
            for (const section of component.sections) {
                if (section.hasLocalHeading)
                    continue;
                const satisfiedByChild = section.childComponents.some((ref) => {
                    if (!ref.path || !this.componentRegistry.has(ref.path))
                        return false;
                    const child = this.componentRegistry.get(ref.path);
                    return hasHeadingOutsideSection(child, 0);
                });
                if (!satisfiedByChild)
                    continue;
                if (!suppressions.has(component.filePath)) {
                    suppressions.set(component.filePath, new Set());
                }
                suppressions
                    .get(component.filePath)
                    .add(`${section.line}:${section.column}`);
            }
        }
        return suppressions;
    }
    findEntryPoints() {
        const all = Array.from(this.componentRegistry.values());
        const imported = new Set();
        all.forEach(c => c.usesComponents.forEach(r => r.path && imported.add(r.path)));
        return all.filter(c => !imported.has(c.filePath));
    }
    findComponentsWithRule(root, rule, depth = 0) {
        const res = [];
        const visited = new Set();
        const dfs = (c, d) => {
            if (visited.has(c.filePath))
                return;
            visited.add(c.filePath);
            if (c.issues.has(rule))
                res.push(c);
            if (this.maxDepth !== undefined && d >= this.maxDepth)
                return;
            c.usesComponents.forEach(r => r.path && this.componentRegistry.has(r.path) && dfs(this.componentRegistry.get(r.path), d + 1));
        };
        dfs(root, depth);
        return res;
    }
}
exports.ComponentAnalyzer = ComponentAnalyzer;
const NON_COMPONENT_TAGS = new Set([
    "root",
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "param",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
    "svg",
    "path",
    "circle",
    "ellipse",
    "line",
    "polygon",
    "polyline",
    "rect",
    "g",
    "defs",
    "lineargradient",
    "radialgradient",
    "stop",
    "mask",
    "pattern",
    "clippath",
    "symbol",
    "use",
    "text",
    "tspan",
    "foreignobject",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "mrow",
    "msup",
    "msub",
    "msubsup",
    "mover",
    "munder",
    "munderover",
    "mfrac",
    "msqrt",
    "mroot",
    "mtable",
    "mtr",
    "mtd",
    "component",
    "transition",
    "transition-group",
    "keep-alive",
    "teleport",
    "suspense",
    "slot",
]);
function isVueComponentTag(tag) {
    return !NON_COMPONENT_TAGS.has(tag);
}
function normalizeComponentKey(name) {
    return name.replace(/[-_]/g, "").toLowerCase();
}
function buildLineIndex(content) {
    const lines = [0];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === "\n")
            lines.push(i + 1);
    }
    return lines;
}
function indexToLoc(lineIndex, index) {
    let low = 0;
    let high = lineIndex.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineIndex[mid] <= index) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    const line = Math.max(high, 0);
    const column = index - lineIndex[line];
    return { line, column };
}
function shouldWarnForHeadingOrder(newLevel, lastLevel) {
    if (!lastLevel)
        return false;
    if (newLevel === 1 && lastLevel !== 1)
        return true;
    if (newLevel > lastLevel + 1)
        return true;
    if (lastLevel > newLevel + 1)
        return true;
    return false;
}
