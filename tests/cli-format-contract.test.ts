import { strict as assert } from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawnSync } from "child_process";

function runCli(args: string[]) {
  return spawnSync(process.execPath, [path.resolve(__dirname, "../src/cli.js"), ...args], {
    encoding: "utf8",
  });
}

describe("CLI formatter contract", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "zemdomu-cli-contract-"));
  const invalidFile = path.join(directory, "invalid.html");
  const validFile = path.join(directory, "valid.html");

  before(() => {
    writeFileSync(invalidFile, "<img />", "utf8");
    writeFileSync(
      validFile,
      '<html lang="en"><head><title>Valid</title></head><body><main></main></body></html>',
      "utf8"
    );
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("writes only canonical JSON to stdout and returns one when diagnostics exist", () => {
    const result = runCli(["check", invalidFile, "--format", "json"]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const diagnostics = JSON.parse(result.stdout);
    assert.ok(Array.isArray(diagnostics));
    assert.equal(diagnostics[0].schemaVersion, "1.0");
    assert.equal(diagnostics[0].code, "ZMD004");
  });

  it("uses the canonical pretty formatter and documents success through exit zero", () => {
    const invalid = runCli(["check", invalidFile]);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
    assert.match(invalid.stderr, /ZMD004/);

    const valid = runCli(["check", validFile, "--format", "json"]);
    assert.equal(valid.status, 0);
    assert.deepEqual(JSON.parse(valid.stdout), []);
  });

  it("rejects an invalid output format with exit code two and no stdout", () => {
    const result = runCli(["check", invalidFile, "--format", "xml"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--format must be one of/);
  });
});
