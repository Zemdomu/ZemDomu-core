import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("simple HTML parser regressions", () => {
  it("keeps list siblings under their list when earlier items contain void elements", () => {
    const html = `
      <ul>
        <li><img src="one.png" alt="One"></li>
        <li><input type="checkbox">Two</li>
        <li>Three<br>continued</li>
      </ul>
    `;
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((result) => result.rule === "enforceListNesting"),
      "Did not expect void elements to corrupt list ancestry"
    );
  });

  it("recovers to the matching ancestor for malformed closing tags", () => {
    const html = `<ul><li>One</strong></li><li>Two</li></ul>`;
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((result) => result.rule === "enforceListNesting"),
      "Did not expect an unmatched close tag to pop the list ancestor"
    );
  });
});
