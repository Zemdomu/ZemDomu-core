import { promises as fs } from "fs";
import path from "path";
import {
  composeSemanticPageModel,
  createConfiguredRouteAdapter,
  ProjectLinter,
  type SemanticGraph,
  type SemanticPageComponentTree,
  type SemanticPageFact,
  type SemanticPageModel,
  type ZemDomuDiagnostic,
  type ZemDomuSourceLocation,
} from "../src";

export const READONLY_MCP_TOOL_CONTRACTS = [
  {
    name: "get_page_semantics",
    description:
      "Return bounded, source-backed component and semantic facts for one explicitly mapped page.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        route: { type: "string", minLength: 1, maxLength: 256 },
        entryFile: { type: "string", minLength: 1, maxLength: 1024 },
        maxItems: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: ["route", "entryFile"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "find_semantic_issues",
    description:
      "Return bounded canonical ZemDomu diagnostics for one explicitly mapped page.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        route: { type: "string", minLength: 1, maxLength: 256 },
        entryFile: { type: "string", minLength: 1, maxLength: 1024 },
        maxDiagnostics: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: ["route", "entryFile"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
] as const;

export interface ReadonlyPageInput {
  route: string;
  entryFile: string;
  maxItems?: number;
  maxDiagnostics?: number;
}

interface ComponentSummary {
  name: string;
  output: string;
  source: string;
  componentPath: string[];
}

interface FactSummary {
  kind: SemanticPageFact["kind"];
  tagName: string;
  value?: string | number;
  source: string;
  componentPath: string[];
}

export interface PageSemanticsResult {
  contractVersion: "zd-mcp-spike/1";
  graphSchemaVersion: string;
  pageSchemaVersion: string;
  route: string;
  confidence: "certain" | "inferred" | "unknown";
  files: string[];
  components: ComponentSummary[];
  facts: FactSummary[];
  unknowns: Array<{ reason: string; message?: string }>;
  truncated: {
    files: boolean;
    components: boolean;
    facts: boolean;
    unknowns: boolean;
  };
}

export interface SemanticIssuesResult {
  contractVersion: "zd-mcp-spike/1";
  diagnosticSchemaVersion: "1.0";
  route: string;
  diagnostics: ZemDomuDiagnostic[];
  truncated: { diagnostics: boolean };
}

/**
 * Transport-neutral ZD-14 spike. It deliberately uses no MCP SDK, shell,
 * network, cache, or write capability; tests call the candidate handlers
 * directly against Core's public package-root API.
 */
export class ReadonlyMcpAnalysisSpike {
  private constructor(private readonly rootDirectory: string) {}

  static async create(rootDirectory: string): Promise<ReadonlyMcpAnalysisSpike> {
    const canonicalRoot = await fs.realpath(path.resolve(rootDirectory));
    return new ReadonlyMcpAnalysisSpike(canonicalRoot);
  }

  async getPageSemantics(input: ReadonlyPageInput): Promise<PageSemanticsResult> {
    const maxItems = boundedLimit(input.maxItems, 50, "maxItems");
    const { entryFile, graph, model } = await this.analyze(input);
    const page = model.pages.find(
      (candidate) =>
        candidate.route.state === "known" && candidate.route.value === input.route
    );
    if (!page) throw new Error(`Page '${input.route}' was not resolved.`);

    const filePaths = new Map(
      graph.files.map((file) => [file.id, this.workspacePath(file.path)])
    );
    const componentNames = new Map(
      graph.components.map((component) => [component.id, component.name])
    );
    const components: ComponentSummary[] = [];
    if (page.componentTree) {
      collectComponents(page.componentTree, [], components, filePaths);
    }
    const sortedFiles = graph.files
      .map((file) => this.workspacePath(file.path))
      .sort(stableCompare);
    const facts = page.facts.slice(0, maxItems).map((fact) => ({
      kind: fact.kind,
      tagName: fact.tagName,
      ...(fact.value === undefined ? {} : { value: fact.value }),
      source: sourcePath(fact.provenance.fileId, filePaths),
      componentPath: fact.componentPath.map(
        (componentId) => componentNames.get(componentId) ?? componentId
      ),
    }));

    return {
      contractVersion: "zd-mcp-spike/1",
      graphSchemaVersion: graph.schemaVersion,
      pageSchemaVersion: model.schemaVersion,
      route: input.route,
      confidence: page.confidence,
      files: sortedFiles.slice(0, maxItems),
      components: components.slice(0, maxItems),
      facts,
      unknowns: page.unknowns.slice(0, maxItems).map((unknown) => ({
        reason: unknown.reason,
        ...(unknown.message === undefined ? {} : { message: unknown.message }),
      })),
      truncated: {
        files: sortedFiles.length > maxItems,
        components: components.length > maxItems,
        facts: page.facts.length > maxItems,
        unknowns: page.unknowns.length > maxItems,
      },
    };
  }

  async findSemanticIssues(input: ReadonlyPageInput): Promise<SemanticIssuesResult> {
    const maxDiagnostics = boundedLimit(
      input.maxDiagnostics,
      50,
      "maxDiagnostics"
    );
    const { entryFile } = await this.analyze(input);
    const diagnostics = await new ProjectLinter({
      rootDir: this.rootDirectory,
      crossComponentAnalysis: true,
      pages: [{ route: input.route, entryFile }],
    }).lintPageDiagnostics([entryFile]);
    const sortedDiagnostics = [...diagnostics].sort((left, right) =>
      stableCompare(
        [left.source.file, left.source.line, left.source.column, left.code].join("\u0000"),
        [right.source.file, right.source.line, right.source.column, right.code].join("\u0000")
      )
    );
    const bounded = sortedDiagnostics
      .slice(0, maxDiagnostics)
      .map((diagnostic) => this.rebaseDiagnostic(diagnostic));

    return {
      contractVersion: "zd-mcp-spike/1",
      diagnosticSchemaVersion: "1.0",
      route: input.route,
      diagnostics: bounded,
      truncated: { diagnostics: sortedDiagnostics.length > maxDiagnostics },
    };
  }

  private async analyze(input: ReadonlyPageInput): Promise<{
    entryFile: string;
    graph: SemanticGraph;
    model: SemanticPageModel;
  }> {
    validateRoute(input.route);
    const entryFile = await this.resolveEntry(input.entryFile);
    const graph = await new ProjectLinter({
      rootDir: this.rootDirectory,
    }).buildSemanticGraph([entryFile]);
    await this.assertGraphWithinRoot(graph);
    const model = await composeSemanticPageModel(graph, [
      createConfiguredRouteAdapter([{ route: input.route, entryFile }]),
    ]);
    return { entryFile, graph, model };
  }

  private async resolveEntry(entryFile: string): Promise<string> {
    if (!entryFile || path.isAbsolute(entryFile)) {
      throw new TypeError("entryFile must be a non-empty workspace-relative path.");
    }
    const canonical = await fs.realpath(path.resolve(this.rootDirectory, entryFile));
    this.assertWithinRoot(canonical);
    return canonical;
  }

  private async assertGraphWithinRoot(graph: SemanticGraph): Promise<void> {
    for (const file of graph.files) {
      const canonical = await fs.realpath(path.resolve(file.path));
      this.assertWithinRoot(canonical);
    }
  }

  private assertWithinRoot(filePath: string): void {
    const relative = path.relative(this.rootDirectory, filePath);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("Requested analysis escapes the configured workspace root.");
    }
  }

  private workspacePath(filePath: string): string {
    const absolute = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.rootDirectory, filePath);
    this.assertWithinRoot(absolute);
    return path.relative(this.rootDirectory, absolute).replace(/\\/g, "/");
  }

  private rebaseDiagnostic(diagnostic: ZemDomuDiagnostic): ZemDomuDiagnostic {
    return {
      ...diagnostic,
      source: this.rebaseLocation(diagnostic.source),
      ...(diagnostic.relatedLocations === undefined
        ? {}
        : {
            relatedLocations: diagnostic.relatedLocations.map((related) => ({
              ...related,
              source: this.rebaseLocation(related.source),
            })),
          }),
      ...(diagnostic.preferredEditLocation === undefined
        ? {}
        : {
            preferredEditLocation: this.rebaseLocation(
              diagnostic.preferredEditLocation
            ),
          }),
    };
  }

  private rebaseLocation(location: ZemDomuSourceLocation): ZemDomuSourceLocation {
    return { ...location, file: this.workspacePath(location.file) };
  }
}

function collectComponents(
  component: SemanticPageComponentTree,
  ancestors: string[],
  destination: ComponentSummary[],
  filePaths: ReadonlyMap<string, string>
): void {
  const componentPath = [...ancestors, component.name];
  destination.push({
    name: component.name,
    output:
      component.semanticOutput.state === "known"
        ? component.semanticOutput.tagName
        : `unknown:${component.semanticOutput.reason}`,
    source: sourcePath(component.provenance.fileId, filePaths),
    componentPath,
  });
  component.children.forEach((child) =>
    collectComponents(child, componentPath, destination, filePaths)
  );
}

function sourcePath(
  fileId: string | undefined,
  filePaths: ReadonlyMap<string, string>
): string {
  return (fileId && filePaths.get(fileId)) || "analysis";
}

function validateRoute(route: string): void {
  if (!route || route.length > 256 || !route.startsWith("/")) {
    throw new TypeError("route must start with '/' and contain at most 256 characters.");
  }
}

function boundedLimit(
  value: number | undefined,
  defaultValue: number,
  name: string
): number {
  if (value === undefined) return defaultValue;
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new TypeError(`${name} must be an integer from 1 through 200.`);
  }
  return value;
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
