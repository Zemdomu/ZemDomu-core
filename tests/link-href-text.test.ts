import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("link href and text with dynamic values", () => {
  it("allows JSX expressions for href and text when not explicitly empty", () => {
    const jsx = `
      const link = { url: "/docs" };
      const text = "Docs";
      export default function Nav() {
        return <a href={link.url}>{text}</a>;
      }
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireHrefOnAnchors"),
      "Did not expect href warning for dynamic href value"
    );
    assert.ok(
      !results.some((r) => r.rule === "requireLinkText"),
      "Did not expect link text warning for dynamic text value"
    );
  });

  it("flags explicitly empty JSX href values", () => {
    const jsx = `export default () => <a href={""}>Text</a>;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "requireHrefOnAnchors"),
      "Expected href warning for empty JSX href"
    );
  });

  it("flags explicitly empty JSX text values", () => {
    const jsx = `export default () => <a href="/docs">{undefined}</a>;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "requireLinkText"),
      "Expected link text warning for undefined JSX text"
    );
  });

  it("uses possible-empty messaging for conditional href/text", () => {
    const jsx = `
      export default function Nav({ ready, link }) {
        return (
          <a href={ready ? link.url : ""}>
            {ready ? "Docs" : ""}
          </a>
        );
      }
    `;
    const results = lint(jsx);
    const hrefWarning = results.find((r) => r.rule === "requireHrefOnAnchors");
    const textWarning = results.find((r) => r.rule === "requireLinkText");
    assert.ok(hrefWarning, "Expected href warning for possibly empty href");
    assert.ok(textWarning, "Expected link text warning for possibly empty text");
    assert.ok(
      hrefWarning?.message.includes("possibly empty or undefined"),
      "Expected possible-empty href message"
    );
    assert.ok(
      textWarning?.message.includes("possibly empty or undefined"),
      "Expected possible-empty text message"
    );
  });

  it("treats Vue-style bound href and mustache text as present in HTML mode", () => {
    const html = `<a :href="link.url">{{ text }}</a>`;
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireHrefOnAnchors"),
      "Did not expect href warning for bound Vue href"
    );
    assert.ok(
      !results.some((r) => r.rule === "requireLinkText"),
      "Did not expect link text warning for mustache text"
    );
  });
});
