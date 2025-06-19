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
class ComponentAnalyzer {
    constructor(options, perf) {
        this.componentRegistry = new Map();
        this.importToComponentMap = new Map();
        this.processingComponentStack = new Set(); // To prevent circular references
        this.resolver = new component_path_resolver_1.ComponentPathResolver();
        this.options = options;
        this.perf = perf;
    }
    async analyzeFile(filePath) {
        var _a;
        const start = Date.now();
        try {
            const content = await fs.readFile(filePath, 'utf8');
            if (!/\.(jsx|tsx)$/.test(filePath))
                return null;
            const { component, timings } = await this.extractComponentInfo(content, filePath);
            timings.total = Date.now() - start;
            (_a = this.perf) === null || _a === void 0 ? void 0 : _a.record(filePath, timings);
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
            headings: []
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
        // Collect JSX usages and headings
        t0 = Date.now();
        (0, traverse_1.default)(ast, {
            JSXElement(path) {
                var _a, _b;
                const elt = path.node.openingElement.name;
                if (t.isJSXIdentifier(elt)) {
                    const name = elt.name;
                    const tag = name.toLowerCase();
                    // Record headings
                    if (/^h[1-6]$/.test(tag)) {
                        const level = parseInt(tag.charAt(1), 10);
                        const loc = (_a = elt.loc) === null || _a === void 0 ? void 0 : _a.start;
                        if (loc) {
                            componentDef.headings.push({
                                level,
                                line: loc.line - 1,
                                column: loc.column,
                                filePath
                            });
                        }
                    }
                    // Record component usage (only for capitalized components)
                    if (/^[A-Z]/.test(name)) {
                        const existingRef = componentDef.usesComponents.find(c => c.name === name);
                        const loc = (_b = elt.loc) === null || _b === void 0 ? void 0 : _b.start;
                        const location = loc ? { line: loc.line - 1, column: loc.column } : { line: 0, column: 0 };
                        if (existingRef) {
                            // Add usage location to existing reference
                            existingRef.usageLocations.push(location);
                        }
                        else {
                            // Create new component reference
                            const rawImportPath = importedComponents.get(name) || null;
                            componentDef.usesComponents.push({
                                name,
                                path: null, // Will be resolved later
                                rawImportPath,
                                sourceLocation: location,
                                usageLocations: [location]
                            });
                        }
                    }
                }
            }
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
                if (lastHeadingLevel && heading.level > lastHeadingLevel + 1) {
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
        return results;
    }
    findCrossComponentH1Issues(results) {
        const entryPoints = this.findEntryPoints();
        for (const entry of entryPoints) {
            const comps = this.findComponentsWithRule(entry, 'singleH1');
            if (comps.length > 1) {
                for (let i = 1; i < comps.length; i++) {
                    const comp = comps[i];
                    const ref = this.findReferenceForComp(entry, comp.filePath);
                    if (ref) {
                        // Use first JSX usage location instead of import location
                        const location = ref.usageLocations[0] || ref.sourceLocation;
                        results.push({
                            filePath: entry.filePath,
                            line: location.line,
                            column: location.column,
                            message: `Multiple <h1> tags: component '${comp.name}' brings an extra <h1>. Use a lower-level heading.`,
                            rule: 'singleH1'
                        });
                    }
                    else {
                        const issue = comp.issues.get('singleH1')[0];
                        results.push({
                            filePath: comp.filePath,
                            line: issue.line,
                            column: issue.column,
                            message: `Multiple <h1> across components - consider using lower-level headings.`,
                            rule: 'singleH1'
                        });
                    }
                }
            }
        }
    }
    findReferenceForComp(root, targetPath) {
        for (const ref of root.usesComponents) {
            if (ref.path === targetPath)
                return ref;
        }
        for (const ref of root.usesComponents) {
            if (ref.path && this.componentRegistry.has(ref.path)) {
                const nested = this.findReferenceForComp(this.componentRegistry.get(ref.path), targetPath);
                if (nested)
                    return ref;
            }
        }
        return null;
    }
    /**
     * Improved implementation to find heading order issues across components
     */
    findCrossComponentHeadingOrderIssues(results) {
        const entryPoints = this.findEntryPoints();
        for (const entry of entryPoints) {
            // Process each entry point as a document root
            this.processingComponentStack.clear();
            this.analyzeHeadingHierarchy(entry, results);
        }
    }
    /**
     * Collects all headings from a component and its children in document order
     * and checks for heading level issues
     */
    analyzeHeadingHierarchy(component, results) {
        var _a, _b, _c;
        if (this.processingComponentStack.has(component.filePath)) {
            // Avoid circular references
            return;
        }
        this.processingComponentStack.add(component.filePath);
        // Build a flattened view of all headings in document order
        const allHeadings = this.collectHeadingsInDocumentOrder(component);
        // Check for heading level issues
        let lastLevel = 0;
        for (const heading of allHeadings) {
            if (lastLevel > 0 && heading.heading.level > lastLevel + 1) {
                // We found a heading level skip
                results.push({
                    filePath: ((_a = heading.usageLocation) === null || _a === void 0 ? void 0 : _a.filePath) || heading.heading.filePath,
                    line: ((_b = heading.usageLocation) === null || _b === void 0 ? void 0 : _b.line) || heading.heading.line,
                    column: ((_c = heading.usageLocation) === null || _c === void 0 ? void 0 : _c.column) || heading.heading.column,
                    message: `Cross-component heading level skipped: <h${heading.heading.level}> after <h${lastLevel}>`,
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
    collectHeadingsInDocumentOrder(component) {
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
                if (childRef.path && this.componentRegistry.has(childRef.path) && !this.processingComponentStack.has(childRef.path)) {
                    const childComponent = this.componentRegistry.get(childRef.path);
                    const usageLoc = childRef.usageLocations[0] || childRef.sourceLocation;
                    const usageLocation = {
                        filePath: component.filePath,
                        line: usageLoc.line,
                        column: usageLoc.column
                    };
                    this.processingComponentStack.add(childRef.path);
                    const childHeadings = this.collectHeadingsInDocumentOrder(childComponent)
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
                    if (nextChild.path && this.componentRegistry.has(nextChild.path) && !this.processingComponentStack.has(nextChild.path)) {
                        const childComponent = this.componentRegistry.get(nextChild.path);
                        const usageLocation = {
                            filePath: component.filePath,
                            line: childLoc.line,
                            column: childLoc.column
                        };
                        this.processingComponentStack.add(nextChild.path);
                        const childHeadings = this.collectHeadingsInDocumentOrder(childComponent)
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
    findEntryPoints() {
        const all = Array.from(this.componentRegistry.values());
        const imported = new Set();
        all.forEach(c => c.usesComponents.forEach(r => r.path && imported.add(r.path)));
        return all.filter(c => !imported.has(c.filePath));
    }
    findComponentsWithRule(root, rule) {
        const res = [];
        const visited = new Set();
        const dfs = (c) => {
            if (visited.has(c.filePath))
                return;
            visited.add(c.filePath);
            if (c.issues.has(rule))
                res.push(c);
            c.usesComponents.forEach(r => r.path && this.componentRegistry.has(r.path) && dfs(this.componentRegistry.get(r.path)));
        };
        dfs(root);
        return res;
    }
}
exports.ComponentAnalyzer = ComponentAnalyzer;
