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

  it("resumes enable directives after self-closing SVG title, script and style elements", () => {
    for (const tag of ["title", "script", "style"]) {
      const content = `<!-- zemdomu-disable requireAltText --><svg><${tag} /></svg>\n<!-- zemdomu-enable requireAltText -->\n<img>`;
      const findings = missingAlt(content);
      assert.strictEqual(findings.length, 1, tag);
      assert.strictEqual(findings[0].offset, content.lastIndexOf("<img>"), tag);
      assert.strictEqual(findings[0].line, 2, tag);
    }
  });

  it("recognizes actual comments inside an ordinary SVG title", () => {
    const content = '<svg><title><!-- zemdomu-disable requireAltText --></title></svg>\n<img>';
    assert.deepStrictEqual(missingAlt(content), []);
  });

  it("does not let a self-closing foreign integration point change its sibling namespace", () => {
    const content = '<svg><foreignObject /><g><title><!-- zemdomu-disable requireAltText --></title></g></svg><img>';
    assert.deepStrictEqual(missingAlt(content), []);
  });

  it("retains HTML raw-text behavior for textarea and title with trailing slashes", () => {
    for (const tag of ["textarea", "title"]) {
      const prefix = `<${tag} /><!-- zemdomu-disable requireAltText --></${tag}>\n`;
      const findings = missingAlt(prefix + "<img>");
      assert.strictEqual(findings.length, 1, tag);
      assert.strictEqual(findings[0].offset, prefix.length, tag);
    }
  });

  it("retains HTML raw text within SVG HTML integration points and resumes after SVG", () => {
    for (const integration of ["foreignObject", "desc", "title"]) {
      const prefix = `<svg><${integration}><textarea /><!-- zemdomu-disable requireAltText --></textarea></${integration}></svg>\n`;
      const findings = missingAlt(prefix + "<img>");
      assert.strictEqual(findings.length, 1, integration);
      assert.strictEqual(findings[0].offset, prefix.length, integration);
    }
  });

  it("restores nested SVG context inside an HTML foreignObject", () => {
    const content = '<svg><foreignObject><div><svg><title /></svg></div></foreignObject></svg>\n<!-- zemdomu-disable requireAltText -->\n<img>';
    assert.deepStrictEqual(missingAlt(content), []);
  });

  it("distinguishes a foreign self-closing slash from an unquoted attribute value slash", () => {
    const prefix = '<svg><foreignObject data=x/><textarea><!-- zemdomu-disable requireAltText --></textarea></foreignObject></svg>\n';
    const findings = missingAlt(prefix + "<img>");
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].offset, prefix.length);
    assert.deepStrictEqual(missingAlt('<svg><title data="/>" /></svg><!-- zemdomu-disable requireAltText --><img>'), []);
  });

  it("applies HTML raw text within MathML text integration points but not their foreign exceptions", () => {
    for (const tag of ["mi", "mo", "mn", "ms", "mtext"]) {
      const prefix = `<math><${tag}><textarea><!-- zemdomu-disable requireAltText --></textarea></${tag}></math>\n`;
      assert.strictEqual(missingAlt(prefix + "<img>").length, 1, tag);
    }
    for (const tag of ["mglyph", "malignmark"]) {
      const content = `<math><mtext><${tag}><title><!-- zemdomu-disable requireAltText --></title></${tag}></mtext></math><img>`;
      assert.deepStrictEqual(missingAlt(content), [], tag);
    }
  });

  it("recognizes static annotation-xml encoding integration without borrowing attribute-value text", () => {
    for (const attrs of ['encoding="text/html"', "ENCODING='APPLICATION/XHTML+XML'", "encoding=text/html"]) {
      const prefix = `<math><annotation-xml ${attrs}><textarea><!-- zemdomu-disable requireAltText --></textarea></annotation-xml></math>\n`;
      assert.strictEqual(missingAlt(prefix + "<img>").length, 1, attrs);
    }
    for (const attrs of ["", 'encoding="application/xml"', `data='encoding="text/html"'`]) {
      const content = `<math><annotation-xml ${attrs}><title><!-- zemdomu-disable requireAltText --></title></annotation-xml></math><img>`;
      assert.deepStrictEqual(missingAlt(content), [], attrs);
    }
    assert.deepStrictEqual(missingAlt('<math><annotation-xml><svg><title /></svg></annotation-xml></math><!-- zemdomu-disable requireAltText --><img>'), []);
  });

  it("continues past malformed attributes without rescanning their whitespace prefix", () => {
    const content = "<svg" + " ".repeat(10000) + "//><!-- zemdomu-disable requireAltText --></svg><img>";
    assert.deepStrictEqual(missingAlt(content), []);
  });

  it("restores HTML raw text when an HTML breakout tag exits foreign content", () => {
    for (const start of ["<div>", "<p>", '<font color="red">', "</p>", "</br>"]) {
      const prefix = `<svg><g>${start}<textarea><!-- zemdomu-disable requireAltText --></textarea>\n`;
      const findings = missingAlt(prefix + "<img>");
      assert.strictEqual(findings.length, 1, start);
      assert.strictEqual(findings[0].offset, prefix.length, start);
    }
    assert.deepStrictEqual(missingAlt('<svg><font><title><!-- zemdomu-disable requireAltText --></title></font></svg><img>'), []);
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
