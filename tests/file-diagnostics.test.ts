import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ProjectLinter,
  type ProjectLinterOptions,
  type Rule,
  type SemanticGraph,
  type ZemDomuDiagnostic,
} from "../src";

class ObservedLinter extends ProjectLinter {
  graphCalls = 0;
  override async buildSemanticGraph(files: string[]): Promise<SemanticGraph> {
    this.graphCalls += 1;
    return super.buildSemanticGraph(files);
  }
}

async function fileDiagnostics(linter: ProjectLinter, files: string[]): Promise<ZemDomuDiagnostic[]> {
  const method = Reflect.get(linter, "lintFileDiagnostics");
  assert.equal(typeof method, "function", "ProjectLinter must expose canonical file-only diagnostics");
  return method.call(linter, files);
}

describe("canonical file-only diagnostics", () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-file-diagnostics-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  function write(name: string, source: string): string {
    const file = path.join(root, name);
    fs.writeFileSync(file, source);
    return file;
  }

  const cases = [
    { extension: "html", entry: '<html lang="en"><head><title>Entry</title></head><body><main><h1>Entry</h1><img></main></body></html>' },
    { extension: "jsx", entry: "import Child from './Child'; export default function Entry(){return <main><h1>Entry</h1><Child /><img /></main>}", child: "export default function Child(){return <section><h1>Child</h1><img /></section>}" },
    { extension: "tsx", entry: "import Child from './Child'; const label: string = 'Entry'; export default function Entry(){return <main><h1>{label}</h1><Child /><img /></main>}", child: "export default function Child(){return <section><h1>Child</h1><img /></section>}" },
    { extension: "vue", entry: '<template><main><h1>Entry</h1><Child /><img /></main></template><script setup>import Child from "./Child.vue";</script>', child: '<template><section><h1>Child</h1><img /></section></template>' },
  ];

  for (const fixture of cases) for (const crossComponentAnalysis of [false, true]) {
    it(`matches complete unconfigured ${fixture.extension} page-path diagnostics with cross-component analysis ${crossComponentAnalysis}`, async () => {
      const entry = write(`Entry.${fixture.extension}`, fixture.entry);
      if (fixture.child) write(`Child.${fixture.extension}`, fixture.child);
      const options: ProjectLinterOptions = { rootDir: root, crossComponentAnalysis, rules: { singleH1: "warning", enforceHeadingOrder: "error", requireSectionHeading: "warning" } };
      const linter = new ObservedLinter(options);
      const actual = await fileDiagnostics(linter, [entry, entry]);
      const expected = await new ProjectLinter(options).lintPageDiagnostics([entry, entry]);
      assert.deepStrictEqual(actual, expected);
      assert.ok(actual.some(diagnostic => diagnostic.rule === "requireAltText"), "invalid image remains reported");
      assert.ok(actual.every(diagnostic => diagnostic.page === undefined && diagnostic.componentPath === undefined && diagnostic.preferredEditLocation === undefined));
      assert.equal(linter.graphCalls, 0, "file diagnostics must not build a second semantic graph");
      if (fixture.child) assert.equal(actual.some(diagnostic => diagnostic.source.file.endsWith(`Child.${fixture.extension}`)), crossComponentAnalysis);
    });
  }

  for (const extension of ["html", "tsx", "vue"]) {
    it(`retains inline disable/enable boundaries in ${extension}`, async () => {
      const fragment = extension === "tsx"
        ? '<main>{/* zemdomu-disable requireAltText */}<img />{/* zemdomu-enable requireAltText */}<img /></main>'
        : '<main><!-- zemdomu-disable requireAltText --><img><!-- zemdomu-enable requireAltText --><img></main>';
      const source = extension === "tsx" ? `export default function Entry(){return ${fragment}}` : extension === "vue" ? `<template>${fragment}</template>` : fragment;
      const entry = write(`Entry.${extension}`, source);
      const options = { rootDir: root, crossComponentAnalysis: true };
      const actual = await fileDiagnostics(new ObservedLinter(options), [entry]);
      assert.deepStrictEqual(actual, await new ProjectLinter(options).lintPageDiagnostics([entry]));
      const findings = actual.filter(diagnostic => diagnostic.rule === "requireAltText");
      assert.equal(findings.length, 1, "only the enabled invalid image is reported");
      assert.equal(findings[0].source.offset, source.lastIndexOf("<img"));
    });
  }

  it("deduplicates identical custom file findings while preserving their canonical details", async () => {
    const entry = write("Entry.html", "<main></main>");
    const finding = { rule: "duplicateFixture", message: "A distinct custom finding", line: 0, column: 2, offset: 2 };
    const rule: Rule = { name: "duplicateFixture", end: () => [{ ...finding }, { ...finding }] };
    const options = { rootDir: root, customRules: [rule] };
    const actual = await fileDiagnostics(new ObservedLinter(options), [entry]);
    assert.deepStrictEqual(actual, await new ProjectLinter(options).lintPageDiagnostics([entry]));
    const findings = actual.filter(diagnostic => diagnostic.rule === "duplicateFixture");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].source.file, entry);
    assert.equal(findings[0].source.offset, 2);
    assert.equal(findings[0].message, finding.message);
    assert.equal(findings[0].severity, "error");
  });

  it("keeps configured page diagnostics on the existing composed-page API", async () => {
    const entry = write("Entry.tsx", "export default function Entry(){return <div><h2>Details</h2></div>}");
    const options: ProjectLinterOptions = { rootDir: root, pages: [{ route: "/configured", entryFile: "Entry.tsx" }], rules: { requirePageH1: "warning" } };
    const linter = new ObservedLinter(options);
    const page = await linter.lintPageDiagnostics([entry]);
    assert.equal(linter.graphCalls, 1);
    assert.ok(page.some(diagnostic => diagnostic.rule === "requirePageH1" && diagnostic.page === "/configured"));
    const files = new ObservedLinter(options);
    const diagnostics = await fileDiagnostics(files, [entry]);
    assert.equal(files.graphCalls, 0);
    assert.ok(diagnostics.every(diagnostic => diagnostic.page === undefined));
    assert.ok(!diagnostics.some(diagnostic => diagnostic.rule === "requirePageH1"));
  });

  it("still invokes custom page rules on unknown heuristic pages in the existing API", async () => {
    const entry = write("Entry.tsx", "export default function Entry(){return <main />}");
    const states: string[] = [];
    const custom: Rule = { name: "unknownPage", analyzePage: ({ page }) => {
      states.push(page.route.state);
      return [{ rule: "unknownPage", message: "Custom heuristic page finding", filePath: entry, line: 0, column: 0 }];
    } };
    const options = { rootDir: root, customRules: [custom] };
    const full = await new ProjectLinter(options).lintPageDiagnostics([entry]);
    assert.deepStrictEqual(states, ["unknown"]);
    assert.ok(full.some(diagnostic => diagnostic.rule === "unknownPage"));
    states.length = 0;
    const files = await fileDiagnostics(new ObservedLinter(options), [entry]);
    assert.deepStrictEqual(states, [], "the explicit file-only API must not invoke page rules");
    assert.ok(!files.some(diagnostic => diagnostic.rule === "unknownPage"));
  });

  it("keeps empty route-adapter fallback on the composed-page API", async () => {
    const entry = write("Entry.jsx", "export default function Entry(){return <img />} ");
    let discoveries = 0;
    const options = { rootDir: root, routeAdapters: [{ name: "empty", discover: () => { discoveries += 1; return []; } }] };
    const full = new ObservedLinter(options);
    const expected = await full.lintPageDiagnostics([entry]);
    assert.equal(discoveries, 1);
    assert.equal(full.graphCalls, 1);
    assert.deepStrictEqual(await fileDiagnostics(new ObservedLinter(options), [entry]), expected);
    assert.equal(discoveries, 1, "the file-only API does not discover routes");
  });

  it("re-reads changed source on repeated file-only calls", async () => {
    const entry = write("Entry.tsx", "export default function Entry(){return <main><img /></main>}");
    const linter = new ObservedLinter({ rootDir: root, crossComponentAnalysis: true });
    assert.equal((await fileDiagnostics(linter, [entry])).filter(diagnostic => diagnostic.rule === "requireAltText").length, 1);
    write("Entry.tsx", 'export default function Entry(){return <main><img alt="Description" /></main>}');
    assert.equal((await fileDiagnostics(linter, [entry])).filter(diagnostic => diagnostic.rule === "requireAltText").length, 0);
    write("Entry.tsx", "export default function Entry(){return <main><img /></main>}");
    const actual = await fileDiagnostics(linter, [entry]);
    assert.equal(actual.filter(diagnostic => diagnostic.rule === "requireAltText").length, 1);
    assert.deepStrictEqual(actual, await new ProjectLinter({ rootDir: root, crossComponentAnalysis: true }).lintPageDiagnostics([entry]));
    assert.equal(linter.graphCalls, 0);
  });

  it("preserves the existing page API's analyzer reset between reused calls", async () => {
    const previous = write("Previous.tsx", "export default function Previous(){return <h1>Previous</h1>}");
    const html = write("Document.html", '<html lang="en"><head><title>Doc</title></head><body><main><h1>Doc</h1></main></body></html>');
    const next = write("Next.tsx", "import Previous from './Previous';export default function Next(){return <main><h1>Next</h1><Previous /></main>}");
    const linter = new ObservedLinter({ rootDir: root, crossComponentAnalysis: true, rules: { singleH1: "warning" } });
    await linter.lintFile(previous);
    await linter.lintPageDiagnostics([html]);
    assert.equal(linter.graphCalls, 1);
    const results = await linter.lintFile(next);
    assert.ok([...results.values()].flat().every(finding => finding.rule !== "singleH1"), "a prior component must not survive the page API's established graph refresh");
  });

  it("returns no diagnostics or graph work for empty entries and preserves source read failures", async () => {
    const linter = new ObservedLinter({ rootDir: root });
    assert.deepStrictEqual(await fileDiagnostics(linter, []), []);
    assert.equal(linter.graphCalls, 0);
    await assert.rejects(fileDiagnostics(linter, [path.join(root, "missing.html")]), /ENOENT/);
  });
});
