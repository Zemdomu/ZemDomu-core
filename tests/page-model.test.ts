import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  createReactFileRouteAdapter,
  ProjectLinter,
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

describe("semantic page model", () => {
  it("composes a configured nested React layout with ordered source facts", async () => {
    const root = fixtureRoot("zemdomu-page-react-");
    const app = write(
      root,
      "src/AppLayout.tsx",
      [
        "import ProductLayout from './ProductLayout';",
        "export default function AppLayout(){",
        "  return <div><header id=\"site-header\"><h1>Brand</h1></header><ProductLayout /></div>;",
        "}",
      ].join("\n")
    );
    write(
      root,
      "src/ProductLayout.tsx",
      "import ProductPage from './ProductPage'; export default function ProductLayout(){ return <main><ProductPage /></main>; }"
    );
    write(
      root,
      "src/ProductPage.tsx",
      "export default function ProductPage(){ return <section id=\"product\"><h2>Product</h2><nav id=\"product-nav\"><a href=\"/\">Home</a></nav></section>; }"
    );

    const model = await new ProjectLinter({
      rootDir: root,
      pages: [{ route: "/products/[id]", entryFile: "src/AppLayout.tsx" }],
    }).buildPageModel([app]);

    assert.strictEqual(model.pages.length, 1);
    const page = model.pages[0];
    assert.deepStrictEqual(page.route, { state: "known", value: "/products/[id]" });
    assert.strictEqual(page.discovery, "configured");
    assert.strictEqual(page.confidence, "certain");
    assert.strictEqual(page.componentTree?.name, "AppLayout");
    assert.strictEqual(page.componentTree?.children[0]?.name, "ProductLayout");
    assert.strictEqual(
      page.componentTree?.children[0]?.children[0]?.name,
      "ProductPage"
    );
    assert.deepStrictEqual(
      page.facts.filter((fact) => fact.kind === "heading").map((fact) => fact.value),
      [1, 2]
    );
    assert.ok(page.facts.some((fact) => fact.kind === "landmark" && fact.value === "banner"));
    assert.ok(page.facts.some((fact) => fact.kind === "landmark" && fact.value === "main"));
    assert.ok(page.facts.some((fact) => fact.kind === "section"));
    assert.ok(page.facts.some((fact) => fact.kind === "navigation"));
    assert.deepStrictEqual(
      page.facts.filter((fact) => fact.kind === "document-id").map((fact) => fact.value),
      ["site-header", "product", "product-nav"]
    );
    assert.deepStrictEqual(page.facts.map((fact) => fact.order), page.facts.map((_, index) => index));
    assert.ok(page.facts.every((fact) => fact.provenance.fileId));
    assert.ok(page.facts.some((fact) => fact.componentPath.length === 3));
  });

  it("composes a configured nested Vue layout with component provenance", async () => {
    const root = fixtureRoot("zemdomu-page-vue-");
    const app = write(
      root,
      "src/AppLayout.vue",
      [
        "<script setup>import ProductLayout from './ProductLayout.vue'</script>",
        "<template><header><h1>Brand</h1></header><ProductLayout /></template>",
      ].join("\n")
    );
    write(
      root,
      "src/ProductLayout.vue",
      "<script setup>import ProductPage from './ProductPage.vue'</script><template><main><ProductPage /></main></template>"
    );
    write(
      root,
      "src/ProductPage.vue",
      "<template><section id=\"product\"><h2>Product</h2><nav><a href=\"/\">Home</a></nav></section></template>"
    );

    const page = (
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/products/:id", entryFile: "src/AppLayout.vue" }],
      }).buildPageModel([app])
    ).pages[0];

    assert.strictEqual(page.componentTree?.name, "AppLayout");
    assert.strictEqual(page.componentTree?.children[0]?.name, "ProductLayout");
    assert.strictEqual(page.componentTree?.children[0]?.children[0]?.name, "ProductPage");
    assert.deepStrictEqual(
      page.facts.filter((fact) => fact.kind === "heading").map((fact) => fact.value),
      [1, 2]
    );
    assert.ok(page.facts.every((fact) => fact.provenance.framework === "vue"));
  });

  it("discovers opt-in filesystem routes and keeps unsupported routing unknown", async () => {
    const root = fixtureRoot("zemdomu-page-routes-");
    const about = write(
      root,
      "src/pages/about.tsx",
      "export default function About(){ return <main><h1>About</h1></main>; }"
    );
    const discovered = await new ProjectLinter({
      rootDir: root,
      routeAdapters: [createReactFileRouteAdapter({ directory: "src/pages" })],
    }).buildPageModel([about]);
    assert.deepStrictEqual(discovered.pages[0].route, {
      state: "known",
      value: "/about",
    });
    assert.strictEqual(discovered.pages[0].discovery, "react-filesystem");
    assert.strictEqual(discovered.pages[0].confidence, "inferred");

    const unsupported = await new ProjectLinter({ rootDir: root }).buildPageModel([
      about,
    ]);
    assert.strictEqual(unsupported.pages[0].route.state, "unknown");
    assert.strictEqual(unsupported.pages[0].confidence, "unknown");
    assert.ok(
      unsupported.pages[0].unknowns.some(
        (entry) => entry.reason === "missing-page-root"
      )
    );

    const missingConfigured = await new ProjectLinter({
      rootDir: root,
      pages: [{ route: "/missing", entryFile: "src/Missing.tsx" }],
    }).buildPageModel([about]);
    assert.deepStrictEqual(missingConfigured.pages[0].route, {
      state: "known",
      value: "/missing",
    });
    assert.strictEqual(missingConfigured.pages[0].rootComponent.state, "unknown");
    assert.ok(missingConfigured.pages[0].unknowns.length > 0);
  });

  it("retains conditional branch identity on page facts", async () => {
    const root = fixtureRoot("zemdomu-page-conditions-");
    const pageFile = write(
      root,
      "Page.tsx",
      "export default function Page({ show }: { show: boolean }){ return <main>{show ? <h1>Primary</h1> : <h2>Secondary</h2>}</main>; }"
    );
    const page = (
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/", entryFile: "Page.tsx" }],
      }).buildPageModel([pageFile])
    ).pages[0];
    const headings = page.facts.filter((fact) => fact.kind === "heading");
    assert.strictEqual(headings.length, 2);
    assert.ok(headings.every((fact) => fact.condition.kind === "branch"));
    assert.deepStrictEqual(
      headings.map((fact) =>
        fact.condition.kind === "branch" ? fact.condition.branchId : undefined
      ),
      ["then", "else"]
    );
  });

  it("does not compose facts beyond an explicit traversal boundary", async () => {
    const root = fixtureRoot("zemdomu-page-depth-boundary-");
    const pageFile = write(
      root,
      "Page.tsx",
      "import Child from './Child'; export default function Page(){ return <main><Child /></main>; }"
    );
    const childFile = write(
      root,
      "Child.tsx",
      "export default function Child(){ return <h1>Beyond boundary</h1>; }"
    );
    const page = (
      await new ProjectLinter({
        rootDir: root,
        crossComponentDepth: 0,
        pages: [{ route: "/depth", entryFile: "Page.tsx" }],
      }).buildPageModel([pageFile, childFile])
    ).pages[0];

    assert.ok(page.unknowns.some((unknown) => unknown.reason === "depth-limit"));
    assert.ok(!page.facts.some((fact) => fact.kind === "heading"));
  });
});
