/**
 * Framework-neutral semantic graph contract.
 *
 * This model intentionally sits beside the current ComponentAnalyzer. Adapters
 * can translate the analyzer's shipped React/Vue knowledge into this normalized
 * form without changing existing lint traversal or diagnostics.
 */

export const SEMANTIC_GRAPH_SCHEMA_VERSION = "1.0" as const;

export type SemanticGraphSchemaVersion = typeof SEMANTIC_GRAPH_SCHEMA_VERSION;
export type SemanticFileId = string;
export type SemanticComponentId = string;
export type SemanticRenderNodeId = string;
export type SemanticImportId = string;
export type SemanticCompositionId = string;
export type SemanticPageRootId = string;
export type SemanticGraphEntityId =
  | SemanticFileId
  | SemanticComponentId
  | SemanticRenderNodeId
  | SemanticImportId
  | SemanticCompositionId
  | SemanticPageRootId;

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

export type SemanticSourceProvenance = SemanticProvenanceFields &
  (
    | {
        kind: "source" | "derived" | "inferred" | "analysis";
        fileId: SemanticFileId;
        range?: SemanticSourceRange;
      }
    | {
        kind: "derived" | "inferred" | "analysis";
        /** Analysis-level evidence has neither a fabricated file nor range. */
        fileId?: never;
        range?: never;
      }
  );

export type SemanticUnknownReason =
  | "unresolved-import"
  | "external-import"
  | "dynamic-import"
  | "parse-error"
  | "conditional-render"
  | "fragment-boundary"
  | "cycle"
  | "depth-limit"
  | "dynamic-value"
  | "unsupported-syntax"
  | "slot-or-children"
  | "runtime-composition"
  | "missing-page-root"
  | "other";

/** An explicit absence of knowledge; never encode unknown as null or false. */
export interface SemanticUnknown {
  state: "unknown";
  reason: SemanticUnknownReason;
  message?: string;
  provenance: SemanticSourceProvenance;
  relatedEntityIds?: readonly SemanticGraphEntityId[];
}

export type SemanticValue<T> =
  | { state: "known"; value: T }
  | SemanticUnknown;

export type SemanticReference<TId extends string> =
  | { state: "resolved"; id: TId }
  | SemanticUnknown;

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

