"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_PAGE_MODEL_SCHEMA_VERSION = void 0;
exports.createConfiguredRouteAdapter = createConfiguredRouteAdapter;
exports.createReactFileRouteAdapter = createReactFileRouteAdapter;
exports.createVueFileRouteAdapter = createVueFileRouteAdapter;
exports.composeSemanticPageModel = composeSemanticPageModel;
const path_1 = __importDefault(require("path"));
exports.SEMANTIC_PAGE_MODEL_SCHEMA_VERSION = "1.0";
function createConfiguredRouteAdapter(configurations) {
    return {
        name: "configured-pages",
        discover({ graph, rootDirectory }) {
            return configurations.flatMap((configuration) => {
                const expected = path_1.default.resolve(rootDirectory, configuration.entryFile);
                const file = graph.files.find((candidate) => path_1.default.resolve(candidate.path) === expected);
                const componentId = file === null || file === void 0 ? void 0 : file.componentIds[0];
                if (!file || !componentId) {
                    return [{
                            route: configuration.route,
                            rootComponentId: `component:missing:${encodeURIComponent(configuration.entryFile)}`,
                            discovery: "configured",
                            confidence: "certain",
                            provenance: {
                                kind: "analysis",
                                extractor: "configured-pages",
                                confidence: "certain",
                                description: `Configured entry '${configuration.entryFile}' was not present in the semantic graph.`,
                            },
                        }];
                }
                return [{
                        route: configuration.route,
                        rootComponentId: componentId,
                        discovery: "configured",
                        confidence: "certain",
                        provenance: {
                            kind: "derived",
                            fileId: file.id,
                            framework: file.framework,
                            extractor: "configured-pages",
                            confidence: "certain",
                            description: `Configured route '${configuration.route}' uses '${configuration.entryFile}'.`,
                        },
                    }];
            });
        },
    };
}
function createReactFileRouteAdapter(options) {
    return createFileSystemRouteAdapter("react", "react-filesystem", options);
}
function createVueFileRouteAdapter(options) {
    return createFileSystemRouteAdapter("vue", "vue-filesystem", options);
}
function createFileSystemRouteAdapter(framework, discovery, options) {
    return {
        name: discovery,
        discover({ graph, rootDirectory }) {
            const directory = path_1.default.resolve(rootDirectory, options.directory);
            return graph.files.flatMap((file) => {
                var _a, _b;
                if (file.framework !== framework)
                    return [];
                const relative = path_1.default.relative(directory, path_1.default.resolve(file.path));
                if (!relative || relative === ".." || relative.startsWith(`..${path_1.default.sep}`)) {
                    return [];
                }
                const componentId = file.componentIds[0];
                if (!componentId)
                    return [];
                return [{
                        route: (_b = (_a = options.routeFromFile) === null || _a === void 0 ? void 0 : _a.call(options, relative)) !== null && _b !== void 0 ? _b : defaultRouteFromFile(relative),
                        rootComponentId: componentId,
                        discovery,
                        confidence: "inferred",
                        provenance: {
                            kind: "inferred",
                            fileId: file.id,
                            framework,
                            extractor: discovery,
                            confidence: "inferred",
                            description: `Opt-in filesystem adapter discovered '${relative}'.`,
                        },
                    }];
            });
        },
    };
}
function defaultRouteFromFile(relativeFile) {
    const normalized = relativeFile.replace(/\\/g, "/").replace(/\.(?:jsx?|tsx?|vue)$/i, "");
    const withoutIndex = normalized.replace(/(?:^|\/)index$/i, "");
    return `/${withoutIndex}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}
async function composeSemanticPageModel(graph, adapters = []) {
    const candidates = (await Promise.all(adapters.map((adapter) => adapter.discover({
        graph,
        rootDirectory: graph.boundary.rootDirectory,
    })))).flat();
    const pages = candidates.length > 0
        ? candidates.map((candidate) => composeCandidate(graph, candidate))
        : graph.pageRoots.map((root) => composeHeuristicRoot(graph, root));
    const unknowns = pages.length > 0
        ? pages.flatMap((page) => page.unknowns)
        : [analysisUnknown("missing-page-root", "No route adapter or entry-point heuristic produced a page.")];
    return {
        schemaVersion: exports.SEMANTIC_PAGE_MODEL_SCHEMA_VERSION,
        graphSchemaVersion: graph.schemaVersion,
        pages,
        unknowns,
    };
}
function composeCandidate(graph, candidate) {
    const component = graph.components.find((entry) => entry.id === candidate.rootComponentId);
    if (!component) {
        const unknown = analysisUnknown("unsupported-syntax", `Route adapter referenced missing component '${candidate.rootComponentId}'.`);
        return {
            id: `page:adapter:${encodeURIComponent(candidate.route)}`,
            route: { state: "known", value: candidate.route },
            discovery: candidate.discovery,
            confidence: candidate.confidence,
            rootComponent: unknown,
            facts: [],
            gaps: [],
            unknowns: [unknown],
            provenance: candidate.provenance,
        };
    }
    return composeDocument(graph, {
        id: `page:adapter:${encodeURIComponent(candidate.route)}`,
        route: { state: "known", value: candidate.route },
        discovery: candidate.discovery,
        confidence: candidate.confidence,
        rootComponent: { state: "resolved", id: component.id },
        provenance: candidate.provenance,
    });
}
function composeHeuristicRoot(graph, root) {
    return composeDocument(graph, {
        id: root.id,
        route: root.route,
        discovery: "entry-point-heuristic",
        confidence: root.route.state === "known" ? "inferred" : "unknown",
        rootComponent: root.rootComponent,
        provenance: root.provenance,
    });
}
function composeDocument(graph, identity) {
    const unknowns = [];
    const facts = [];
    const gaps = [];
    let order = 0;
    let sequence = 0;
    const buildTree = (componentId, componentPath, compositionPath, inheritedSectionAncestorIds, inheritedCondition, stack) => {
        var _a, _b;
        const component = graph.components.find((entry) => entry.id === componentId);
        if (!component)
            return undefined;
        if (stack.includes(componentId)) {
            const cycle = analysisUnknown("cycle", `Page composition stopped at '${component.name}' cycle.`);
            unknowns.push(cycle);
            return {
                componentId,
                name: component.name,
                semanticOutput: cycle,
                compositionPath,
                provenance: component.provenance,
                children: [],
                unknowns: [cycle],
            };
        }
        const nextPath = [...componentPath, componentId];
        const localUnknowns = [];
        const children = [];
        if (component.semanticOutput.state === "unknown") {
            localUnknowns.push(component.semanticOutput);
            unknowns.push(component.semanticOutput);
        }
        const rootIds = component.renderRoots
            .filter((root) => root.state === "resolved")
            .map((root) => root.id);
        const edges = graph.composition
            .filter((edge) => rootIds.includes(edge.from))
            .sort((left, right) => knownOrder(left.order) - knownOrder(right.order));
        for (const edge of edges) {
            const conditionUnknown = edge.condition.kind === "unknown"
                ? edge.condition.unknown
                : edge.condition.kind === "branch" && edge.condition.expression.state === "unknown"
                    ? edge.condition.expression
                    : undefined;
            if (conditionUnknown) {
                localUnknowns.push(conditionUnknown);
                unknowns.push(conditionUnknown);
            }
            if (edge.to.state === "unknown") {
                localUnknowns.push(edge.to);
                unknowns.push(edge.to);
                gaps.push({
                    sequence: sequence++,
                    componentPath: nextPath,
                    compositionPath: [...compositionPath, edge.id],
                    unknown: edge.to,
                    provenance: edge.provenance,
                });
                continue;
            }
            const targetId = edge.to.id;
            const renderNode = graph.renderNodes.find((node) => node.id === targetId);
            if ((renderNode === null || renderNode === void 0 ? void 0 : renderNode.kind) === "native-element") {
                facts.push(...factsForNode(renderNode, nextPath, compositionPath, [...inheritedSectionAncestorIds, ...((_a = renderNode.sectionAncestorIds) !== null && _a !== void 0 ? _a : [])], combineConditions(inheritedCondition, edge.condition), order, sequence));
                order = facts.length;
                sequence += factsForNodeCount(renderNode);
                continue;
            }
            const child = graph.components.find((entry) => entry.id === targetId);
            if (child && edge.traversal.state === "complete") {
                const childTree = buildTree(child.id, nextPath, [...compositionPath, edge.id], [...inheritedSectionAncestorIds, ...((_b = edge.sectionAncestorIds) !== null && _b !== void 0 ? _b : [])], combineConditions(inheritedCondition, edge.condition), [...stack, componentId]);
                if (childTree)
                    children.push(childTree);
            }
            if (edge.traversal.state === "boundary") {
                localUnknowns.push(edge.traversal.unknown);
                unknowns.push(edge.traversal.unknown);
                gaps.push({
                    sequence: sequence++,
                    componentPath: nextPath,
                    compositionPath: [...compositionPath, edge.id],
                    unknown: edge.traversal.unknown,
                    provenance: edge.provenance,
                });
            }
        }
        return {
            componentId,
            name: component.name,
            semanticOutput: component.semanticOutput,
            compositionPath,
            provenance: component.provenance,
            children,
            unknowns: localUnknowns,
        };
    };
    const componentTree = identity.rootComponent.state === "resolved"
        ? buildTree(identity.rootComponent.id, [], [], [], { kind: "always" }, [])
        : undefined;
    if (identity.route.state === "unknown")
        unknowns.push(identity.route);
    if (identity.rootComponent.state === "unknown")
        unknowns.push(identity.rootComponent);
    return { ...identity, componentTree, facts, gaps, unknowns };
}
function knownOrder(value) {
    return value.state === "known" ? value.value : Number.MAX_SAFE_INTEGER;
}
function factsForNode(node, componentPath, compositionPath, sectionAncestorIds, condition, startOrder, startSequence) {
    const facts = [];
    const base = {
        tagName: node.tagName,
        renderNodeId: node.id,
        componentPath,
        compositionPath,
        sectionAncestorIds,
        condition,
        provenance: node.provenance,
    };
    const heading = node.semantics.find((fact) => fact.kind === "heading");
    if ((heading === null || heading === void 0 ? void 0 : heading.kind) === "heading" && heading.level.state === "known") {
        facts.push({ ...base, kind: "heading", value: heading.level.value });
    }
    const landmark = landmarkForTag(node.tagName);
    if (landmark)
        facts.push({ ...base, kind: "landmark", value: landmark });
    if (node.tagName === "section")
        facts.push({ ...base, kind: "section" });
    if (node.tagName === "nav")
        facts.push({ ...base, kind: "navigation" });
    for (const fact of node.semantics) {
        if (fact.kind === "document-id" && fact.value.state === "known") {
            facts.push({ ...base, kind: "document-id", value: fact.value.value });
        }
    }
    return facts.map((fact, index) => ({
        ...fact,
        order: startOrder + index,
        sequence: startSequence + index,
    }));
}
function factsForNodeCount(node) {
    let count = 0;
    if (node.semantics.some((fact) => fact.kind === "heading" && fact.level.state === "known"))
        count += 1;
    if (landmarkForTag(node.tagName))
        count += 1;
    if (node.tagName === "section")
        count += 1;
    if (node.tagName === "nav")
        count += 1;
    count += node.semantics.filter((fact) => fact.kind === "document-id" && fact.value.state === "known").length;
    return count;
}
function combineConditions(outer, inner) {
    if (outer.kind === "always")
        return inner;
    if (inner.kind === "always")
        return outer;
    const source = outer.kind === "unknown"
        ? outer.unknown
        : inner.kind === "unknown"
            ? inner.unknown
            : analysisUnknown("conditional-render", "Nested conditional composition cannot be proven unconditional.");
    return { kind: "unknown", unknown: source };
}
function landmarkForTag(tagName) {
    return {
        header: "banner",
        nav: "navigation",
        main: "main",
        aside: "complementary",
        footer: "contentinfo",
    }[tagName];
}
function analysisUnknown(reason, message) {
    return {
        state: "unknown",
        reason,
        message,
        provenance: {
            kind: "analysis",
            confidence: "certain",
            extractor: "SemanticPageComposer",
        },
    };
}
