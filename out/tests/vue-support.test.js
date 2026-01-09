"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../src/index");
describe("vue support", () => {
    it("lints template content and ignores script blocks", async () => {
        const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "zd-vue-"));
        const file = path_1.default.join(tmp, "App.vue");
        fs_1.default.writeFileSync(file, `<template>
  <div>
    <img>
  </div>
</template>
<script>
const html = "<img>";
</script>
`, "utf8");
        const linter = new index_1.ProjectLinter({ rules: { requireAltText: "error" } });
        const map = await linter.lintFile(file);
        const results = Array.from(map.values()).flat();
        assert_1.default.ok(results.some((r) => r.rule === "requireAltText"), "Expected missing alt text warning in template");
        assert_1.default.ok(!results.some((r) => r.rule === "parseError"), "Did not expect parse errors from Vue scripts");
    });
    it("resolves Vue component usage for cross-component rules", async () => {
        const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "zd-vue-cc-"));
        const a = path_1.default.join(tmp, "Page.vue");
        const b = path_1.default.join(tmp, "Button.vue");
        fs_1.default.writeFileSync(b, `<template>
  <div><h1>Button</h1></div>
</template>
`, "utf8");
        fs_1.default.writeFileSync(a, `<template>
  <main><h1>Page</h1><ButtonComp/></main>
</template>
<script setup>
import ButtonComp from "./Button.vue";
</script>
`, "utf8");
        const linter = new index_1.ProjectLinter({
            crossComponentAnalysis: true,
            rules: { singleH1: "error" },
        });
        await linter.lintFile(b);
        const map = await linter.lintFile(a);
        const results = Array.from(map.values()).flat();
        assert_1.default.ok(results.some((r) => r.rule === "singleH1"), "Expected cross-component singleH1 warning for Vue components");
        fs_1.default.writeFileSync(b, `<template>
  <div><h2>Button</h2></div>
</template>
`, "utf8");
        linter.clear();
        await linter.lintFile(b);
        const map2 = await linter.lintFile(a);
        const results2 = Array.from(map2.values()).flat();
        assert_1.default.ok(!results2.some((r) => r.rule === "singleH1"), "Did not expect singleH1 warning after fixing Vue child component");
    });
});