export type SemanticRenderedFact =
  | {
      kind: "role";
      value: SemanticValue<string>;
      origin: "explicit" | "implicit" | "inferred";
      provenance: SemanticSourceProvenance;
    }
  | {
      kind: "landmark";
      value: SemanticValue<string>;
      provenance: SemanticSourceProvenance;
    }
  | {
      kind: "heading";
      level: SemanticValue<number>;
      provenance: SemanticSourceProvenance;
    }
  | {
      kind: "document-id";
      value: SemanticValue<string>;
      provenance: SemanticSourceProvenance;
    }
  | {
      kind: "accessible-name";
      value: SemanticValue<string>;
      provenance: SemanticSourceProvenance;
    }
  | {
      kind: "text";
      value: SemanticValue<string>;
      provenance: SemanticSourceProvenance;
    }
  | {
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

export type SemanticComponentOutput =
  | SemanticComponentSemanticOutput
  | SemanticUnknown;

export interface SemanticNativeElementNode {
  kind: "native-element";
  id: SemanticRenderNodeId;
  fileId: SemanticFileId;
  tagName: string;
  namespace: "html" | "svg" | "mathml" | "unknown";
  attributes: readonly SemanticAttribute[];
  semantics: readonly SemanticRenderedFact[];
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
  fragmentKind:
    | "jsx-fragment"
    | "vue-template"
    | "multiple-roots"
    | "conditional-branch"
    | "slot"
    | "unknown";
  provenance: SemanticSourceProvenance;
}

export interface SemanticUnknownRenderNode {
  kind: "unknown-render";
  id: SemanticRenderNodeId;
  fileId?: SemanticFileId;
  unknown: SemanticUnknown;
  provenance: SemanticSourceProvenance;
}

export type SemanticRenderNode =
  | SemanticNativeElementNode
  | SemanticFragmentNode
  | SemanticUnknownRenderNode;

export type SemanticImportKind =
  | "default"
  | "named"
  | "namespace"
  | "side-effect"
  | "dynamic"
  | "commonjs";

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

export type SemanticCompositionEndpointId =
  | SemanticComponentId
  | SemanticRenderNodeId;
export type SemanticCompositionTargetId = SemanticCompositionEndpointId;

export type SemanticRenderCondition =
  | { kind: "always" }
  | {
      kind: "branch";
      groupId: string;
      branchId: string;
      mutuallyExclusive: boolean;
      expression: SemanticValue<string>;
    }
  | {
      kind: "unknown";
      unknown: SemanticUnknown;
    };

export type SemanticTraversalState =
  | { state: "complete" }
  | {
      state: "boundary";
      reason: "cycle";
      cycle: readonly SemanticCompositionEndpointId[];
      unknown: SemanticUnknown;
    }
  | {
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
  relation:
    | "renders"
    | "uses-component"
    | "projects-children"
    | "fills-slot"
    | "portal"
    | "unknown";
  /** Stable sibling order when known. */
  order: SemanticValue<number>;
  cardinality: "one" | "optional" | "many" | "unknown";
  condition: SemanticRenderCondition;
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
  completeness:
    | { state: "complete" }
    | { state: "incomplete"; unknowns: readonly SemanticUnknown[] };
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

export type SemanticGraphInvariantCode =
  | "schema-version"
  | "duplicate-id"
  | "duplicate-file-path"
  | "dangling-reference"
  | "ownership-mismatch"
  | "invalid-position"
  | "invalid-range"
  | "invalid-order"
  | "invalid-heading-level"
  | "invalid-depth-boundary"
  | "invalid-cycle-boundary"
  | "invalid-condition"
  | "invalid-inference";

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
export function validateSemanticGraph(
  graph: SemanticGraph
): SemanticGraphInvariantIssue[] {
  const issues: SemanticGraphInvariantIssue[] = [];
  const ids = new Map<string, string>();
  const fileIds = new Set(graph.files.map((file) => file.id));
  const componentIds = new Set(graph.components.map((component) => component.id));
  const renderNodeIds = new Set(graph.renderNodes.map((node) => node.id));
  const compositionEndpointIds = new Set<string>([
    ...componentIds,
    ...renderNodeIds,
  ]);

  if (graph.schemaVersion !== SEMANTIC_GRAPH_SCHEMA_VERSION) {
    issues.push({
      code: "schema-version",
      path: "schemaVersion",
      message: `Expected semantic graph schema ${SEMANTIC_GRAPH_SCHEMA_VERSION}.`,
    });
  }

  const registerId = (id: string, at: string) => {
    const previous = ids.get(id);
    if (previous) {
      issues.push({
        code: "duplicate-id",
        path: at,
        message: `Entity id '${id}' is already used at ${previous}.`,
      });
      return;
    }
    ids.set(id, at);
  };

  graph.files.forEach((file, index) => registerId(file.id, `files[${index}].id`));
  graph.components.forEach((component, index) =>
    registerId(component.id, `components[${index}].id`)
  );
  graph.renderNodes.forEach((node, index) =>
    registerId(node.id, `renderNodes[${index}].id`)
  );
  graph.imports.forEach((edge, index) =>
    registerId(edge.id, `imports[${index}].id`)
  );
  graph.composition.forEach((edge, index) =>
    registerId(edge.id, `composition[${index}].id`)
  );
  graph.pageRoots.forEach((root, index) =>
    registerId(root.id, `pageRoots[${index}].id`)
  );

  const paths = new Map<string, number>();
  graph.files.forEach((file, index) => {
    const previous = paths.get(file.path);
    if (previous !== undefined) {
      issues.push({
        code: "duplicate-file-path",
        path: `files[${index}].path`,
        message: `File path '${file.path}' is already represented by files[${previous}].`,
      });
    } else {
      paths.set(file.path, index);
    }
    file.componentIds.forEach((id, componentIndex) => {
      requireReference(
        componentIds.has(id),
        `files[${index}].componentIds[${componentIndex}]`,
        id,
        issues
      );
      const component = graph.components.find((candidate) => candidate.id === id);
      if (component && component.fileId !== file.id) {
        issues.push({
          code: "ownership-mismatch",
          path: `files[${index}].componentIds[${componentIndex}]`,
          message: `Component '${id}' belongs to '${component.fileId}', not '${file.id}'.`,
        });
      }
    });
  });

  graph.components.forEach((component, index) => {
    requireReference(
      fileIds.has(component.fileId),
      `components[${index}].fileId`,
      component.fileId,
      issues
    );
    component.renderRoots.forEach((root, rootIndex) => {
      if (root.state === "resolved") {
        requireReference(
          compositionEndpointIds.has(root.id),
          `components[${index}].renderRoots[${rootIndex}]`,
          root.id,
          issues
        );
      }
    });
    if (component.semanticOutput.state === "known") {
      const evidence = component.semanticOutput.evidence;
      requireReference(
        renderNodeIds.has(evidence.renderNodeId),
        `components[${index}].semanticOutput.evidence.renderNodeId`,
        evidence.renderNodeId,
        issues
      );
      evidence.componentPath.forEach((id, pathIndex) =>
        requireReference(
          componentIds.has(id),
          `components[${index}].semanticOutput.evidence.componentPath[${pathIndex}]`,
          id,
          issues
        )
      );
      if (
        evidence.componentPath.length === 0 ||
        evidence.componentPath[0] !== component.id
      ) {
        issues.push({
          code: "invalid-inference",
          path: `components[${index}].semanticOutput.evidence.componentPath`,
          message: "Semantic inference evidence must start at the component being inferred.",
        });
      }
      const renderNode = graph.renderNodes.find(
        (candidate) => candidate.id === evidence.renderNodeId
      );
      if (
        renderNode &&
        (renderNode.kind !== "native-element" ||
          renderNode.tagName !== component.semanticOutput.tagName ||
          renderNode.namespace !== component.semanticOutput.namespace)
      ) {
        issues.push({
          code: "invalid-inference",
          path: `components[${index}].semanticOutput`,
          message: "Semantic output must match its native render-node evidence.",
        });
      }
    }
  });

  graph.renderNodes.forEach((node, index) => {
    if (node.fileId) {
      requireReference(
        fileIds.has(node.fileId),
        `renderNodes[${index}].fileId`,
        node.fileId,
        issues
      );
    }
    if (node.kind === "native-element") {
      node.semantics.forEach((fact, factIndex) => {
        if (
          fact.kind === "heading" &&
          fact.level.state === "known" &&
          (!Number.isInteger(fact.level.value) ||
            fact.level.value < 1 ||
            fact.level.value > 6)
        ) {
          issues.push({
            code: "invalid-heading-level",
            path: `renderNodes[${index}].semantics[${factIndex}].level`,
            message: "A known HTML heading level must be an integer from 1 through 6.",
          });
        }
      });
    }
  });

  graph.imports.forEach((edge, index) => {
    requireReference(
      fileIds.has(edge.sourceFileId),
      `imports[${index}].sourceFileId`,
      edge.sourceFileId,
      issues
    );
    if (edge.target.state === "resolved") {
      requireReference(
        fileIds.has(edge.target.id) || componentIds.has(edge.target.id),
        `imports[${index}].target`,
        edge.target.id,
        issues
      );
    }
  });

  graph.composition.forEach((edge, index) => {
    requireReference(
      compositionEndpointIds.has(edge.from),
      `composition[${index}].from`,
      edge.from,
      issues
    );
    if (edge.to.state === "resolved") {
      requireReference(
        compositionEndpointIds.has(edge.to.id),
        `composition[${index}].to`,
        edge.to.id,
        issues
      );
    }
    if (
      edge.order.state === "known" &&
      (!Number.isInteger(edge.order.value) || edge.order.value < 0)
    ) {
      issues.push({
        code: "invalid-order",
        path: `composition[${index}].order`,
        message: "A known composition order must be a non-negative integer.",
      });
    }
    if (edge.condition.kind === "branch") {
      if (!edge.condition.groupId.trim() || !edge.condition.branchId.trim()) {
        issues.push({
          code: "invalid-condition",
          path: `composition[${index}].condition`,
          message: "Conditional composition requires non-empty group and branch ids.",
        });
      }
    }
    if (edge.traversal.state === "boundary") {
      if (edge.traversal.reason === "cycle") {
        if (
          edge.traversal.cycle.length < 2 ||
          edge.traversal.cycle[0] !==
            edge.traversal.cycle[edge.traversal.cycle.length - 1] ||
          edge.traversal.cycle.some((id) => !compositionEndpointIds.has(id)) ||
          edge.traversal.unknown.reason !== "cycle"
        ) {
          issues.push({
            code: "invalid-cycle-boundary",
            path: `composition[${index}].traversal`,
            message: "A cycle boundary requires a closed path of known endpoints and a cycle unknown reason.",
          });
        }
      } else if (
        edge.traversal.depth < 0 ||
        edge.traversal.maxDepth < 0 ||
        edge.traversal.depth <= edge.traversal.maxDepth ||
        edge.traversal.unknown.reason !== "depth-limit"
      ) {
        issues.push({
          code: "invalid-depth-boundary",
          path: `composition[${index}].traversal`,
          message: "A depth boundary must occur beyond its non-negative limit and use the depth-limit unknown reason.",
        });
      }
    }
  });

  graph.pageRoots.forEach((root, index) => {
    if (root.rootComponent.state === "resolved") {
      requireReference(
        componentIds.has(root.rootComponent.id),
        `pageRoots[${index}].rootComponent`,
        root.rootComponent.id,
        issues
      );
    }
    root.renderRoots.forEach((renderRoot, rootIndex) => {
      if (renderRoot.state === "resolved") {
        requireReference(
          compositionEndpointIds.has(renderRoot.id),
          `pageRoots[${index}].renderRoots[${rootIndex}]`,
          renderRoot.id,
          issues
        );
      }
    });
  });

  const provenances = collectProvenances(graph);
  provenances.forEach(({ provenance, path }) => {
    if (provenance.fileId !== undefined) {
      requireReference(
        fileIds.has(provenance.fileId),
        `${path}.fileId`,
        provenance.fileId,
        issues
      );
    }
    validateRange(provenance.range, `${path}.range`, issues);
  });

  return issues;
}

export function assertValidSemanticGraph(graph: SemanticGraph): void {
  const issues = validateSemanticGraph(graph);
  if (issues.length === 0) return;
  throw new Error(
    `Invalid semantic graph:\n${issues
      .map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`)
      .join("\n")}`
  );
}

function requireReference(
  exists: boolean,
  at: string,
  id: string,
  issues: SemanticGraphInvariantIssue[]
): void {
  if (exists) return;
  issues.push({
    code: "dangling-reference",
    path: at,
    message: `Referenced entity '${id}' does not exist in this graph.`,
  });
}

function validateRange(
  range: SemanticSourceRange | undefined,
  at: string,
  issues: SemanticGraphInvariantIssue[]
): void {
  if (!range) return;
  const positions: Array<[SemanticSourcePosition, string]> = [
    [range.start, `${at}.start`],
  ];
  if (range.end) positions.push([range.end, `${at}.end`]);
  for (const [position, path] of positions) {
    if (
      !Number.isInteger(position.line) ||
      position.line < 0 ||
      !Number.isInteger(position.column) ||
      position.column < 0 ||
      (position.offset !== undefined &&
        (!Number.isInteger(position.offset) || position.offset < 0))
    ) {
      issues.push({
        code: "invalid-position",
        path,
        message: "Source positions must use non-negative integer coordinates.",
      });
    }
  }
  if (range.end && comparePositions(range.end, range.start) < 0) {
    issues.push({
      code: "invalid-range",
      path: at,
      message: "Source range end must not precede its start.",
    });
  }
}

function comparePositions(
  left: SemanticSourcePosition,
  right: SemanticSourcePosition
): number {
  if (left.offset !== undefined && right.offset !== undefined) {
    return left.offset - right.offset;
  }
  return left.line === right.line
    ? left.column - right.column
    : left.line - right.line;
}

function collectProvenances(
  graph: SemanticGraph
): Array<{ provenance: SemanticSourceProvenance; path: string }> {
  const result: Array<{ provenance: SemanticSourceProvenance; path: string }> = [];
  const add = (provenance: SemanticSourceProvenance, path: string) => {
    result.push({ provenance, path });
  };
  const addUnknown = (unknown: SemanticUnknown, path: string) => {
    add(unknown.provenance, `${path}.provenance`);
  };
  if (graph.boundary.completeness.state === "incomplete") {
    graph.boundary.completeness.unknowns.forEach((unknown, index) =>
      addUnknown(unknown, `boundary.completeness.unknowns[${index}]`)
    );
  }
  graph.files.forEach((entity, index) => add(entity.provenance, `files[${index}].provenance`));
  graph.components.forEach((entity, index) => {
    add(entity.provenance, `components[${index}].provenance`);
    if (entity.semanticOutput.state === "known") {
      add(entity.semanticOutput.provenance, `components[${index}].semanticOutput.provenance`);
      add(
        entity.semanticOutput.evidence.provenance,
        `components[${index}].semanticOutput.evidence.provenance`
      );
    } else {
      addUnknown(entity.semanticOutput, `components[${index}].semanticOutput`);
    }
    entity.renderRoots.forEach((root, rootIndex) => {
      if (root.state === "unknown") {
        addUnknown(root, `components[${index}].renderRoots[${rootIndex}]`);
      }
    });
  });
  graph.renderNodes.forEach((entity, index) => {
    add(entity.provenance, `renderNodes[${index}].provenance`);
    if (entity.kind === "unknown-render") {
      addUnknown(entity.unknown, `renderNodes[${index}].unknown`);
    }
    if (entity.kind === "native-element") {
      entity.attributes.forEach((attribute, attributeIndex) => {
        add(attribute.provenance, `renderNodes[${index}].attributes[${attributeIndex}].provenance`);
        if (attribute.value.state === "unknown") {
          addUnknown(attribute.value, `renderNodes[${index}].attributes[${attributeIndex}].value`);
        }
      });
      entity.semantics.forEach((fact, factIndex) => {
        add(fact.provenance, `renderNodes[${index}].semantics[${factIndex}].provenance`);
        if (fact.kind === "unknown") {
          addUnknown(fact.unknown, `renderNodes[${index}].semantics[${factIndex}].unknown`);
        } else {
          const value = fact.kind === "heading" ? fact.level : fact.value;
          if (value.state === "unknown") {
            addUnknown(value, `renderNodes[${index}].semantics[${factIndex}].value`);
          }
        }
      });
    }
  });
  graph.imports.forEach((entity, index) => {
    add(entity.provenance, `imports[${index}].provenance`);
    if (entity.target.state === "unknown") {
      addUnknown(entity.target, `imports[${index}].target`);
    }
  });
  graph.composition.forEach((entity, index) => {
    add(entity.provenance, `composition[${index}].provenance`);
    if (entity.to.state === "unknown") {
      addUnknown(entity.to, `composition[${index}].to`);
    }
    if (entity.order.state === "unknown") {
      addUnknown(entity.order, `composition[${index}].order`);
    }
    if (entity.condition.kind === "unknown") {
      addUnknown(entity.condition.unknown, `composition[${index}].condition.unknown`);
    } else if (
      entity.condition.kind === "branch" &&
      entity.condition.expression.state === "unknown"
    ) {
      addUnknown(entity.condition.expression, `composition[${index}].condition.expression`);
    }
    if (entity.traversal.state === "boundary") {
      addUnknown(entity.traversal.unknown, `composition[${index}].traversal.unknown`);
    }
  });
  graph.pageRoots.forEach((entity, index) => {
    add(entity.provenance, `pageRoots[${index}].provenance`);
    if (entity.route.state === "unknown") {
      addUnknown(entity.route, `pageRoots[${index}].route`);
    }
    if (entity.rootComponent.state === "unknown") {
      addUnknown(entity.rootComponent, `pageRoots[${index}].rootComponent`);
    }
    entity.renderRoots.forEach((root, rootIndex) => {
      if (root.state === "unknown") {
        addUnknown(root, `pageRoots[${index}].renderRoots[${rootIndex}]`);
      }
    });
  });
  return result;
}
