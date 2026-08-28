import assert from "assert";
import { lint } from "../src";

describe("HTML source locations", () => {
  it("anchors repeated element violations to distinct elements", () => {
    const source = `<main>
  <img>
  <img>
</main>`;
    const results = lint(source, {
      forceHtml: true,
      rules: { requireAltText: "error" },
    }).filter((result) => result.rule === "requireAltText");

    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(results.map(({ line, column }) => ({ line, column })), [
      { line: 1, column: 2 },
      { line: 2, column: 2 },
    ]);
    assert.deepStrictEqual(results.map((result) => result.offset), [
      source.indexOf("<img>"),
      source.lastIndexOf("<img>"),
    ]);
  });

  it("anchors invalid attributes to the attribute name", () => {
    const source = `<button aria-expanded="maybe" tabindex="2">Open</button>`;
    const results = lint(source, { forceHtml: true });
    const aria = results.find((result) => result.rule === "ariaValidAttrValue");
    const tabindex = results.find(
      (result) => result.rule === "noTabindexGreaterThanZero"
    );
    assert.strictEqual(aria?.offset, source.indexOf("aria-expanded"));
    assert.strictEqual(tabindex?.offset, source.indexOf("tabindex"));
  });

  it("keeps JSX attribute offsets aligned with line and column locations", () => {
    const source = `export default () => (
  <button aria-expanded="maybe">Open</button>
);`;
    const result = lint(source).find(
      (entry) => entry.rule === "ariaValidAttrValue"
    );
    assert.strictEqual(result?.offset, source.indexOf("aria-expanded"));
    assert.deepStrictEqual(
      { line: result?.line, column: result?.column },
      { line: 1, column: 10 }
    );
  });

  it("anchors JSX identifiers, placeholders, language, and tabindex to attributes", () => {
    const cases: Array<{ source: string; rule: string; needle: string }> = [
      {
        source: `export default () => <><div id="dup" /><span id="dup" /></>;`,
        rule: "uniqueIds",
        needle: `id="dup" />`,
      },
      {
        source: `export default () => <div aria-label="TODO-ZMD" />;`,
        rule: "preventZemdomuPlaceholders",
        needle: "TODO-ZMD",
      },
      {
        source: `export default () => <html lang="en_US"><head><title>Page</title></head><body><main /></body></html>;`,
        rule: "requireHtmlLang",
        needle: `lang="en_US"`,
      },
      {
        source: `export default () => <button tabIndex="2">Open</button>;`,
        rule: "noTabindexGreaterThanZero",
        needle: `tabIndex="2"`,
      },
    ];

    for (const { source, rule, needle } of cases) {
      const result = lint(source).find((entry) => entry.rule === rule);
      const expected = rule === "uniqueIds"
        ? source.lastIndexOf(needle)
        : source.indexOf(needle);
      assert.strictEqual(result?.offset, expected, `${rule} JSX attribute offset`);
    }
  });

  it("anchors an empty JSX caption to caption instead of table", () => {
    const source = `export default () => <table><caption></caption></table>;`;
    const result = lint(source).find(
      (entry) => entry.rule === "requireTableCaption"
    );
    assert.strictEqual(result?.offset, source.indexOf("<caption>"));
  });

  it("anchors empty captions to caption and missing captions to table", () => {
    const source = `<table><caption></caption></table>
<table><tr><td>Data</td></tr></table>`;
    const results = lint(source, {
      forceHtml: true,
      rules: { requireTableCaption: "warning" },
    }).filter((result) => result.rule === "requireTableCaption");
    assert.deepStrictEqual(results.map((result) => result.offset), [
      source.indexOf("<caption>"),
      source.lastIndexOf("<table>"),
    ]);
  });

  it("anchors deferred HTML findings to their offending elements", () => {
    const cases: Array<{ source: string; rule: string; needle: string }> = [
      { source: `\n<button></button>`, rule: "requireButtonText", needle: "<button>" },
      { source: `\n<svg role="img"></svg>`, rule: "requireAltText", needle: "<svg" },
      { source: `\n<a href="/"></a>`, rule: "requireLinkText", needle: "<a" },
      { source: `\n<input>`, rule: "requireLabelForFormControls", needle: "<input>" },
      { source: `\n<section><p>Copy</p></section>`, rule: "requireSectionHeading", needle: "<section>" },
      {
        source: `\n<html><head></head><body><main></main></body></html>`,
        rule: "requireDocumentTitle",
        needle: "<html>",
      },
      {
        source: `\n<html><head><title>Page</title></head><body></body></html>`,
        rule: "requireSingleMain",
        needle: "<html>",
      },
      {
        source: `\n<html><head><title>Page</title></head><body><main></main><main></main></body></html>`,
        rule: "requireSingleMain",
        needle: "<main></main><main>",
      },
    ];

    for (const { source, rule, needle } of cases) {
      const result = lint(source, { forceHtml: true }).find(
        (entry) => entry.rule === rule
      );
      const expected = needle === "<main></main><main>"
        ? source.lastIndexOf("<main>")
        : source.indexOf(needle);
      assert.strictEqual(result?.offset, expected, `${rule} offset`);
      assert.notDeepStrictEqual(
        { line: result?.line, column: result?.column },
        { line: 0, column: 0 },
        `${rule} line/column`
      );
    }
  });
});
