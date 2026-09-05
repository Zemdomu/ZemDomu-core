"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPageAwareDiagnostics = createPageAwareDiagnostics;
const path_1 = __importDefault(require("path"));
const diagnostics_1 = require("./diagnostics");
function comparableFile(filePath) {
    const resolved = path_1.default.resolve(filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function sourceForProvenance(provenance, graph) {
    var _a, _b, _c, _d;
    if (!provenance.fileId)
        return undefined;
    const file = graph.files.find((entry) => entry.id === provenance.fileId);
    if (!file)
        return undefined;
    return {
        file: file.path,
        line: (_b = (_a = provenance.range) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 0,
        column: (_d = (_c = provenance.range) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0,
    };
}
function collectComponentPaths(tree, componentIds, prefix = []) {
    if (!tree)
        return [];
    const current = [...prefix, tree.componentId];
    return [
        ...(componentIds.has(tree.componentId) ? [current] : []),
        ...tree.children.flatMap((child) => collectComponentPaths(child, componentIds, current)),
    ];
}
function pathsForResult(result, page, graph) {
    var _a;
    if (result.pageComponentPath) {
        return [{
                componentPath: [...result.pageComponentPath],
                compositionPath: [...((_a = result.pageCompositionPath) !== null && _a !== void 0 ? _a : [])],
            }];
    }
    if (!result.filePath)
        return [];
    const targetFile = comparableFile(result.filePath);
    const fileIds = new Set(graph.files
        .filter((file) => comparableFile(file.path) === targetFile)
        .map((file) => file.id));
    if (!fileIds.size)
        return [];
    const exactFactPaths = page.facts
        .filter((fact) => {
        var _a, _b;
        return fact.provenance.fileId &&
            fileIds.has(fact.provenance.fileId) &&
            ((_a = fact.provenance.range) === null || _a === void 0 ? void 0 : _a.start.line) === result.line &&
            ((_b = fact.provenance.range) === null || _b === void 0 ? void 0 : _b.start.column) === result.column;
    })
        .map((fact) => {
        var _a;
        return ({
            componentPath: [...fact.componentPath],
            compositionPath: [...((_a = fact.compositionPath) !== null && _a !== void 0 ? _a : [])],
        });
    });
    if (exactFactPaths.length)
        return exactFactPaths;
    const componentIds = new Set(graph.components
        .filter((component) => fileIds.has(component.fileId))
        .map((component) => component.id));
    return collectComponentPaths(page.componentTree, componentIds).map((componentPath) => ({ componentPath, compositionPath: [] }));
}
function resolveUniqueContext(result, graph, model) {
    const candidates = model.pages.flatMap((page) => {
        if (result.pageId && page.id !== result.pageId)
            return [];
        if (page.route.state !== "known" || page.confidence === "unknown")
            return [];
        const confidence = page.confidence;
        return pathsForResult(result, page, graph).map(({ componentPath, compositionPath }) => ({
            page: page.route.state === "known" ? page.route.value : "",
            componentPath,
            compositionPath,
            confidence,
        }));
    });
    const unique = new Map(candidates.map((candidate) => [
        `${candidate.page}\u0000${candidate.componentPath.join("\u0000")}\u0000${candidate.compositionPath.join("\u0000")}`,
        candidate,
    ]));
    return unique.size === 1 ? [...unique.values()][0] : undefined;
}
function relatedCompositionLocations(context, graph, primary) {
    const primaryKey = `${comparableFile(primary.file)}:${primary.line}:${primary.column}`;
    const related = context.componentPath.flatMap((componentId) => {
        const component = graph.components.find((entry) => entry.id === componentId);
        if (!component)
            return [];
        const source = sourceForProvenance(component.provenance, graph);
        if (!source)
            return [];
        const sourceKey = `${comparableFile(source.file)}:${source.line}:${source.column}`;
        if (sourceKey === primaryKey)
            return [];
        return [{ source, message: `Rendered through '${component.name}'` }];
    });
    const compositionRelated = context.compositionPath.flatMap((edgeId) => {
        const edge = graph.composition.find((entry) => entry.id === edgeId);
        if (!edge)
            return [];
        const source = sourceForProvenance(edge.provenance, graph);
        if (!source)
            return [];
        const sourceKey = `${comparableFile(source.file)}:${source.line}:${source.column}`;
        if (sourceKey === primaryKey)
            return [];
        return [{ source, message: "Composed through this component usage" }];
    });
    return [...new Map([...related, ...compositionRelated].map((entry) => [
            `${comparableFile(entry.source.file)}:${entry.source.line}:${entry.source.column}`,
            entry,
        ])).values()];
}
function suggestionFor(result) {
    if (result.rule === "requireSingleMain") {
        return {
            message: result.message.includes("missing")
                ? "Add one <main> landmark to the resolved composed page."
                : "Keep one <main> landmark in the composed page and change or remove the extra landmark.",
        };
    }
    if (result.rule === "requirePageH1") {
        return { message: "Add one <h1> that identifies the resolved composed page." };
    }
    const messages = {
        singleH1: "Keep one <h1> in the composed page; change this heading's level if it is not the page title.",
        enforceHeadingOrder: "Use the next sequential heading level for this section of the composed page.",
        uniqueIds: "Give this element an id that is unique within the composed page.",
        requireNavLinks: "Add at least one link to this navigation landmark.",
        enforceListNesting: "Render this list-item component inside a <ul> or <ol>.",
        requireSectionHeading: "Add a heading that describes this section, or use <div> when it is not a standalone section.",
    };
    const message = messages[result.rule];
    return message ? { message } : undefined;
}
/**
 * Adapt legacy lint results to canonical diagnostics and add page composition
 * context only when one page and one component path are statically resolved.
 */
function createPageAwareDiagnostics(results, graph, model) {
    return [...results.entries()].flatMap(([sourceFile, entries]) => entries.map((result) => {
        var _a;
        const primary = {
            file: (_a = result.filePath) !== null && _a !== void 0 ? _a : sourceFile,
            line: result.line,
            column: result.column,
            ...(result.offset === undefined ? {} : { offset: result.offset }),
        };
        const context = resolveUniqueContext(result, graph, model);
        if (!context)
            return (0, diagnostics_1.toZemDomuDiagnostic)(result, { sourceFile });
        const componentNames = context.componentPath.map((componentId) => {
            var _a, _b;
            return (_b = (_a = graph.components.find((component) => component.id === componentId)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : componentId;
        });
        return (0, diagnostics_1.toZemDomuDiagnostic)(result, {
            sourceFile,
            page: context.page,
            componentPath: componentNames,
            relatedLocations: relatedCompositionLocations(context, graph, primary),
            ...(result.pageEditSafe === false
                ? {}
                : {
                    preferredEditLocation: primary,
                    suggestion: suggestionFor(result),
                }),
            provenance: {
                kind: "cross-component",
                analyzer: "SemanticPageComposer",
                description: `Resolved the finding through the unique component path for page '${context.page}'.`,
            },
            confidence: context.confidence,
        });
    }));
}
