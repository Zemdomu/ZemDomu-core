import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("preventEmptyInlineTags icon patterns", () => {
  it("accepts class-based and assistive-technology-hidden HTML icons", () => {
    const results = lint(
      '<button><i class="fas fa-search"></i></button><i aria-hidden="true"></i>',
      { forceHtml: true }
    );
    assert.ok(
      !results.some((result) => result.rule === "preventEmptyInlineTags")
    );
  });

  it("accepts class-based JSX icons", () => {
    const results = lint(
      'export default () => <button><i className="fas fa-search" /></button>;'
    );
    assert.ok(
      !results.some((result) => result.rule === "preventEmptyInlineTags")
    );
  });

  it("does not treat unrelated JSX role metadata as icon intent", () => {
    const results = lint(`export default () => <i role="button"></i>;`);
    assert.ok(results.some((result) => result.rule === "preventEmptyInlineTags"));
  });
});
