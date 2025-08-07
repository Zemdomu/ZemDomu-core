import assert from "assert";
import path from "path";
import { ProjectLinter } from "../../src/index";

describe("cross component heading order", () => {
  it("detects heading order and h1 issues across components", async () => {
    const buttonPath = path.resolve(
      __dirname,
      "../../../tests/crossComponent/Button.tsx"
    );
    const sectionPath = path.resolve(
      __dirname,
      "../../../tests/crossComponent/Section.tsx"
    );
    const subSectionPath = path.resolve(
      __dirname,
      "../../../tests/crossComponent/SubSection.tsx"
    );
    const pagePath = path.resolve(
      __dirname,
      "../../../tests/crossComponent/Page.tsx"
    );

    const linter = new ProjectLinter({
      crossComponentAnalysis: true,
      rules: {
        singleH1: "error",
        enforceHeadingOrder: "error",
        requireButtonText: "off",
      },
    });

    const map = await linter.lintFiles([
      buttonPath,
      pagePath,
      sectionPath,
      subSectionPath,
    ]);
    const results = Array.from(map.values()).flat();

    assert.ok(
      results.some((r) => r.rule === "singleH1"),
      "Expected cross-component singleH1 warning"
    );
    assert.ok(
      results.some((r) => r.rule === "enforceHeadingOrder"),
      "Expected cross-component heading order warning"
    );
  });
});
