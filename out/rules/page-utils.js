"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUnconditional = isUnconditional;
exports.isResolvedPage = isResolvedPage;
exports.isCompletePage = isCompletePage;
exports.sourceForProvenance = sourceForProvenance;
exports.sourceForFact = sourceForFact;
exports.pageRootSource = pageRootSource;
exports.relatedForFact = relatedForFact;
exports.relatedCompositionForFact = relatedCompositionForFact;
exports.matchingFileResult = matchingFileResult;
const path_1 = __importDefault(require("path"));
const INCOMPLETE_REASONS = new Set([
    "conditional-render",
    "cycle",
    "depth-limit",
    "fragment-boundary",
    "missing-page-root",
    "parse-error",
    "runtime-composition",
    "slot-or-children",
    "unresolved-import",
    "unsupported-syntax",
]);
function isUnconditional(fact) {
    return fact.condition.kind === "always";
}
function isResolvedPage(context) {
    return (context.page.route.state === "known" &&
        context.page.rootComponent.state === "resolved" &&
        context.page.confidence !== "unknown");
}
function isCompletePage(context) {
    return (isResolvedPage(context) &&
        !context.page.unknowns.some((unknown) => INCOMPLETE_REASONS.has(unknown.reason)));
}
function sourceForProvenance(provenance, context) {
    var _a, _b, _c, _d;
    if (!provenance.fileId)
        return undefined;
    const file = context.graph.files.find((entry) => entry.id === provenance.fileId);
    if (!file)
        return undefined;
    return {
        filePath: file.path,
        line: (_b = (_a = provenance.range) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 0,
        column: (_d = (_c = provenance.range) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0,
    };
}
function sourceForFact(fact, context) {
    var _a;
    const source = sourceForProvenance(fact.provenance, context);
    return source
        ? {
            ...source,
            pageComponentPath: [...fact.componentPath],
            pageCompositionPath: [...((_a = fact.compositionPath) !== null && _a !== void 0 ? _a : [])],
        }
        : undefined;
}
function pageRootSource(context) {
    if (context.page.rootComponent.state !== "resolved")
        return undefined;
    const rootComponentId = context.page.rootComponent.id;
    const root = context.graph.components.find((component) => component.id === rootComponentId);
    return root ? sourceForProvenance(root.provenance, context) : undefined;
}
function relatedForFact(fact, context, message) {
    const source = sourceForFact(fact, context);
    return (source === null || source === void 0 ? void 0 : source.filePath)
        ? {
            filePath: source.filePath,
            line: source.line,
            column: source.column,
            message,
        }
        : undefined;
}
function relatedCompositionForFact(fact, context, message) {
    var _a;
    const compositionPath = (_a = fact.compositionPath) !== null && _a !== void 0 ? _a : [];
    const edgeId = compositionPath[compositionPath.length - 1];
    if (!edgeId)
        return undefined;
    const edge = context.graph.composition.find((candidate) => candidate.id === edgeId);
    if (!edge)
        return undefined;
    const source = sourceForProvenance(edge.provenance, context);
    return (source === null || source === void 0 ? void 0 : source.filePath)
        ? { ...source, filePath: source.filePath, message }
        : undefined;
}
function matchingFileResult(context, rule, fact) {
    const source = sourceForFact(fact, context);
    if (!(source === null || source === void 0 ? void 0 : source.filePath))
        return undefined;
    const target = comparableFile(source.filePath);
    for (const [file, results] of context.fileResults) {
        if (comparableFile(file) !== target)
            continue;
        return results.find((result) => result.rule === rule &&
            result.line === source.line &&
            result.column === source.column);
    }
    return undefined;
}
function comparableFile(filePath) {
    const resolved = path_1.default.resolve(filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
