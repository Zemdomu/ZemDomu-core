"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSemanticGraphInspection = formatSemanticGraphInspection;
exports.formatSemanticPageInspection = formatSemanticPageInspection;
const path_1 = __importDefault(require("path"));
/** Render a deterministic, human-readable view of the public semantic graph. */
function formatSemanticGraphInspection(graph) {
    const source = createSourceResolver(graph);
    const lines = [
        `Semantic graph ${graph.schemaVersion}`,
        "Root: .",
        `Status: ${graph.boundary.completeness.state}`,
        "",
        `Files (${graph.files.length})`,
    ];
    const files = [...graph.files].sort((left, right) => stableCompare(displayPath(left.path, graph), displayPath(right.path, graph)));
    if (!files.length)
        lines.push("- none");
    for (const file of files) {
        lines.push(`- file ${displayPath(file.path, graph)} [${file.framework}/${file.language}]`);
    }
    lines.push("", `Components (${graph.components.length})`);
    const components = [...graph.components].sort((left, right) => stableCompare(`${left.name}\u0000${left.id}`, `${right.name}\u0000${right.id}`));
    if (!components.length)
        lines.push("- none");
    for (const component of components) {
        const output = component.semanticOutput.state === "known"
            ? `<${component.semanticOutput.tagName}> [${component.semanticOutput.confidence}]`
            : `unknown(${component.semanticOutput.reason})`;
        lines.push(`- component ${component.name} -> ${output} @ ${source(component.provenance)}`);
    }
    lines.push("", `Semantic nodes (${graph.renderNodes.length})`);
    const renderNodes = [...graph.renderNodes].sort((left, right) => stableCompare(`${source(left.provenance)}\u0000${left.id}`, `${source(right.provenance)}\u0000${right.id}`));
    if (!renderNodes.length)
        lines.push("- none");
    for (const node of renderNodes) {
        if (node.kind === "native-element") {
            const facts = node.semantics.map(formatRenderedFact).join(", ");
            lines.push(`- native <${node.tagName}>${facts ? `: ${facts}` : ""} @ ${source(node.provenance)}`);
        }
        else if (node.kind === "fragment") {
            lines.push(`- fragment ${node.fragmentKind} @ ${source(node.provenance)}`);
        }
        else {
            lines.push(`- unknown-render ${node.unknown.reason} @ ${source(node.provenance)}`);
        }
    }
    const unknowns = collectGraphUnknowns(graph).sort(compareUnknowns(source));
    lines.push("", `Unknowns (${unknowns.length})`);
    if (!unknowns.length)
        lines.push("- none");
    for (const { context, unknown } of unknowns) {
        lines.push(`- ${context}: ${unknown.reason}${unknown.message ? ` - ${unknown.message}` : ""} @ ${source(unknown.provenance)}`);
    }
    return lines.join("\n");
}
/** Render one configured page from the public page/document model. */
function formatSemanticPageInspection(model, graph, route) {
    const source = createSourceResolver(graph);
    const componentNames = new Map(graph.components.map((component) => [component.id, component.name]));
    const page = model.pages.find((candidate) => candidate.route.state === "known" && candidate.route.value === route);
    if (!page) {
        throw new Error(`Page '${route}' was not found in the semantic page model.`);
    }
    const lines = [
        `Page ${route}`,
        `Schema: ${model.schemaVersion} (graph ${model.graphSchemaVersion})`,
        `Discovery: ${page.discovery} [${page.confidence}]`,
        "",
        "Components",
    ];
    if (page.componentTree) {
        appendComponentTree(lines, page.componentTree, source, "");
    }
    else {
        lines.push("- none");
    }
    const facts = [...page.facts].sort((left, right) => {
        var _a, _b;
        return left.order - right.order ||
            ((_a = left.sequence) !== null && _a !== void 0 ? _a : left.order) - ((_b = right.sequence) !== null && _b !== void 0 ? _b : right.order) ||
            left.renderNodeId.localeCompare(right.renderNodeId);
    });
    lines.push("", `Semantic facts (${facts.length})`);
    if (!facts.length)
        lines.push("- none");
    for (const fact of facts) {
        const value = fact.value === undefined ? "" : `=${String(fact.value)}`;
        const componentPath = fact.componentPath
            .map((id) => { var _a; return (_a = componentNames.get(id)) !== null && _a !== void 0 ? _a : id; })
            .join(" > ");
        lines.push(`- ${fact.kind}${value} <${fact.tagName}> @ ${source(fact.provenance)}${componentPath ? ` [${componentPath}]` : ""}`);
    }
    const unknowns = collectPageUnknowns(model, page).sort(compareUnknowns(source));
    lines.push("", `Unknowns (${unknowns.length})`);
    if (!unknowns.length)
        lines.push("- none");
    for (const { context, unknown } of unknowns) {
        lines.push(`- ${context}: ${unknown.reason}${unknown.message ? ` - ${unknown.message}` : ""} @ ${source(unknown.provenance)}`);
    }
    return lines.join("\n");
}
function appendComponentTree(lines, component, source, indent) {
    const output = component.semanticOutput.state === "known"
        ? ` -> <${component.semanticOutput.tagName}> [${component.semanticOutput.confidence}]`
        : ` -> unknown(${component.semanticOutput.reason})`;
    lines.push(`${indent}- component ${component.name}${output} @ ${source(component.provenance)}`);
    for (const child of component.children) {
        appendComponentTree(lines, child, source, `${indent}  `);
    }
}
function formatRenderedFact(fact) {
    if (fact.kind === "heading")
        return `heading=${formatValue(fact.level)}`;
    if (fact.kind === "unknown")
        return `unknown=${fact.unknown.reason}`;
    return `${fact.kind}=${formatValue(fact.value)}`;
}
function formatValue(value) {
    if (value.state === "unknown")
        return `unknown(${value.reason})`;
    return String(value.value);
}
function collectGraphUnknowns(graph) {
    const unknowns = [];
    const add = (context, unknown) => {
        unknowns.push({ context, unknown });
    };
    if (graph.boundary.completeness.state === "incomplete") {
        graph.boundary.completeness.unknowns.forEach((entry) => add("boundary", entry));
    }
    graph.components.forEach((component) => {
        if (component.semanticOutput.state === "unknown") {
            add(`component ${component.name}`, component.semanticOutput);
        }
    });
    graph.renderNodes.forEach((node) => {
        if (node.kind === "unknown-render")
            add("render", node.unknown);
        if (node.kind !== "native-element")
            return;
        node.attributes.forEach((attribute) => {
            if (attribute.value.state === "unknown") {
                add(`attribute ${attribute.name}`, attribute.value);
            }
        });
        node.semantics.forEach((fact) => {
            if (fact.kind === "unknown")
                add("semantic", fact.unknown);
            else if (fact.kind === "heading" && fact.level.state === "unknown") {
                add("semantic heading", fact.level);
            }
            else if (fact.kind !== "heading" && fact.value.state === "unknown") {
                add(`semantic ${fact.kind}`, fact.value);
            }
        });
    });
    graph.imports.forEach((edge) => {
        if (edge.target.state === "unknown")
            add(`import ${edge.specifier}`, edge.target);
    });
    graph.composition.forEach((edge) => {
        if (edge.to.state === "unknown")
            add(`composition ${edge.relation}`, edge.to);
        if (edge.order.state === "unknown")
            add("composition order", edge.order);
        if (edge.condition.kind === "unknown")
            add("composition condition", edge.condition.unknown);
        if (edge.condition.kind === "branch" &&
            edge.condition.expression.state === "unknown") {
            add("branch expression", edge.condition.expression);
        }
        if (edge.traversal.state === "boundary") {
            add(`traversal ${edge.traversal.reason}`, edge.traversal.unknown);
        }
    });
    graph.pageRoots.forEach((root) => collectPageRootUnknowns(root, add));
    return unknowns;
}
function collectPageRootUnknowns(root, add) {
    if (root.route.state === "unknown")
        add("page route", root.route);
    if (root.rootComponent.state === "unknown")
        add("page root", root.rootComponent);
    root.renderRoots.forEach((renderRoot) => {
        if (renderRoot.state === "unknown")
            add("page render root", renderRoot);
    });
}
function collectPageUnknowns(model, page) {
    var _a;
    const unknowns = [];
    model.unknowns.forEach((entry) => unknowns.push({ context: "model", unknown: entry }));
    page.unknowns.forEach((entry) => unknowns.push({ context: "page", unknown: entry }));
    (_a = page.gaps) === null || _a === void 0 ? void 0 : _a.forEach((gap) => unknowns.push({ context: "composition gap", unknown: gap.unknown }));
    if (page.route.state === "unknown")
        unknowns.push({ context: "route", unknown: page.route });
    if (page.rootComponent.state === "unknown") {
        unknowns.push({ context: "root component", unknown: page.rootComponent });
    }
    if (page.componentTree)
        collectTreeUnknowns(page.componentTree, unknowns);
    return deduplicateUnknowns(unknowns);
}
function collectTreeUnknowns(component, unknowns) {
    component.unknowns.forEach((entry) => unknowns.push({ context: `component ${component.name}`, unknown: entry }));
    component.children.forEach((child) => collectTreeUnknowns(child, unknowns));
}
function deduplicateUnknowns(unknowns) {
    const seen = new Set();
    return unknowns.filter(({ context, unknown }) => {
        var _a, _b, _c, _d, _e, _f;
        const key = [
            context,
            unknown.reason,
            (_a = unknown.message) !== null && _a !== void 0 ? _a : "",
            "fileId" in unknown.provenance ? (_b = unknown.provenance.fileId) !== null && _b !== void 0 ? _b : "" : "",
            (_d = (_c = unknown.provenance.range) === null || _c === void 0 ? void 0 : _c.start.line) !== null && _d !== void 0 ? _d : "",
            (_f = (_e = unknown.provenance.range) === null || _e === void 0 ? void 0 : _e.start.column) !== null && _f !== void 0 ? _f : "",
        ].join("\u0000");
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function compareUnknowns(source) {
    return (left, right) => stableCompare(`${left.context}\u0000${left.unknown.reason}\u0000${source(left.unknown.provenance)}`, `${right.context}\u0000${right.unknown.reason}\u0000${source(right.unknown.provenance)}`);
}
function createSourceResolver(graph) {
    const sourcePaths = new Map(graph.files.map((file) => [file.id, displayPath(file.path, graph)]));
    return (provenance) => {
        var _a, _b;
        const fileId = "fileId" in provenance ? provenance.fileId : undefined;
        const base = fileId ? (_a = sourcePaths.get(fileId)) !== null && _a !== void 0 ? _a : "analysis" : "analysis";
        const start = (_b = provenance.range) === null || _b === void 0 ? void 0 : _b.start;
        return start ? `${base}:${start.line + 1}:${start.column + 1}` : base;
    };
}
function displayPath(filePath, graph) {
    const absolute = path_1.default.resolve(filePath);
    const relative = path_1.default.relative(path_1.default.resolve(graph.boundary.rootDirectory), absolute);
    if (relative && relative !== ".." && !relative.startsWith(`..${path_1.default.sep}`)) {
        return normalizePath(relative);
    }
    return normalizePath(absolute);
}
function normalizePath(value) {
    return value.replace(/\\/g, "/");
}
function stableCompare(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
