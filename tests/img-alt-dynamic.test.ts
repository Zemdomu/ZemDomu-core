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

  it("uses possible-empty messaging for conditional alt", () => {
    const jsx = `
      export default function Avatar({ user }) {
        return <img src="/avatar.png" alt={user ? user.label : ""} />;
      }
    `;
    const results = lint(jsx);
    const warning = results.find((r) => r.rule === "requireAltText");
    assert.ok(warning, "Expected alt warning for possibly empty alt");
    assert.ok(
      warning?.message.includes("possibly empty or undefined"),
      "Expected possible-empty alt message"
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
