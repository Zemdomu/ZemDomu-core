import assert from "assert";
import { lint } from "../src";

const onlyAlt = { forceHtml: true, rules: { requireAltText: "warning" as const } };
function missingAlt(source: string) {
  return lint(source, onlyAlt).filter(result => result.rule === "requireAltText");
}

describe("HTML inline directive comment boundaries", () => {
  for (const tag of ["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes"]) {
    it(`does not treat literal comment text inside ${tag} as a disable directive`, () => {
      const prefix = `<${tag}><!-- zemdomu-disable requireAltText --></${tag}>\n`;
      const findings = missingAlt(prefix + "<img>");
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].severity, "warning");
      assert.strictEqual(findings[0].offset, prefix.length);
      assert.strictEqual(findings[0].line, 1);
    });
  }

  it("ignores nested-looking opening tags inside raw text and resumes real directives afterwards", () => {
    const raw = '<TEXTAREA title="a > b"><textarea><!-- zemdomu-disable --></TEXTAREA >\n';
    const results = missingAlt(raw + '<img>\n<!-- zemdomu-disable requireAltText -->\n<img>');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].offset, raw.length);
  });

  for (const quote of ['"', "'"]) {
    it(`ignores comment-looking attribute values delimited with ${quote}`, () => {
      const prefix = `<div title=${quote}literal > <!-- zemdomu-disable requireAltText -->${quote}></div>\n`;
      const findings = missingAlt(prefix + "<img>");
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].offset, prefix.length);
    });
  }

  it("does not confuse a custom element with a raw-text element sharing its prefix", () => {
    assert.deepStrictEqual(missingAlt('<textarea-widget><!-- zemdomu-disable requireAltText --></textarea-widget><img>'), []);
    assert.deepStrictEqual(missingAlt('<script-widget><!-- zemdomu-disable requireAltText --></script-widget><img>'), []);
  });

  it("does not swallow real comments after a stray less-than sign", () => {
    for (const prefix of ["Text <\n", "Text <!\n", "Text </\n"]) {
      assert.deepStrictEqual(missingAlt(prefix + "<!-- zemdomu-disable requireAltText -->\n<img>"), []);
    }
  });

  it("preserves real disable, enable and next-line controls with CRLF positions", () => {
    const content = [
      '<!-- zemdomu-disable requireAltText -->', '<img>',
      '<!-- zemdomu-enable requireAltText -->', '<img>',
      '<!-- zemdomu-disable-next requireAltText -->', '<img>', '<img>',
    ].join("\r\n");
    const findings = missingAlt(content);
    assert.deepStrictEqual(findings.map(result => result.line), [3, 6]);
    assert.deepStrictEqual(findings.map(result => result.offset), [content.indexOf('<img>', content.indexOf('zemdomu-enable')), content.lastIndexOf('<img>')]);
  });

  it("continues to honor JSX comment directives while ignoring directive text in string literals", () => {
    const options = { rules: { requireAltText: "warning" as const } };
    const literal = 'const text = "{/* zemdomu-disable requireAltText */}"; const App = () => <img />;';
    const findings = lint(literal, options).filter(result => result.rule === "requireAltText");
    assert.strictEqual(findings.length, 1);
    const directive = 'const App = () => <>{/* zemdomu-disable-next requireAltText */}<img /></>;';
    assert.deepStrictEqual(lint(directive, options).filter(result => result.rule === "requireAltText"), []);
  });
});
