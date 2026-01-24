import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("img alt text with dynamic values", () => {
  it("allows JSX expressions for alt when not explicitly empty", () => {
    const jsx = `
      const avatarUrl = "/avatar.png";
      const displayLabel = "Avatar";
      export default function Avatar() {
        return <img src={avatarUrl} alt={displayLabel} />;
      }
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect alt warning for dynamic alt value"
    );
  });

  it("flags explicitly empty JSX alt values", () => {
    const jsx = `export default () => <img src="/avatar.png" alt={""} />;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected alt warning for empty JSX alt"
    );
  });

  it("treats Vue-style bound alt as present in HTML mode unless empty", () => {
    const html = `<img src="/avatar.png" :alt="displayLabel"><img src="/avatar.png" :alt="">`;
    const results = lint(html, { forceHtml: true });
    const warnings = results.filter((r) => r.rule === "requireAltText");
    assert.strictEqual(
      warnings.length,
      1,
      "Expected only the empty bound alt to warn"
    );
  });
});
