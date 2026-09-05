/**
 * Framework-neutral semantic graph contract.
 *
 * This model intentionally sits beside the current ComponentAnalyzer. Adapters
 * can translate the analyzer's shipped React/Vue knowledge into this normalized
 * form without changing existing lint traversal or diagnostics.
 */
export declare const SEMANTIC_GRAPH_SCHEMA_VERSION: "1.0";
export type SemanticGraphSchemaVersion = typeof SEMANTIC_GRAPH_SCHEMA_VERSION;
export type SemanticFileId = string;
export type SemanticComponentId = string;
export type SemanticRenderNodeId = string;
export type SemanticImportId = string;
export type SemanticCompositionId = string;
export type SemanticPageRootId = string;
export type SemanticGraphEntityId = SemanticFileId | SemanticComponentId | SemanticRenderNodeId | SemanticImportId | SemanticCompositionId | SemanticPageRootId;
export type SemanticFramework = "react" | "vue" | "html" | "unknown";
export type SemanticSourceConfidence = "certain" | "inferred";
export interface SemanticSourcePosition {
    /** Zero-based line. */
    line: number;
    /** Zero-based column. */
    column: number;
    /** Optional zero-based absolute source offset. */
    offset?: number;
}
export interface SemanticSourceRange {
    start: SemanticSourcePosition;
    end?: SemanticSourcePosition;
}
interface SemanticProvenanceFields {
    framework?: SemanticFramework;
    extractor?: string;
    confidence: SemanticSourceConfidence;
    description?: string;
}
export type SemanticSourceProvenance = SemanticProvenanceFields & ({
    kind: "source" | "derived" | "inferred" | "analysis";
    fileId: SemanticFileId;
    range?: SemanticSourceRange;
} | {
    kind: "derived" | "inferred" | "analysis";
    /** Analysis-level evidence has neither a fabricated file nor range. */
    fileId?: never;
    range?: never;
});
export type SemanticUnknownReason = "unresolved-import" | "external-import" | "dynamic-import" | "parse-error" | "conditional-render" | "fragment-boundary" | "cycle" | "depth-limit" | "dynamic-value" | "unsupported-syntax" | "slot-or-children" | "runtime-composition" | "missing-page-root" | "other";
/** An explicit absence of knowledge; never encode unknown as null or false. */
export interface SemanticUnknown {
    state: "unknown";
    reason: SemanticUnknownReason;
    message?: string;
    provenance: SemanticSourceProvenance;
    relatedEntityIds?: readonly SemanticGraphEntityId[];
}
export type SemanticValue<T> = {
    state: "known";
    value: T;
} | SemanticUnknown;
export type SemanticReference<TId extends string> = {
    state: "resolved";
    id: TId;
} | SemanticUnknown;
export interface SemanticFileNode {
    kind: "file";
    id: SemanticFileId;
    path: string;
    language: "html" | "javascript" | "typescript" | "vue" | "unknown";
    framework: SemanticFramework;
    componentIds: readonly SemanticComponentId[];
    provenance: SemanticSourceProvenance;
}
export interface SemanticComponentNode {
    kind: "component";
    id: SemanticComponentId;
    fileId: SemanticFileId;
    name: string;
    exportName?: string;
    renderRoots: readonly SemanticReference<SemanticCompositionTargetId>[];
    semanticOutput: SemanticComponentOutput;
    provenance: SemanticSourceProvenance;
}
export interface SemanticAttribute {
    name: string;
    value: SemanticValue<string | boolean | null>;
    provenance: SemanticSourceProvenance;
}
export type SemanticRenderedFact = {
    kind: "role";
    value: SemanticValue<string>;
    origin: "explicit" | "implicit" | "inferred";
    provenance: SemanticSourceProvenance;
} | {
    kind: "landmark";
    value: SemanticValue<string>;
    provenance: SemanticSourceProvenance;
} | {
    kind: "heading";
    level: SemanticValue<number>;
    provenance: SemanticSourceProvenance;
} | {
    kind: "document-id";
    value: SemanticValue<string>;
    provenance: SemanticSourceProvenance;
} | {
    kind: "accessible-name";
    value: SemanticValue<string>;
    provenance: SemanticSourceProvenance;
} | {
    kind: "text";
    value: SemanticValue<string>;
    provenance: SemanticSourceProvenance;
} | {
    kind: "unknown";
    unknown: SemanticUnknown;
    provenance: SemanticSourceProvenance;
};
/** Source-backed proof used for a conservative component-output inference. */
export interface SemanticInferenceEvidence {
    /** Ordered custom-component path from the inferred component to the native output. */
    componentPath: readonly SemanticComponentId[];
    /** The certain native render node that terminates the inference. */
    renderNodeId: SemanticRenderNodeId;
    provenance: SemanticSourceProvenance;
}
export interface SemanticComponentSemanticOutput {
    state: "known";
    tagName: string;
    namespace: "html" | "svg" | "mathml" | "unknown";
    /** Component output is derived from source facts and is never relabeled as certain. */
    confidence: "inferred";
    evidence: SemanticInferenceEvidence;
    provenance: SemanticSourceProvenance;
}
export type SemanticComponentOutput = SemanticComponentSemanticOutput | SemanticUnknown;
export interface SemanticNativeElementNode {
    kind: "native-element";
    id: SemanticRenderNodeId;
    fileId: SemanticFileId;
    tagName: string;
    namespace: "html" | "svg" | "mathml" | "unknown";
    attributes: readonly SemanticAttribute[];
    semantics: readonly SemanticRenderedFact[];
    /** Source-proven native section ancestors within the owning component. */
    sectionAncestorIds?: readonly SemanticRenderNodeId[];
    provenance: SemanticSourceProvenance;
}
/**
 * A fragment preserves render ownership and order even when no native element
 * exists. Conditional branches and framework fragments therefore remain in the
 * graph instead of being flattened away.
 */
