import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter, type ZemDomuDiagnostic } from "../src";

function fixtureRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, content: string): string {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

const PAGE_RULES = new Set([
  "singleH1",
  "requirePageH1",
  "requireSingleMain",
  "enforceHeadingOrder",
  "requireSectionHeading",
  "uniqueIds",
]);

function pageRules(diagnostics: readonly ZemDomuDiagnostic[]) {
  return diagnostics.filter((diagnostic) => PAGE_RULES.has(diagnostic.rule));
}

describe("composed page rules", () => {
  it("reports React conflicts with page, component-instance, and related source context", async () => {
    const root = fixtureRoot("zemdomu-page-rules-react-");
    const layout = write(
      root,
      "src/Layout.tsx",
      [
        "import Page from './Page';",
        "export default function Layout(){",
        "  return <div id=\"duplicate\"><h1>Layout title</h1><main><Page /></main></div>;",
        "}",
      ].join("\n")
    );
    const pageFile = write(
      root,
      "src/Page.tsx",
      "export default function Page(){ return <section id=\"duplicate\"><h1>Page title</h1><h3>Details</h3></section>; }"
    );

    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/products", entryFile: "src/Layout.tsx" }],
      }).lintPageDiagnostics([layout])
    );

    for (const rule of ["singleH1", "enforceHeadingOrder", "uniqueIds"]) {
      const diagnostic = diagnostics.find((entry) => entry.rule === rule);
      assert.ok(diagnostic, `expected ${rule}`);
      assert.strictEqual(diagnostic.page, "/products");
      assert.strictEqual(diagnostic.source.file, pageFile);
      assert.deepStrictEqual(diagnostic.componentPath, ["Layout", "Page"]);
    }
    assert.ok(
      diagnostics.find((entry) => entry.rule === "singleH1")?.relatedLocations?.some(
        (location) => location.source.file === layout
      )
    );
    assert.ok(!diagnostics.some((entry) => entry.rule === "requireSingleMain"));
  });

  it("reports complete-page missing main and opt-in missing H1 without changing singleH1", async () => {
    const root = fixtureRoot("zemdomu-page-rules-missing-");
    const page = write(
      root,
      "Page.tsx",
      "export default function Page(){ return <div><h2>Details</h2></div>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/missing", entryFile: "Page.tsx" }],
        rules: { requirePageH1: "warning" },
      }).lintPageDiagnostics([page])
    );

    assert.ok(diagnostics.some((entry) => entry.rule === "requireSingleMain"));
    assert.ok(diagnostics.some((entry) => entry.rule === "requirePageH1"));
    assert.ok(!diagnostics.some((entry) => entry.rule === "singleH1"));

    const defaultDiagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/missing", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    assert.ok(!defaultDiagnostics.some((entry) => entry.rule === "requirePageH1"));
  });

  it("accepts a React heading supplied by a resolved section child", async () => {
    const root = fixtureRoot("zemdomu-page-rules-section-");
    const page = write(
      root,
      "Page.tsx",
      "import Heading from './Heading'; export default function Page(){ return <main><h1>Page</h1><section><Heading /></section></main>; }"
    );
    write(
      root,
      "Heading.tsx",
      "export default function Heading(){ return <h2>Section</h2>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/section", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    assert.deepStrictEqual(diagnostics, []);
  });

  it("does not let a later sibling component satisfy an earlier section", async () => {
    const root = fixtureRoot("zemdomu-page-rules-section-sibling-");
    const page = write(
      root,
      "Page.tsx",
      "import Content from './Content'; import Heading from './Heading'; export default function Page(){ return <main><h1>Page</h1><section><Content /></section><Heading /></main>; }"
    );
    write(root, "Content.tsx", "export default function Content(){ return <p>Body</p>; }");
    write(root, "Heading.tsx", "export default function Heading(){ return <h2>Later sibling</h2>; }");
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/section-sibling", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    assert.ok(diagnostics.some((entry) => entry.rule === "requireSectionHeading"));
  });

  it("does not let a nested section heading satisfy its parent section", async () => {
    const root = fixtureRoot("zemdomu-page-rules-nested-section-");
    const page = write(
      root,
      "Page.tsx",
      "import Nested from './Nested'; export default function Page(){ return <main><h1>Page</h1><section><Nested /></section></main>; }"
    );
    write(
      root,
      "Nested.tsx",
      "export default function Nested(){ return <section><h2>Nested only</h2></section>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/nested-section", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    const sectionFindings = diagnostics.filter(
      (entry) => entry.rule === "requireSectionHeading"
    );
    assert.strictEqual(sectionFindings.length, 1);
    assert.strictEqual(sectionFindings[0].source.file, page);
  });

  it("resets heading order across unresolved composition gaps", async () => {
    const root = fixtureRoot("zemdomu-page-rules-heading-gap-");
    const page = write(
      root,
      "Page.tsx",
      "export default function Page(){ return <main><h1>Page</h1><RuntimeContent /><h3>After runtime content</h3></main>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/heading-gap", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    assert.ok(!diagnostics.some((entry) => entry.rule === "enforceHeadingOrder"));
  });

  it("reports equivalent unconditional Vue page conflicts", async () => {
    const root = fixtureRoot("zemdomu-page-rules-vue-");
    const layout = write(
      root,
      "Layout.vue",
      "<script setup>import Page from './Page.vue'</script><template><main id=\"same\"><h1>Layout</h1><Page /></main></template>"
    );
    const page = write(
      root,
      "Page.vue",
      "<template><main id=\"same\"><h1>Page</h1><h3>Details</h3></main></template>"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/vue", entryFile: "Layout.vue" }],
      }).lintPageDiagnostics([layout])
    );
    for (const rule of [
      "singleH1",
      "requireSingleMain",
      "enforceHeadingOrder",
      "uniqueIds",
    ]) {
      const diagnostic = diagnostics.find((entry) => entry.rule === rule);
      assert.ok(diagnostic, `expected ${rule}`);
      assert.strictEqual(diagnostic.page, "/vue");
      assert.strictEqual(diagnostic.source.file, page);
    }
  });

  it("suppresses React conditional and unresolved composition ambiguity", async () => {
    const root = fixtureRoot("zemdomu-page-rules-react-ambiguous-");
    const conditional = write(
      root,
      "Conditional.tsx",
      "import A from './A'; import B from './B'; export default function Conditional({show}:{show:boolean}){ return show ? <A /> : <B />; }"
    );
    write(root, "A.tsx", "export default function A(){ return <main id=\"same\"><h1>A</h1></main>; }");
    write(root, "B.tsx", "export default function B(){ return <main id=\"same\"><h1>B</h1></main>; }");
    const unresolved = write(
      root,
      "Unresolved.tsx",
      "export default function Unresolved(){ return <RuntimePage />; }"
    );

    const conditionalDiagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/conditional", entryFile: "Conditional.tsx" }],
        rules: { requirePageH1: "warning" },
      }).lintPageDiagnostics([conditional])
    );
    assert.deepStrictEqual(conditionalDiagnostics, []);

    const unresolvedDiagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/runtime", entryFile: "Unresolved.tsx" }],
        rules: { requirePageH1: "warning" },
      }).lintPageDiagnostics([unresolved])
    );
    assert.deepStrictEqual(unresolvedDiagnostics, []);
  });

  it("preserves valid file findings when unresolved page composition cannot adjudicate them", async () => {
    const root = fixtureRoot("zemdomu-page-rules-unresolved-local-");
    const page = write(
      root,
      "Page.tsx",
      "export default function Page(){ return <main><h1>Page</h1><section></section><RuntimeContent /></main>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/unresolved-local", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    assert.ok(
      diagnostics.some((entry) => entry.rule === "requireSectionHeading"),
      "the unresolved page pass must not erase the source-backed section finding"
    );
  });

  it("retains a shared legacy finding when another configured occurrence is incomplete", async () => {
    const root = fixtureRoot("zemdomu-page-rules-shared-incomplete-");
    const pageA = write(
      root,
      "PageA.tsx",
      "import Shared from './Shared'; export default function PageA(){ return <main><h1>A</h1><Shared /></main>; }"
    );
    const pageB = write(
      root,
      "PageB.tsx",
      "import Shared from './Shared'; export default function PageB(){ return <main><h1>B</h1><Shared /><RuntimeContent /></main>; }"
    );
    const shared = write(
      root,
      "Shared.tsx",
      "export default function Shared(){ return <section><p>Missing heading</p></section>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [
          { route: "/a", entryFile: "PageA.tsx" },
          { route: "/b", entryFile: "PageB.tsx" },
        ],
      }).lintPageDiagnostics([pageA, pageB, shared])
    ).filter((entry) => entry.rule === "requireSectionHeading" && entry.source.file === shared);

    assert.ok(diagnostics.some((entry) => entry.page === "/a"));
    assert.ok(
      diagnostics.some((entry) => entry.page === undefined),
      "the incomplete /b occurrence must retain the unscoped source finding"
    );
  });

  it("does not advertise a source edit for repeated-instance conflicts", async () => {
    const root = fixtureRoot("zemdomu-page-rules-repeated-instance-");
    const page = write(
      root,
      "Page.tsx",
      "import Shared from './Shared'; export default function Page(){ return <div><Shared /><Shared /></div>; }"
    );
    write(
      root,
      "Shared.tsx",
      "export default function Shared(){ return <main id=\"shared\"><h1>Shared</h1></main>; }"
    );
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/repeated", entryFile: "Page.tsx" }],
      }).lintPageDiagnostics([page])
    );
    for (const rule of ["singleH1", "requireSingleMain", "uniqueIds"]) {
      const diagnostic = diagnostics.find((entry) => entry.rule === rule);
      assert.ok(diagnostic, `expected ${rule}`);
      assert.strictEqual(diagnostic.preferredEditLocation, undefined);
      assert.strictEqual(diagnostic.suggestion, undefined);
      assert.ok(
        (diagnostic.relatedLocations ?? []).filter(
          (location) => location.source.file === page && location.message?.includes("usage")
        ).length >= 2,
        `${rule} should relate both component usages`
      );
    }
  });

  it("suppresses mutually exclusive Vue component branches", async () => {
    const root = fixtureRoot("zemdomu-page-rules-vue-conditional-");
    const page = write(
      root,
      "Page.vue",
      "<script setup>import A from './A.vue'; import B from './B.vue'</script><template><A v-if=\"show\"/><B v-else/></template>"
    );
    write(root, "A.vue", "<template><main id=\"same\"><h1>A</h1></main></template>");
    write(root, "B.vue", "<template><main id=\"same\"><h1>B</h1></main></template>");
    const diagnostics = pageRules(
      await new ProjectLinter({
        rootDir: root,
        pages: [{ route: "/conditional-vue", entryFile: "Page.vue" }],
        rules: { requirePageH1: "warning" },
      }).lintPageDiagnostics([page])
    );
    assert.deepStrictEqual(diagnostics, []);
  });
});
