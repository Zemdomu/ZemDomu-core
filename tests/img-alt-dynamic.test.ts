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

  it("allows explicitly empty JSX alt values for decorative images", () => {
    const jsx = `export default () => <img src="/avatar.png" alt={""} />;`;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect alt warning for decorative empty JSX alt"
    );
  });

  it("allows conditional alt values that may intentionally render empty", () => {
    const jsx = `
      export default function Avatar({ user }) {
        return <img src="/avatar.png" alt={user ? user.label : ""} />;
      }
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireAltText"),
      "Did not expect alt warning for conditional empty alt"
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

  it("allows images hidden from assistive technology without alt", () => {
    const htmlResults = lint(`<img src="/star.svg" aria-hidden="true">`, { forceHtml: true });
    const jsxResults = lint(`export default () => <img src="/star.svg" aria-hidden />;`);
    assert.ok(!htmlResults.some((r) => r.rule === "requireAltText"));
    assert.ok(!jsxResults.some((r) => r.rule === "requireAltText"));
  });

  it("does not treat a custom Image component as a native img", () => {
    const results = lint(`export default () => <Image src="/star.svg" />;`);
    assert.ok(!results.some((r) => r.rule === "requireAltText"));
  });
});
