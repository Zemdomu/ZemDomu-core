import type { SemanticComponentId, SemanticComponentOutput, SemanticCompositionId, SemanticGraph, SemanticPageRootId, SemanticReference, SemanticRenderCondition, SemanticRenderNodeId, SemanticSourceProvenance, SemanticUnknown, SemanticValue } from "./semantic-graph";
export declare const SEMANTIC_PAGE_MODEL_SCHEMA_VERSION: "1.0";
export type SemanticPageModelSchemaVersion = typeof SEMANTIC_PAGE_MODEL_SCHEMA_VERSION;
export type SemanticPageDiscovery = "configured" | "react-filesystem" | "vue-filesystem" | "custom-adapter" | "entry-point-heuristic";
export interface SemanticPageConfiguration {
    route: string;
    entryFile: string;
}
export interface SemanticRouteCandidate {
    route: string;
    rootComponentId: SemanticComponentId;
    discovery: Exclude<SemanticPageDiscovery, "entry-point-heuristic">;
    confidence: "certain" | "inferred";
    provenance: SemanticSourceProvenance;
}
export interface SemanticRouteAdapterContext {
    graph: SemanticGraph;
    rootDirectory: string;
}
export interface SemanticRouteAdapter {
    name: string;
    discover(context: SemanticRouteAdapterContext): readonly SemanticRouteCandidate[] | Promise<readonly SemanticRouteCandidate[]>;
}
export interface FileSystemRouteAdapterOptions {
    directory: string;
    routeFromFile?: (relativeFile: string) => string;
}
export type SemanticPageFactKind = "heading" | "landmark" | "section" | "navigation" | "document-id";
export interface SemanticPageFact {
    kind: SemanticPageFactKind;
    order: number;
    /** Position among facts and explicit composition gaps. */
    sequence?: number;
    tagName: string;
    value?: string | number;
    renderNodeId: SemanticRenderNodeId;
    componentPath: readonly SemanticComponentId[];
    /** Ordered component-usage edges, preserving repeated composition instances. */
    compositionPath?: readonly SemanticCompositionId[];
    sectionAncestorIds?: readonly SemanticRenderNodeId[];
    condition: SemanticRenderCondition;
    provenance: SemanticSourceProvenance;
}
export interface SemanticPageGap {
    sequence: number;
    componentPath: readonly SemanticComponentId[];
    compositionPath?: readonly SemanticCompositionId[];
    unknown: SemanticUnknown;
    provenance: SemanticSourceProvenance;
}
export interface SemanticPageComponentTree {
    componentId: SemanticComponentId;
    name: string;
    semanticOutput: SemanticComponentOutput;
    compositionPath: readonly SemanticCompositionId[];
    provenance: SemanticSourceProvenance;
    children: readonly SemanticPageComponentTree[];
    unknowns: readonly SemanticUnknown[];
}
export interface SemanticPageDocument {
    id: SemanticPageRootId;
    route: SemanticValue<string>;
    discovery: SemanticPageDiscovery;
    confidence: "certain" | "inferred" | "unknown";
    rootComponent: SemanticReference<SemanticComponentId>;
    componentTree?: SemanticPageComponentTree;
    facts: readonly SemanticPageFact[];
    gaps?: readonly SemanticPageGap[];
    unknowns: readonly SemanticUnknown[];
    provenance: SemanticSourceProvenance;
}
export interface SemanticPageModel {
    schemaVersion: SemanticPageModelSchemaVersion;
    graphSchemaVersion: SemanticGraph["schemaVersion"];
    pages: readonly SemanticPageDocument[];
    unknowns: readonly SemanticUnknown[];
}
export declare function createConfiguredRouteAdapter(configurations: readonly SemanticPageConfiguration[]): SemanticRouteAdapter;
export declare function createReactFileRouteAdapter(options: FileSystemRouteAdapterOptions): SemanticRouteAdapter;
export declare function createVueFileRouteAdapter(options: FileSystemRouteAdapterOptions): SemanticRouteAdapter;
export declare function composeSemanticPageModel(graph: SemanticGraph, adapters?: readonly SemanticRouteAdapter[]): Promise<SemanticPageModel>;
