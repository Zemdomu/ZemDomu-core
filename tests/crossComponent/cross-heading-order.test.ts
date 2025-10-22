// tests/crossComponent/cross-heading-order.test.ts
import assert from "assert";
import path from "path";
import { ProjectLinter } from "../../src/index";

type LintResult = { rule: string; filePath?: string };

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
      sectionPath,
      subSectionPath,
      pagePath,
    ]);

    const results = Array.from(map.values()).flat() as LintResult[];

    // Presence checks
    assert.ok(
      results.some((r) => r.rule === "singleH1"),
      "Expected cross-component singleH1 warning"
    );
    assert.ok(
      results.some((r) => r.rule === "enforceHeadingOrder"),
      "Expected cross-component heading order warning"
    );

    // Count checks (looser; tighten later if you want)
    const byRule = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.rule] = (acc[r.rule] ?? 0) + 1;
      return acc;
    }, {});

    assert.ok((byRule["singleH1"] ?? 0) >= 1, "Expected at least one singleH1");
    assert.ok(
      (byRule["enforceHeadingOrder"] ?? 0) >= 1, // set to >=2 if you expect more
      "Expected at least one enforceHeadingOrder"
    );

    const usageLocations = results
      .filter((r) => r.rule === "enforceHeadingOrder" && "filePath" in r && r.filePath)
      .map((r) => path.basename(r.filePath as string));
    assert.ok(
      usageLocations.includes("SubSection.tsx"),
      "Expected heading order issue to surface on the component that renders the offending child"
    );
  });
});
