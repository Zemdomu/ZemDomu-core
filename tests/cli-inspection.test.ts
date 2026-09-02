import { strict as assert } from "assert";
import { spawnSync } from "child_process";
import path from "path";

const packageRoot = path.resolve(__dirname, "../..");
const cliPath = path.resolve(__dirname, "../src/cli.js");
const entryFile = "tests/crossComponent/Page.tsx";

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: packageRoot,
    encoding: "utf8",
  });
}

describe("CLI semantic inspection", function () {
  this.timeout(10_000);

  it("renders a deterministic semantic graph with source paths and explicit unknowns", () => {
    const first = runCli(["graph", entryFile]);
    const second = runCli(["graph", entryFile]);

    assert.equal(first.status, 0);
    assert.equal(first.stderr, "");
    assert.equal(second.stdout, first.stdout);
    assert.match(first.stdout, /^Semantic graph 1\.0\nRoot: \.\n/m);
    assert.match(first.stdout, /Components \(4\)/);
    assert.match(first.stdout, /Semantic nodes \(14\)/);
    assert.match(
      first.stdout,
      /component Page -> <main> \[inferred\] @ tests\/crossComponent\/Page\.tsx:1:1/
    );
    assert.match(first.stdout, /Unknowns \(2\)/);
    assert.match(first.stdout, /missing-page-root/);
  });

  it("snapshots a composed page with components and ordered semantic facts", () => {
    const result = runCli([
      "inspect",
      "/fixture",
      "--entry",
      entryFile,
    ]);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      [
        "Page /fixture",
        "Schema: 1.0 (graph 1.0)",
        "Discovery: configured [certain]",
        "",
        "Components",
        "- component Page -> <main> [inferred] @ tests/crossComponent/Page.tsx:1:1",
        "  - component Section -> <section> [inferred] @ tests/crossComponent/Section.tsx:1:1",
        "    - component SubSection -> <div> [inferred] @ tests/crossComponent/SubSection.tsx:1:1",
        "      - component Button -> <div> [inferred] @ tests/crossComponent/Button.tsx:1:1",
        "",
        "Semantic facts (8)",
        "- landmark=main <main> @ tests/crossComponent/Page.tsx:6:5 [Page]",
        "- heading=1 <h1> @ tests/crossComponent/Page.tsx:7:7 [Page]",
        "- section <section> @ tests/crossComponent/Page.tsx:8:7 [Page]",
        "- section <section> @ tests/crossComponent/Section.tsx:6:5 [Page > Section]",
        "- heading=2 <h2> @ tests/crossComponent/Section.tsx:7:7 [Page > Section]",
        "- heading=3 <h3> @ tests/crossComponent/SubSection.tsx:7:7 [Page > Section > SubSection]",
        "- heading=1 <h1> @ tests/crossComponent/Button.tsx:6:7 [Page > Section > SubSection > Button]",
        "- heading=5 <h5> @ tests/crossComponent/Button.tsx:7:7 [Page > Section > SubSection > Button]",
        "",
        "Unknowns (0)",
        "- none",
        "",
      ].join("\n")
    );
  });

  it("rejects invalid page invocations with useful non-zero exits", () => {
    const missingEntry = runCli(["inspect", "/missing"]);
    assert.equal(missingEntry.status, 2);
    assert.equal(missingEntry.stdout, "");
    assert.match(missingEntry.stderr, /requires --entry <file>/);

    const missingFile = runCli([
      "inspect",
      "/missing",
      "--entry",
      "does-not-exist.tsx",
    ]);
    assert.equal(missingFile.status, 2);
    assert.equal(missingFile.stdout, "");
    assert.match(missingFile.stderr, /No files matched: does-not-exist\.tsx/);
  });

  it("keeps machine formats outside the inspection command contract", () => {
    const result = runCli(["graph", entryFile, "--format", "json"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--format is currently only supported/);
  });
});
