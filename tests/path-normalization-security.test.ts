import { strict as assert } from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ComponentPathResolver, ProjectLinter } from "../src";

describe("untrusted path normalization", () => {
  it("recognizes framework entries with query strings and fragments", async () => {
    const file = path.join(os.tmpdir(), "zd-normalization-index", "index.html");
    const linter = new ProjectLinter();
    for (const src of [
      "/src/main.ts?version=1",
      "/src/main.ts#entry",
      "/src/main.ts?version=1#entry",
      "\\src\\main.ts?version=1",
      "/src/main.ts?" + "?#".repeat(32_768),
    ]) {
      const content = `<html><head><title>App</title></head><body><div id="root"></div><script type="module" src="${src}"></script></body></html>`;
      const results = (await linter.lintFile(file, content)).get(file) ?? [];
      assert.ok(!results.some(result => result.rule === "requireHtmlLang"));
      assert.ok(!results.some(result => result.rule === "requireSingleMain"));
    }
  });

  it("preserves framework-entry classification across line terminators", async () => {
    const file = path.join(os.tmpdir(), "zd-normalization-index", "index.html");
    const linter = new ProjectLinter();
    for (const terminator of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
      for (const [src, isEntry] of [
        [`/src/main.ts?version=1${terminator}`, false],
        [`/src/main.ts?before${terminator}trailing`, false],
        [`/src/main.ts${terminator}?version=1`, false],
        [`unrelated?before${terminator}/src/main.ts?after`, true],
      ] as const) {
        const content = `<html><head><title>App</title></head><body><div id="root"></div><script type="module" src="${src}"></script></body></html>`;
        const results = (await linter.lintFile(file, content)).get(file) ?? [];
        assert.equal(results.some(result => result.rule === "requireHtmlLang"), !isEntry, JSON.stringify(src));
      }
    }
  });

  it("handles long delimiter runs before a non-entry line", async () => {
    const file = path.join(os.tmpdir(), "zd-normalization-index", "index.html");
    const src = "/src/main.ts?" + "?#".repeat(32_768) + "\ntrailing";
    const content = `<html><head><title>Page</title></head><body><div id="root"></div><script type="module" src="${src}"></script></body></html>`;
    const results = (await new ProjectLinter().lintFile(file, content)).get(file) ?? [];
    assert.ok(results.some(result => result.rule === "requireHtmlLang"));
    assert.ok(results.some(result => result.rule === "requireSingleMain"));
  });

  it("resolves equivalent trailing separators without conflating suffixes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zd-resolver-normalization-"));
    try {
      const components = path.join(root, "components");
      fs.mkdirSync(components);
      const button = path.join(components, "Button.tsx");
      fs.writeFileSync(button, "export default function Button() { return <button>Save</button>; }");
      fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({
        compilerOptions: { paths: { "@/*": ["components/*"] } },
      }));
      const resolver = new ComponentPathResolver(root);
      const current = path.join(root, "Page.tsx");
      assert.equal(await resolver.resolve("@/Button", current), button);
      for (const importPath of ["@/Button/", "@/Button///", "@/Button\\\\", "@/Button" + "/".repeat(65_536)]) {
        assert.equal(await resolver.resolve(importPath, current), button);
      }
      for (const importPath of ["@/Button/\n", "@/Button/\r", "@/Button/\r\n", "@/Button/\u2028", "@/Button/\u2029", "@/Button" + "/".repeat(65_536) + "missing"]) {
        assert.equal(await resolver.resolve(importPath, current), null);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
