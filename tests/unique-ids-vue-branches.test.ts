import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("uniqueIds in Vue conditional branches", () => {
  it("accepts an id repeated across mutually exclusive v-if/v-else branches", () => {
    const results = lint(
      `<div><section v-if="ready" id="status"></section><section v-else id="status"></section></div>`,
      { forceHtml: true }
    );
    assert.ok(!results.some((result) => result.rule === "uniqueIds"));
  });

  it("still flags duplicate ids outside mutually exclusive branches", () => {
    const results = lint(
      `<div><section id="status"></section><section id="status"></section></div>`,
      { forceHtml: true }
    );
    assert.ok(results.some((result) => result.rule === "uniqueIds"));
  });

  it("does not suppress a non-adjacent v-else branch", () => {
    const results = lint(
      `<div><section v-if="ready" id="status"></section><p>Other</p><section v-else id="status"></section></div>`,
      { forceHtml: true }
    );
    assert.ok(results.some((result) => result.rule === "uniqueIds"));
  });
});