export interface SemanticFragmentNode {
    kind: "fragment";
    id: SemanticRenderNodeId;
    fileId: SemanticFileId;
    fragmentKind: "jsx-fragment" | "vue-template" | "multiple-roots" | "conditional-branch" | "slot" | "unknown";
    provenance: SemanticSourceProvenance;
}
export interface SemanticUnknownRenderNode {
    kind: "unknown-render";
    id: SemanticRenderNodeId;
    fileId?: SemanticFileId;
    unknown: SemanticUnknown;
    provenance: SemanticSourceProvenance;
}
export type SemanticRenderNode = SemanticNativeElementNode | SemanticFragmentNode | SemanticUnknownRenderNode;
export type SemanticImportKind = "default" | "named" | "namespace" | "side-effect" | "dynamic" | "commonjs";
export interface SemanticImportEdge {
    kind: "import";
    id: SemanticImportId;
    sourceFileId: SemanticFileId;
    specifier: string;
    importKind: SemanticImportKind;
    importedName?: string;
    localName?: string;
    target: SemanticReference<SemanticFileId | SemanticComponentId>;
    provenance: SemanticSourceProvenance;
}
export type SemanticCompositionEndpointId = SemanticComponentId | SemanticRenderNodeId;
export type SemanticCompositionTargetId = SemanticCompositionEndpointId;
export type SemanticRenderCondition = {
    kind: "always";
} | {
    kind: "branch";
    groupId: string;
    branchId: string;
    mutuallyExclusive: boolean;
    expression: SemanticValue<string>;
} | {
    kind: "unknown";
    unknown: SemanticUnknown;
};
export type SemanticTraversalState = {
    state: "complete";
} | {
    state: "boundary";
    reason: "cycle";
    cycle: readonly SemanticCompositionEndpointId[];
    unknown: SemanticUnknown;
} | {
    state: "boundary";
    reason: "depth-limit";
    depth: number;
    maxDepth: number;
    unknown: SemanticUnknown;
};
export interface SemanticCompositionEdge {
    kind: "composition";
    id: SemanticCompositionId;
    from: SemanticCompositionEndpointId;
    to: SemanticReference<SemanticCompositionTargetId>;
    relation: "renders" | "uses-component" | "projects-children" | "fills-slot" | "portal" | "unknown";
    /** Stable sibling order when known. */
    order: SemanticValue<number>;
    cardinality: "one" | "optional" | "many" | "unknown";
    condition: SemanticRenderCondition;
    /** Native section ancestors that contain this component usage. */
    sectionAncestorIds?: readonly SemanticRenderNodeId[];
    traversal: SemanticTraversalState;
    provenance: SemanticSourceProvenance;
}
export interface SemanticPageRoot {
    kind: "page-root";
    id: SemanticPageRootId;
    route: SemanticValue<string>;
    rootComponent: SemanticReference<SemanticComponentId>;
    renderRoots: readonly SemanticReference<SemanticCompositionTargetId>[];
    discovery: "explicit" | "framework-adapter" | "entry-point-heuristic" | "unknown";
    provenance: SemanticSourceProvenance;
}
export interface SemanticAnalysisBoundary {
    rootDirectory: string;
    maxDepth?: number;
    completeness: {
        state: "complete";
    } | {
        state: "incomplete";
        unknowns: readonly SemanticUnknown[];
    };
}
export interface SemanticGraph {
    schemaVersion: SemanticGraphSchemaVersion;
    boundary: SemanticAnalysisBoundary;
    files: readonly SemanticFileNode[];
    components: readonly SemanticComponentNode[];
    renderNodes: readonly SemanticRenderNode[];
    imports: readonly SemanticImportEdge[];
    composition: readonly SemanticCompositionEdge[];
    pageRoots: readonly SemanticPageRoot[];
}
export type SemanticGraphInvariantCode = "schema-version" | "duplicate-id" | "duplicate-file-path" | "dangling-reference" | "ownership-mismatch" | "invalid-position" | "invalid-range" | "invalid-order" | "invalid-heading-level" | "invalid-depth-boundary" | "invalid-cycle-boundary" | "invalid-condition" | "invalid-inference";
export interface SemanticGraphInvariantIssue {
    code: SemanticGraphInvariantCode;
    path: string;
    message: string;
}
/**
 * Validates structural invariants only. Cycles and incomplete graphs are valid
 * domain states when they are represented explicitly by traversal boundaries or
 * unknown references.
 */
export declare function validateSemanticGraph(graph: SemanticGraph): SemanticGraphInvariantIssue[];
export declare function assertValidSemanticGraph(graph: SemanticGraph): void;
export {};
