import path from "path";
import type {
  SemanticComponentId,
  SemanticComponentOutput,
  SemanticFramework,
  SemanticGraph,
  SemanticPageRootId,
  SemanticReference,
  SemanticRenderCondition,
  SemanticRenderNodeId,
  SemanticSourceProvenance,
  SemanticUnknown,
  SemanticValue,
} from "./semantic-graph";

export const SEMANTIC_PAGE_MODEL_SCHEMA_VERSION = "1.0" as const;

export type SemanticPageModelSchemaVersion =
  typeof SEMANTIC_PAGE_MODEL_SCHEMA_VERSION;
export type SemanticPageDiscovery =
  | "configured"
  | "react-filesystem"
  | "vue-filesystem"
  | "custom-adapter"
  | "entry-point-heuristic";

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
  discover(
    context: SemanticRouteAdapterContext
  ): readonly SemanticRouteCandidate[] | Promise<readonly SemanticRouteCandidate[]>;
}

export interface FileSystemRouteAdapterOptions {
  directory: string;
  routeFromFile?: (relativeFile: string) => string;
}

export type SemanticPageFactKind =
  | "heading"
  | "landmark"
  | "section"
  | "navigation"
  | "document-id";

export interface SemanticPageFact {
  kind: SemanticPageFactKind;
  order: number;
  tagName: string;
  value?: string | number;
  renderNodeId: SemanticRenderNodeId;
  componentPath: readonly SemanticComponentId[];
  condition: SemanticRenderCondition;
  provenance: SemanticSourceProvenance;
}

export interface SemanticPageComponentTree {
  componentId: SemanticComponentId;
  name: string;
  semanticOutput: SemanticComponentOutput;
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
  unknowns: readonly SemanticUnknown[];
  provenance: SemanticSourceProvenance;
}

export interface SemanticPageModel {
  schemaVersion: SemanticPageModelSchemaVersion;
  graphSchemaVersion: SemanticGraph["schemaVersion"];
  pages: readonly SemanticPageDocument[];
  unknowns: readonly SemanticUnknown[];
}

export function createConfiguredRouteAdapter(
  configurations: readonly SemanticPageConfiguration[]
): SemanticRouteAdapter {
  return {
    name: "configured-pages",
    discover({ graph, rootDirectory }) {
      return configurations.flatMap<SemanticRouteCandidate>((configuration) => {
        const expected = path.resolve(rootDirectory, configuration.entryFile);
        const file = graph.files.find(
          (candidate) => path.resolve(candidate.path) === expected
        );
        const componentId = file?.componentIds[0];
        if (!file || !componentId) {
          return [{
            route: configuration.route,
            rootComponentId: `component:missing:${encodeURIComponent(configuration.entryFile)}`,
            discovery: "configured" as const,
            confidence: "certain" as const,
            provenance: {
              kind: "analysis" as const,
              extractor: "configured-pages",
              confidence: "certain" as const,
              description: `Configured entry '${configuration.entryFile}' was not present in the semantic graph.`,
            },
          }];
        }
        return [{
          route: configuration.route,
          rootComponentId: componentId,
          discovery: "configured" as const,
          confidence: "certain" as const,
          provenance: {
            kind: "derived" as const,
            fileId: file.id,
            framework: file.framework,
            extractor: "configured-pages",
            confidence: "certain" as const,
            description: `Configured route '${configuration.route}' uses '${configuration.entryFile}'.`,
          },
        }];
      });
    },
  };
}

export function createReactFileRouteAdapter(
  options: FileSystemRouteAdapterOptions
): SemanticRouteAdapter {
  return createFileSystemRouteAdapter("react", "react-filesystem", options);
}

export function createVueFileRouteAdapter(
  options: FileSystemRouteAdapterOptions
): SemanticRouteAdapter {
  return createFileSystemRouteAdapter("vue", "vue-filesystem", options);
}

