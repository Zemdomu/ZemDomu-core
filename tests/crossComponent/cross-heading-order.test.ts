// tests/crossComponent/cross-heading-order.test.ts
import assert from "assert";
import path from "path";
import { ProjectLinter } from "../../src/index";

type LintResult = { rule: string; filePath?: string; message?: string };

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

    const singleH1Files = new Set(
      results
        .filter((r) => r.rule === "singleH1" && r.filePath)
        .map((r) => path.basename(r.filePath as string))
    );
    assert.ok(
      singleH1Files.has("Page.tsx"),
      "Expected cross-component singleH1 to surface on Page.tsx"
    );
    assert.ok(
      singleH1Files.has("Button.tsx"),
      "Expected cross-component singleH1 to surface on Button.tsx"
    );
    assert.ok(
      singleH1Files.has("SubSection.tsx"),
      "Expected cross-component singleH1 to surface on SubSection.tsx usage"
    );

    const headingLocations = results
      .filter((r) => r.rule === "enforceHeadingOrder" && r.filePath)
      .map((r) => path.basename(r.filePath as string));
    assert.ok(
      headingLocations.includes("Button.tsx"),
      "Expected heading order issue to highlight the component containing the offending heading"
    );

    const headingMessages = results
      .filter((r) => r.rule === "enforceHeadingOrder")
      .map((r) => r.message || "");
    assert.ok(
      headingMessages.some((msg) => msg.includes("<h5>") && msg.includes("after <h1>")),
      "Expected cross-component skipped <h5> warning"
    );
  });
});
