import assert from "assert";
import { lint } from "../src";

describe("requireLabelForFormControls (HTML regressions)", () => {
  const lintLabels = (source: string) =>
    lint(source, { forceHtml: true }).filter(
      (result) => result.rule === "requireLabelForFormControls"
    );

  it("accepts implicit labels", () => {
    assert.deepStrictEqual(lintLabels(`<label>Name <input></label>`), []);
    assert.strictEqual(
      lintLabels(`<label><input></label>`).length,
      1,
      "An empty implicit label must not hide an unnamed control"
    );
  });

  it("ignores hidden inputs", () => {
    assert.deepStrictEqual(
      lintLabels(`<input type="hidden"><input hidden><input style="display:none">`),
      []
    );
  });

  it("accepts named image and button-like inputs", () => {
    assert.deepStrictEqual(
      lintLabels(
        `<input type="image" alt="Search"><input type="submit"><input type="reset"><input type="button" value="Save">`
      ),
      []
    );
  });

  it("still flags unnamed image and button inputs at their own locations", () => {
    const source = `<input type="image" alt="">
<input type="button" value="">`;
    const results = lintLabels(source);
    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(results.map((result) => result.offset), [
      source.indexOf("<input"),
      source.lastIndexOf("<input"),
    ]);
  });
});
