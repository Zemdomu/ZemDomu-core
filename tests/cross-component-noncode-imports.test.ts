import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src";

describe("cross-component non-code imports", () => {
  it("does not lint an imported stylesheet as source code", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-stylesheet-"));
    const entry = path.join(root, "Page.tsx");
    const child = path.join(root, "Child.tsx");
    const stylesheet = path.join(root, "globals.css");

    fs.writeFileSync(
      entry,
      `import "./globals.css";
import Child from "./Child";
export default function Page() { return <main><Child /></main>; }`,
      "utf8"
    );
    fs.writeFileSync(
      child,
      `export default function Child() { return <img src="hero.png" />; }`,
      "utf8"
    );
    fs.writeFileSync(stylesheet, ":root { color-scheme: dark; }", "utf8");

    const results = await new ProjectLinter({
      rootDir: root,
      crossComponentAnalysis: true,
      rules: { requireAltText: "error" },
    }).lintFiles([entry]);

    assert.ok(results.has(path.resolve(entry)));
    assert.ok(
      results.has(path.resolve(child)),
      "supported component imports remain included"
    );
    assert.ok(
      !results.has(path.resolve(stylesheet)),
      "stylesheet imports are excluded"
    );
    assert.ok(
      (results.get(path.resolve(child)) ?? []).some(
        (result) => result.rule === "requireAltText"
      ),
      "the imported component is still linted"
    );
  });
});
