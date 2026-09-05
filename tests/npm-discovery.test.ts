import assert from "assert";
import fs from "fs";
import path from "path";

describe("npm discovery contract", () => {
  const packageRoot = path.resolve(__dirname, "..", "..");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
  );
  const readme = fs.readFileSync(path.join(packageRoot, "README.md"), "utf8");

  it("publishes complete npm package links and search vocabulary", () => {
    assert.deepStrictEqual(manifest.repository, {
      type: "git",
      url: "git+https://github.com/Zemdomu/ZemDomu-mono.git",
    });
    assert.strictEqual(manifest.homepage, "https://zemdomu.dev/");
    assert.deepStrictEqual(manifest.bugs, {
      url: "https://github.com/Zemdomu/ZemDomu-core/issues",
    });
    assert.strictEqual(manifest.funding, "https://buymeacoffee.com/zemdomu");
    assert.strictEqual(manifest.license, "ISC");

    const keywords = new Set(manifest.keywords);
    for (const keyword of [
      "accessibility",
      "a11y",
      "wcag",
      "semantic-html",
      "html",
      "jsx",
      "tsx",
      "react",
      "vue",
      "cli",
      "vscode",
      "github-action",
    ]) {
      assert.ok(keywords.has(keyword), `missing npm keyword: ${keyword}`);
    }
    assert.strictEqual(keywords.size, manifest.keywords.length);
  });

  it("leads with a copyable CLI path and grounded diagnostic example", () => {
    const quickStart = readme.indexOf("## Quick start: scan your source");
    const libraryInstall = readme.indexOf("## Library installation");
    const api = readme.indexOf("## API");

    assert.ok(quickStart >= 0 && quickStart < libraryInstall);
    assert.ok(libraryInstall < api);
    assert.match(
      readme,
      /npx zemdomu check "src\/\*\*\/\*\.\{html,jsx,tsx,vue\}" --format pretty/
    );
    assert.match(
      readme,
      /Card\.tsx:3:5 ZMD004: <img> tag missing alt attribute/
    );
  });

  it("positions complementary tools with a dated primary-source review", () => {
    for (const link of [
      "https://github.com/dequelabs/axe-core",
      "https://github.com/jsx-eslint/eslint-plugin-jsx-a11y",
      "https://github.com/validator/validator",
    ]) {
      assert.ok(readme.includes(link), `missing comparison link: ${link}`);
    }
    assert.match(readme, /Comparison source matrix reviewed 2026-08-30/);
    assert.match(readme, /reverified 2026-09-04/);
  });
});
