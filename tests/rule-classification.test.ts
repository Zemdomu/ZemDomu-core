import assert from "assert";
import { lint, RULE_CLASSIFICATIONS } from "../src";

describe("advisory and house-style rule classification", () => {
  it("exports classification metadata", () => {
    assert.deepStrictEqual(RULE_CLASSIFICATIONS, {
      singleH1: "house-style",
      requireTableCaption: "advisory",
      requireSectionHeading: "advisory",
      requireNavLinks: "house-style",
    });
  });

  it("defaults unconditional style advice to warning severity", () => {
    const source = `<h1>One</h1><h1>Two</h1><section></section><nav></nav><table></table>`;
    const advisoryRules = new Set(Object.keys(RULE_CLASSIFICATIONS));
    const results = lint(source, { forceHtml: true }).filter((result) =>
      advisoryRules.has(result.rule)
    );
    assert.ok(results.length >= 4);
    assert.ok(results.every((result) => result.severity === "warning"));
  });
});
