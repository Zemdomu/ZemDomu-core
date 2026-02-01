import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("svg accessible names", () => {
  it("flags svg role=img without an accessible name", () => {
    const jsx = `export default () => <svg role="img"></svg>;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected svg accessible-name warning"
    );
  });

  it("accepts aria-label and title for svg role=img", () => {
    const aria = `export default () => <svg role="img" aria-label="Logo"></svg>;`;
    let results = lint(aria);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect svg warning with aria-label"
    );

    const title = `
      export default () => (
        <svg role="img">
          <title>Logo</title>
        </svg>
      );
    `;
    results = lint(title);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect svg warning with title"
    );
  });

  it("accepts aria-labelledby for svg role=img", () => {
    const jsx = `
      export default () => (
        <>
          <span id="icon-label">Menu</span>
          <svg role="img" aria-labelledby="icon-label"></svg>
        </>
      );
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect svg warning with aria-labelledby"
    );
  });

  it("flags icon-only links/buttons with unlabeled svg", () => {
    const link = `export default () => <a href="/"><svg></svg></a>;`;
    let results = lint(link);
    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected svg warning for icon-only link"
    );

    const button = `export default () => <button><svg></svg></button>;`;
    results = lint(button);
    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected svg warning for icon-only button"
    );
  });

  it("does not flag svg when link/button has other content", () => {
    const link = `export default () => <a href="/"><span className="sr-only">Home</span><svg></svg></a>;`;
    const results = lint(link);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect svg warning when not icon-only"
    );
  });
});
