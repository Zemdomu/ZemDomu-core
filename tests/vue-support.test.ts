import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";

describe("vue support", () => {
  it("lints template content and ignores script blocks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-vue-"));
    const file = path.join(tmp, "App.vue");
    fs.writeFileSync(
      file,
      `<template>
  <div>
    <img>
  </div>
</template>
<script>
const html = "<img>";
</script>
`,
      "utf8"
    );

    const linter = new ProjectLinter({ rules: { requireAltText: "error" } });
    const map = await linter.lintFile(file);
    const results = Array.from(map.values()).flat();

    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected missing alt text warning in template"
    );
    assert.ok(
      !results.some((r) => r.rule === "parseError"),
      "Did not expect parse errors from Vue scripts"
    );
  });

  it("resolves Vue component usage for cross-component rules", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-vue-cc-"));
    const a = path.join(tmp, "Page.vue");
    const b = path.join(tmp, "Button.vue");
    fs.writeFileSync(
      b,
      `<template>
  <div><h1>Button</h1></div>
</template>
`,
      "utf8"
    );
    fs.writeFileSync(
      a,
      `<template>
  <main><h1>Page</h1><ButtonComp/></main>
</template>
<script setup>
import ButtonComp from "./Button.vue";
</script>
`,
      "utf8"
    );

    const linter = new ProjectLinter({
      crossComponentAnalysis: true,
      rules: { singleH1: "error" },
    });
    await linter.lintFile(b);
    const map = await linter.lintFile(a);
    const results = Array.from(map.values()).flat();
    assert.ok(
      results.some((r) => r.rule === "singleH1"),
      "Expected cross-component singleH1 warning for Vue components"
    );

    fs.writeFileSync(
      b,
      `<template>
  <div><h2>Button</h2></div>
</template>
`,
      "utf8"
    );
    linter.clear();
    await linter.lintFile(b);
    const map2 = await linter.lintFile(a);
    const results2 = Array.from(map2.values()).flat();
    assert.ok(
      !results2.some((r) => r.rule === "singleH1"),
      "Did not expect singleH1 warning after fixing Vue child component"
    );
  });
});
