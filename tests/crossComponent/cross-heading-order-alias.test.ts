import assert from "assert";
import path from "path";
import { ProjectLinter } from "../../src/index";

type LintResult = { rule: string };

describe("cross component heading order (ts-path-alias)", () => {
  it("follows @alias/* from PageAlias and finds violations", async () => {
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

    const map = await linter.lintFiles([pagePath]);
    const results = Array.from(map.values()).flat() as LintResult[];
    const byRule = results.reduce<Record<string, number>>((a, r) => {
      a[r.rule] = (a[r.rule] ?? 0) + 1;
      return a;
    }, {});

    assert.ok((byRule["singleH1"] ?? 0) >= 1);
    assert.ok((byRule["enforceHeadingOrder"] ?? 0) >= 1);
  });
});
