import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  formatZemDomuDiagnosticPretty,
  ProjectLinter,
  type ZemDomuDiagnostic,
} from "../src";

function fixtureRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, content: string): string {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe("page-aware diagnostics", () => {
  it("explains a uniquely composed finding with a full path and edit target", async () => {
    const root = fixtureRoot("zemdomu-context-diagnostic-");
    const app = write(
      root,
      "src/AppLayout.tsx",
      "import ProductLayout from './ProductLayout'; export default function AppLayout(){ return <div><h1>Brand</h1><ProductLayout /></div>; }"
    );
    write(
      root,
      "src/ProductLayout.tsx",
      "import ProductPage from './ProductPage'; export default function ProductLayout(){ return <main><ProductPage /></main>; }"
    );
    const productPage = write(
      root,
      "src/ProductPage.tsx",
      "export default function ProductPage(){ return <section><h1>Product</h1></section>; }"
    );

    const diagnostics = await new ProjectLinter({
      rootDir: root,
      crossComponentAnalysis: true,
      rules: { singleH1: "warning" },
      pages: [{ route: "/products/[id]", entryFile: "src/AppLayout.tsx" }],
    }).lintPageDiagnostics([app]);
    const diagnostic = diagnostics.find(
      (entry) =>
        entry.rule === "singleH1" && path.resolve(entry.source.file) === productPage
    );

    assert.ok(diagnostic);
    assert.strictEqual(diagnostic.page, "/products/[id]");
    assert.deepStrictEqual(diagnostic.componentPath, [
      "AppLayout",
      "ProductLayout",
      "ProductPage",
    ]);
    assert.deepStrictEqual(diagnostic.preferredEditLocation, diagnostic.source);
    assert.match(diagnostic.suggestion?.message ?? "", /one <h1>/);
    assert.strictEqual(diagnostic.provenance?.kind, "cross-component");
    assert.ok(
      diagnostic.relatedLocations?.some((related) =>
        related.message?.includes("ProductLayout")
      )
    );

    const pretty = formatZemDomuDiagnosticPretty(diagnostic);
    assert.match(pretty, /Page: \/products\/\[id\]/);
    assert.match(
      pretty,
      /Component path: AppLayout → ProductLayout → ProductPage/
    );
    assert.match(pretty, /Suggested location:/);
    assert.match(pretty, /Suggestion:/);
  });

  it("omits page, edit, and fix claims when one component maps to multiple pages", async () => {
    const root = fixtureRoot("zemdomu-ambiguous-diagnostic-");
    const shared = write(
      root,
      "src/SharedNav.tsx",
      "export default function SharedNav(){ return <nav></nav>; }"
    );
    const appA = write(
      root,
      "src/AppA.tsx",
      "import SharedNav from './SharedNav'; export default function AppA(){ return <main><SharedNav /></main>; }"
    );
    const appB = write(
      root,
      "src/AppB.tsx",
      "import SharedNav from './SharedNav'; export default function AppB(){ return <main><SharedNav /></main>; }"
    );

    const diagnostics = await new ProjectLinter({
      rootDir: root,
      crossComponentAnalysis: true,
      rules: { requireNavLinks: "warning" },
      pages: [
        { route: "/a", entryFile: "src/AppA.tsx" },
        { route: "/b", entryFile: "src/AppB.tsx" },
      ],
    }).lintPageDiagnostics([appA, appB]);
    const diagnostic = diagnostics.find(
      (entry) =>
        entry.rule === "requireNavLinks" && path.resolve(entry.source.file) === shared
    );

    assert.ok(diagnostic);
    assert.strictEqual(diagnostic.page, undefined);
    assert.strictEqual(diagnostic.componentPath, undefined);
    assert.strictEqual(diagnostic.preferredEditLocation, undefined);
    assert.strictEqual(diagnostic.suggestion, undefined);
  });

  it("renders optional context without requiring it", () => {
    const diagnostic: ZemDomuDiagnostic = {
      schemaVersion: "1.0",
      rule: "requireAltText",
      code: "ZMD004",
      severity: "warning",
      message: "<img> tag missing alt attribute",
      source: { file: "Card.tsx", line: 2, column: 4 },
    };

    assert.strictEqual(
      formatZemDomuDiagnosticPretty(diagnostic),
      "Card.tsx:3:5 ZMD004: <img> tag missing alt attribute"
    );
  });
});
