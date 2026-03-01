import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("ariaValidAttrValue", () => {
  it("flags invalid boolean and token values in HTML", () => {
    const html = `
      <div aria-hidden="maybe"></div>
      <a aria-current="chapter"></a>
    `;
    const results = lint(html, { forceHtml: true });
    const ariaWarnings = results.filter((r) => r.rule === "ariaValidAttrValue");
    assert.ok(ariaWarnings.length >= 2, "Expected ARIA value warnings");
  });

  it("flags invalid numeric values", () => {
    const html = `<div role="heading" aria-level="top"></div>`;
    const results = lint(html, { forceHtml: true });
    assert.ok(
      results.some((r) => r.rule === "ariaValidAttrValue"),
      "Expected invalid numeric ARIA warning"
    );
  });

  it("passes valid ARIA values", () => {
    const html = `
      <div aria-hidden="false"></div>
      <button aria-pressed="mixed"></button>
      <a aria-current="page"></a>
      <div role="heading" aria-level="2"></div>
      <div id="title"></div>
      <section aria-labelledby="title"></section>
    `;
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "ariaValidAttrValue"),
      "Did not expect ARIA value warning"
    );
  });

  it("flags invalid static JSX values and ignores dynamic expressions", () => {
    const jsx = `
      const level = 3;
      export default function Page() {
        return (
          <div>
            <div aria-hidden="nope" />
            <div aria-level={"high"} />
            <div aria-level={level} />
          </div>
        );
      }
    `;
    const results = lint(jsx);
    const ariaWarnings = results.filter((r) => r.rule === "ariaValidAttrValue");
    assert.ok(ariaWarnings.length >= 2, "Expected static JSX ARIA warnings");
    assert.ok(
      !ariaWarnings.some((r) => r.message.includes('aria-level" has invalid value "3"')),
      "Did not expect warning for dynamic numeric expression"
    );
  });
});
