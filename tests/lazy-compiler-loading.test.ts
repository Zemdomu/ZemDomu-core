import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

// Run the public API in a new process: other test files legitimately load
// TypeScript and must not hide an accidental eager compiler import here.
const scenarioRunner = String.raw`
const fs = require("fs");
const path = require("path");
const input = JSON.parse(fs.readFileSync(0, "utf8"));
const root = input.root;
if (input.probeError) {
  const original = fs.lstatSync;
  const candidate = path.join(root, "tsconfig.json");
  let failed = false;
  fs.lstatSync = function (file, ...args) {
    if (!failed && file === candidate) {
      failed = true;
      const error = new Error("Simulated uncertain config probe");
      error.code = "EACCES";
      throw error;
    }
    return original.call(this, file, ...args);
  };
}
const apiPath = process.argv[1];
const compilerPath = require.resolve("typescript", { paths: [path.dirname(apiPath)] });
if (input.preloadCompiler) require(compilerPath);
const { ProjectLinter } = require(apiPath);
const loadedAfterImport = Boolean(require.cache[compilerPath]);
const entries = input.entries.map(file => path.join(input.fixture, file));
const linter = new ProjectLinter({ rootDir: root, crossComponentAnalysis: true });
(async () => {
  const output = input.pages
    ? await linter.lintPageDiagnostics(entries)
    : await linter.lintFiles(entries);
  const files = input.pages ? entries : [...output.keys()];
  const findings = input.pages
    ? output.map(item => ({ file: path.relative(input.fixture, item.source.file), rule: item.rule }))
    : [...output].flatMap(([file, findings]) => findings.map(item => ({
        file: path.relative(input.fixture, file), rule: item.rule,
      })));
  function normalize(value) {
    if (typeof value === "string") return value.split(input.fixture).join("<fixture>");
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
    }
    return value;
  }
  console.log(JSON.stringify({
    loadedAfterImport,
    loadedAfterAnalysis: Boolean(require.cache[compilerPath]),
    files: files.map(file => path.relative(input.fixture, file)).sort(),
    serializedFindings: normalize(input.pages ? output : [...output]),
    missingAltFiles: findings.filter(item => item.rule === "requireAltText")
      .map(item => item.file).sort(),
  }));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

type ScenarioResult = {
  loadedAfterImport: boolean;
  loadedAfterAnalysis: boolean;
  files: string[];
  missingAltFiles: string[];
  serializedFindings: unknown;
};

function runScenario(
  files: Record<string, string>,
  entries: string[],
  options: {
    root?: string;
    pages?: boolean;
    probeError?: boolean;
    preloadCompiler?: boolean;
    rootSpelling?: "relative" | "dot-segment";
    configDirectory?: boolean;
    configSymlink?: boolean;
  } = {}
): ScenarioResult {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-lazy-compiler-"));
  try {
    for (const [file, source] of Object.entries(files)) {
      const target = path.join(fixture, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
    if (options.configDirectory) fs.mkdirSync(path.join(fixture, "tsconfig.json"));
    if (options.configSymlink) {
      fs.symlinkSync(path.join(fixture, "config-target.json"), path.join(fixture, "tsconfig.json"), "file");
    }
    let root = path.join(fixture, options.root ?? "");
    if (options.rootSpelling === "relative") root = path.relative(fixture, root) || ".";
    if (options.rootSpelling === "dot-segment") root += `${path.sep}.${path.sep}`;
    const result = spawnSync(
      process.execPath,
      ["-e", scenarioRunner, path.resolve(__dirname, "../src/index.js")],
      {
        cwd: fixture,
        encoding: "utf8",
        input: JSON.stringify({
          fixture,
          root,
          entries,
          pages: options.pages ?? false,
          probeError: options.probeError ?? false,
          preloadCompiler: options.preloadCompiler ?? false,
        }),
      }
    );
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim().split(/\r?\n/).pop()!) as ScenarioResult;
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

const childSource = 'export default function Child(){ return <img src="portrait.png"/>; }';

describe("on-demand TypeScript compiler loading", function () {
  this.timeout(15000);

  it("keeps standalone mixed-format page analysis compiler-free without losing diagnostics", () => {
    const files = {
      "page.html": '<!doctype html><html lang="en"><head><title>Page</title></head><body><main><h1>Page</h1><img src="portrait.png"></main></body></html>',
      "Page.jsx": 'export default function Page(){return <main><h1>Page</h1><img src="portrait.png"/></main>;}',
      "Page.tsx": 'export default function Page(){return <main><h1>Page</h1><img src="portrait.png"/></main>;}',
      "Page.vue": '<template><main><h1>Page</h1><img src="portrait.png"/></main></template>',
      "Scripted.vue": '<script setup lang="ts">const title: string = "Page";</script><template><main><h1>{{title}}</h1><img src="portrait.png"/></main></template>',
    };
    const result = runScenario(files, Object.keys(files), { pages: true });
    assert.strictEqual(result.loadedAfterImport, false, "Importing Core must not initialize TypeScript");
    assert.strictEqual(result.loadedAfterAnalysis, false, "Standalone files need no compiler");
    assert.deepStrictEqual(result.missingAltFiles, Object.keys(files).sort());
    const eagerControl = runScenario(files, Object.keys(files), { pages: true, preloadCompiler: true });
    assert.deepStrictEqual(result.serializedFindings, eagerControl.serializedFindings);
  });

  const dependencies = [
    ["side-effect import", "import './Child';"],
    ["default import", "import Child from './Child'; export default Child;"],
    ["named re-export", "export { default as Child } from './Child';"],
    ["star re-export", "export * from './Child';"],
    ["type-only re-export", "export type * from './Child';"],
    ["missing-from star recovery", "export * './Child';"],
    ["missing-from named recovery", "export { Child } './Child';"],
    ["escaped export recovery", "expor\\u0074 * './Child';"],
  ];
  for (const [name, source] of dependencies) {
    it(`retains dependency traversal for ${name}`, () => {
      const result = runScenario({ "entry.ts": source, "Child.tsx": childSource }, ["entry.ts"]);
      assert.strictEqual(result.loadedAfterAnalysis, true);
      assert.deepStrictEqual(result.files, ["Child.tsx", "entry.ts"]);
      assert.deepStrictEqual(result.missingAltFiles, ["Child.tsx"]);
    });
  }

  it("retains dependencies across typed Vue scripts and local import cycles", () => {
    const result = runScenario({
      "Page.vue": '<script setup lang="tsx">import Child from "./Child";</script><template><Child/></template>',
      "Child.tsx": `import "./Page.vue"; ${childSource}`,
    }, ["Page.vue"]);
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.files, ["Child.tsx", "Page.vue"]);
    assert.deepStrictEqual(result.missingAltFiles, ["Child.tsx"]);
  });

  for (const source of [
    "// import './Child'\nexport default function Page() { return <main/>; }",
    "const text = \"export * from './Child'\"; export default text;",
    'const text = "\\u0061"; export default text;',
    'const label = "café"; export default label;',
    "export defaultλ './Child';",
    "export /* comment */ default function Page() { return <main/>; }",
  ]) {
    it(`conservatively parses ambiguous source ${JSON.stringify(source.slice(0, 28))}`, () => {
      const result = runScenario({ "entry.ts": source, "Child.tsx": childSource }, ["entry.ts"]);
      assert.strictEqual(result.loadedAfterAnalysis, true);
      assert.deepStrictEqual(result.files, ["entry.ts"]);
    });
  }

  it("preserves unsupported CommonJS/import-equals behavior while loading on ambiguous syntax", () => {
    const result = runScenario({
      "entry.ts": "import Child = require('./Child'); const other = require('./Other'); export = Child;",
      "Child.tsx": childSource,
      "Other.tsx": childSource,
    }, ["entry.ts"]);
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.files, ["entry.ts"]);
  });

  it("uses the existing nearest ancestor config reader for commented alias configuration", () => {
    const result = runScenario({
      "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@child":["wrong"]}}}',
      "project/tsconfig.json": '{// nearest config\n"compilerOptions":{"baseUrl":".","paths":{"@child":["Child"]},},}',
      "project/src/entry.ts": "export { default as Child } from '@child';",
      "project/Child.tsx": childSource,
    }, ["project/src/entry.ts"], { root: "project" });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.files, [path.join("project", "Child.tsx"), path.join("project", "src", "entry.ts")]);
    assert.deepStrictEqual(result.missingAltFiles, [path.join("project", "Child.tsx")]);
  });

  it("loads the existing config reader even for standalone files when an ancestor config exists", () => {
    const result = runScenario({
      "tsconfig.json": '{// ancestor config\n"compilerOptions":{},}',
      "project/Page.tsx": childSource,
    }, ["project/Page.tsx"], { root: "project" });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.missingAltFiles, [path.join("project", "Page.tsx")]);
  });

  it("delegates a symlinked config to the existing config reader", () => {
    const result = runScenario({
      "config-target.json": '{// symlink target\n"compilerOptions":{},}',
      "Page.tsx": childSource,
    }, ["Page.tsx"], { configSymlink: true });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.missingAltFiles, ["Page.tsx"]);
  });

  it("preserves raw config reading without adding extends inheritance", () => {
    const files = {
      "tsconfig.json": '{"extends":"./base.json"}',
      "base.json": '{"compilerOptions":{"baseUrl":".","paths":{"@child":["Child"]}}}',
      "entry.ts": "export { default as Child } from '@child';",
      "Child.tsx": childSource,
    };
    const result = runScenario(files, ["entry.ts"]);
    const eagerControl = runScenario(files, ["entry.ts"], { preloadCompiler: true });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.files, ["entry.ts"]);
    assert.deepStrictEqual(result.serializedFindings, eagerControl.serializedFindings);
  });

  it("delegates config candidates that are directories to the existing finder", () => {
    const result = runScenario({ "Page.tsx": childSource }, ["Page.tsx"], { configDirectory: true });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.missingAltFiles, ["Page.tsx"]);
  });

  for (const rootSpelling of ["relative", "dot-segment"] as const) {
    it(`delegates ${rootSpelling} root spelling without changing findings`, () => {
      const result = runScenario({ "Page.tsx": childSource }, ["Page.tsx"], { rootSpelling });
      assert.strictEqual(result.loadedAfterAnalysis, true);
      assert.deepStrictEqual(result.missingAltFiles, ["Page.tsx"]);
    });
  }

  it("falls back to the existing config finder after an uncertain filesystem probe", () => {
    const result = runScenario({ "Page.tsx": childSource }, ["Page.tsx"], { probeError: true });
    assert.strictEqual(result.loadedAfterAnalysis, true);
    assert.deepStrictEqual(result.missingAltFiles, ["Page.tsx"]);
  });
});
