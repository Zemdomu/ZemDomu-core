import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../../src/index";

describe("cross component requireButtonText", () => {
  it("surfaces button text issues in imported components", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cc-btn-"));
    const child = path.join(tmp, "IconButton.jsx");
    const entry = path.join(tmp, "Page.jsx");

    fs.writeFileSync(
      child,
      "export default function IconButton(){ return <button><svg /></button>; }"
    );
    fs.writeFileSync(
      entry,
      "import IconButton from './IconButton'; export default function Page(){ return <div><IconButton /></div>; }"
    );

    const linter = new ProjectLinter({
      crossComponentAnalysis: true,
      rootDir: tmp,
      rules: { requireButtonText: "error" },
    });

    const map = await linter.lintFiles([entry]);
    const results = Array.from(map.values()).flat();

    assert.ok(
      results.some((r) => r.rule === "requireButtonText"),
      "Expected requireButtonText warning for child component"
    );

    const files = new Set(
      results
        .filter((r) => r.rule === "requireButtonText" && r.filePath)
        .map((r) => path.basename(r.filePath as string))
    );

    assert.ok(
      files.has("IconButton.jsx"),
      "Expected warning to point to IconButton.jsx"
    );
  });
});
