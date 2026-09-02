import { strict as assert } from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  READONLY_MCP_TOOL_CONTRACTS,
  ReadonlyMcpAnalysisSpike,
} from "../spikes/zd-14-readonly-mcp";

function write(root: string, relativePath: string, content: string): string {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("ZD-14 read-only MCP feasibility spike", function () {
  this.timeout(10_000);

  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-mcp-spike-"));
  const root = path.join(parent, "workspace");

  before(() => {
    write(
      root,
      "src/Page.tsx",
      "import Child from './Child'; export default function Page(){ return <main><h1>Product</h1><Child /></main>; }"
    );
    write(
      root,
      "src/Child.tsx",
      "export default function Child(){ return <section><img /></section>; }"
    );
    write(parent, "outside.tsx", "export default function Outside(){ return <main />; }");
  });

  after(() => fs.rmSync(parent, { recursive: true, force: true }));

  it("keeps the candidate surface to two bounded read-only tools", () => {
    assert.deepEqual(
      READONLY_MCP_TOOL_CONTRACTS.map((tool) => tool.name),
      ["get_page_semantics", "find_semantic_issues"]
    );
    assert.ok(
      READONLY_MCP_TOOL_CONTRACTS.every(
        (tool) =>
          tool.annotations.readOnlyHint &&
          !tool.annotations.destructiveHint &&
          !tool.annotations.openWorldHint
      )
    );
  });

  it("returns bounded component and semantic facts without source bodies or absolute paths", async () => {
    const spike = await ReadonlyMcpAnalysisSpike.create(root);
    const result = await spike.getPageSemantics({
      route: "/products/[id]",
      entryFile: "src/Page.tsx",
      maxItems: 1,
    });

    assert.equal(result.contractVersion, "zd-mcp-spike/1");
    assert.deepEqual(result.files, ["src/Child.tsx"]);
    assert.deepEqual(
      result.components.map((component) => component.componentPath),
      [["Page"]]
    );
    assert.equal(result.facts.length, 1);
    assert.equal(result.truncated.files, true);
    assert.equal(result.truncated.components, true);
    assert.equal(result.truncated.facts, true);
    assert.ok(result.facts.every((fact) => !path.isAbsolute(fact.source)));
    assert.ok(!JSON.stringify(result).includes("export default function"));
  });

  it("preserves canonical diagnostics while rebasing every source path to the workspace", async () => {
    const spike = await ReadonlyMcpAnalysisSpike.create(root);
    const result = await spike.findSemanticIssues({
      route: "/products/[id]",
      entryFile: "src/Page.tsx",
      maxDiagnostics: 10,
    });

    assert.equal(result.diagnosticSchemaVersion, "1.0");
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "ZMD004"));
    assert.ok(
      result.diagnostics.every(
        (diagnostic) =>
          !path.isAbsolute(diagnostic.source.file) &&
          diagnostic.relatedLocations?.every(
            (related) => !path.isAbsolute(related.source.file)
          ) !== false
      )
    );
  });

  it("rejects traversal and invalid resource-budget inputs", async () => {
    const spike = await ReadonlyMcpAnalysisSpike.create(root);
    await assert.rejects(
      spike.getPageSemantics({ route: "/escape", entryFile: "../outside.tsx" }),
      /escapes the configured workspace root/
    );
    await assert.rejects(
      spike.getPageSemantics({
        route: "/products",
        entryFile: "src/Page.tsx",
        maxItems: 201,
      }),
      /maxItems must be an integer from 1 through 200/
    );
  });
});