function createFileSystemRouteAdapter(
  framework: Extract<SemanticFramework, "react" | "vue">,
  discovery: Extract<SemanticPageDiscovery, "react-filesystem" | "vue-filesystem">,
  options: FileSystemRouteAdapterOptions
): SemanticRouteAdapter {
  return {
    name: discovery,
    discover({ graph, rootDirectory }) {
      const directory = path.resolve(rootDirectory, options.directory);
      return graph.files.flatMap((file) => {
        if (file.framework !== framework) return [];
        const relative = path.relative(directory, path.resolve(file.path));
        if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`)) {
          return [];
        }
        const componentId = file.componentIds[0];
        if (!componentId) return [];
        return [{
          route: options.routeFromFile?.(relative) ?? defaultRouteFromFile(relative),
          rootComponentId: componentId,
          discovery,
          confidence: "inferred" as const,
          provenance: {
            kind: "inferred" as const,
            fileId: file.id,
            framework,
            extractor: discovery,
            confidence: "inferred" as const,
            description: `Opt-in filesystem adapter discovered '${relative}'.`,
          },
        }];
      });
    },
  };
}

function defaultRouteFromFile(relativeFile: string): string {
  const normalized = relativeFile.replace(/\\/g, "/").replace(/\.(?:jsx?|tsx?|vue)$/i, "");
  const withoutIndex = normalized.replace(/(?:^|\/)index$/i, "");
  return `/${withoutIndex}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

export async function composeSemanticPageModel(
  graph: SemanticGraph,
  adapters: readonly SemanticRouteAdapter[] = []
): Promise<SemanticPageModel> {
  const candidates = (
    await Promise.all(
      adapters.map((adapter) =>
        adapter.discover({
          graph,
          rootDirectory: graph.boundary.rootDirectory,
        })
      )
    )
  ).flat();
  const pages = candidates.length > 0
    ? candidates.map((candidate) => composeCandidate(graph, candidate))
    : graph.pageRoots.map((root) => composeHeuristicRoot(graph, root));
  const unknowns = pages.length > 0
    ? pages.flatMap((page) => page.unknowns)
    : [analysisUnknown("missing-page-root", "No route adapter or entry-point heuristic produced a page.")];
  return {
    schemaVersion: SEMANTIC_PAGE_MODEL_SCHEMA_VERSION,
    graphSchemaVersion: graph.schemaVersion,
    pages,
    unknowns,
  };
}

function composeCandidate(
  graph: SemanticGraph,
  candidate: SemanticRouteCandidate
): SemanticPageDocument {
  const component = graph.components.find(
    (entry) => entry.id === candidate.rootComponentId
  );
  if (!component) {
    const unknown = analysisUnknown(
      "unsupported-syntax",
      `Route adapter referenced missing component '${candidate.rootComponentId}'.`
    );
    return {
      id: `page:adapter:${encodeURIComponent(candidate.route)}`,
      route: { state: "known", value: candidate.route },
      discovery: candidate.discovery,
      confidence: candidate.confidence,
      rootComponent: unknown,
      facts: [],
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

function composeHeuristicRoot(
  graph: SemanticGraph,
  root: SemanticGraph["pageRoots"][number]
): SemanticPageDocument {
  return composeDocument(graph, {
    id: root.id,
    route: root.route,
    discovery: "entry-point-heuristic",
    confidence: root.route.state === "known" ? "inferred" : "unknown",
    rootComponent: root.rootComponent,
    provenance: root.provenance,
  });
}

function composeDocument(
  graph: SemanticGraph,
  identity: Pick<
    SemanticPageDocument,
    "id" | "route" | "discovery" | "confidence" | "rootComponent" | "provenance"
  >
): SemanticPageDocument {
  const unknowns: SemanticUnknown[] = [];
  const facts: SemanticPageFact[] = [];
  let order = 0;
  const buildTree = (
    componentId: SemanticComponentId,
    componentPath: readonly SemanticComponentId[],
    stack: readonly SemanticComponentId[]
  ): SemanticPageComponentTree | undefined => {
    const component = graph.components.find((entry) => entry.id === componentId);
    if (!component) return undefined;
    if (stack.includes(componentId)) {
      const cycle = analysisUnknown("cycle", `Page composition stopped at '${component.name}' cycle.`);
      unknowns.push(cycle);
      return {
        componentId,
        name: component.name,
        semanticOutput: cycle,
        provenance: component.provenance,
        children: [],
        unknowns: [cycle],
      };
    }
    const nextPath = [...componentPath, componentId];
    const localUnknowns: SemanticUnknown[] = [];
    const children: SemanticPageComponentTree[] = [];
    if (component.semanticOutput.state === "unknown") {
      localUnknowns.push(component.semanticOutput);
      unknowns.push(component.semanticOutput);
    }
    const rootIds = component.renderRoots
      .filter((root): root is { state: "resolved"; id: string } => root.state === "resolved")
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
        continue;
      }
      const targetId = edge.to.id;
      const renderNode = graph.renderNodes.find((node) => node.id === targetId);
      if (renderNode?.kind === "native-element") {
        facts.push(...factsForNode(renderNode, nextPath, edge.condition, order));
        order = facts.length;
        continue;
      }
      const child = graph.components.find((entry) => entry.id === targetId);
      if (child) {
        const childTree = buildTree(child.id, nextPath, [...stack, componentId]);
        if (childTree) children.push(childTree);
      }
      if (edge.traversal.state === "boundary") {
        localUnknowns.push(edge.traversal.unknown);
        unknowns.push(edge.traversal.unknown);
      }
    }
    return {
      componentId,
      name: component.name,
      semanticOutput: component.semanticOutput,
      provenance: component.provenance,
      children,
      unknowns: localUnknowns,
    };
  };

  const componentTree = identity.rootComponent.state === "resolved"
    ? buildTree(identity.rootComponent.id, [], [])
    : undefined;
  if (identity.route.state === "unknown") unknowns.push(identity.route);
  if (identity.rootComponent.state === "unknown") unknowns.push(identity.rootComponent);
  return { ...identity, componentTree, facts, unknowns };
}

function knownOrder(value: SemanticValue<number>): number {
  return value.state === "known" ? value.value : Number.MAX_SAFE_INTEGER;
}

function factsForNode(
  node: Extract<SemanticGraph["renderNodes"][number], { kind: "native-element" }>,
  componentPath: readonly SemanticComponentId[],
  condition: SemanticRenderCondition,
  startOrder: number
): SemanticPageFact[] {
  const facts: Omit<SemanticPageFact, "order">[] = [];
  const base = {
    tagName: node.tagName,
    renderNodeId: node.id,
    componentPath,
    condition,
    provenance: node.provenance,
  };
  const heading = node.semantics.find((fact) => fact.kind === "heading");
  if (heading?.kind === "heading" && heading.level.state === "known") {
    facts.push({ ...base, kind: "heading", value: heading.level.value });
  }
  const landmark = landmarkForTag(node.tagName);
  if (landmark) facts.push({ ...base, kind: "landmark", value: landmark });
  if (node.tagName === "section") facts.push({ ...base, kind: "section" });
  if (node.tagName === "nav") facts.push({ ...base, kind: "navigation" });
  for (const fact of node.semantics) {
    if (fact.kind === "document-id" && fact.value.state === "known") {
      facts.push({ ...base, kind: "document-id", value: fact.value.value });
    }
  }
  return facts.map((fact, index) => ({ ...fact, order: startOrder + index }));
}

function landmarkForTag(tagName: string): string | undefined {
  return ({
    header: "banner",
    nav: "navigation",
    main: "main",
    aside: "complementary",
    footer: "contentinfo",
  } as Record<string, string>)[tagName];
}

function analysisUnknown(
  reason: SemanticUnknown["reason"],
  message: string
): SemanticUnknown {
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
