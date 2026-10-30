import assert from "assert";
import { lint } from "../src";

function languageFindings(attribute: string, jsx = false) {
  const document = `<html${attribute}><head><title>Language test</title></head><body><main>Content</main></body></html>`;
  const source = jsx ? `export default () => (${document});` : document;
  return lint(source, { forceHtml: !jsx, rules: { requireHtmlLang: "error" } })
    .filter((finding) => finding.rule === "requireHtmlLang");
}

describe("document language-tag contracts", () => {
  // RFC 5646 section 2.1 and Appendix A: syntax, not registry/canonicalization checks.
  const valid = ["zh-Hant", "sr-Latn-RS", "es-419", "de-CH-1901", "sl-rozaj-biske",
    "zh-cmn-Hans-CN", "en-US-u-ca-gregory", "en-a-myext-b-another", "en-x-company-1", "x-private", "EN-us"];
  for (const jsx of [false, true]) {
    const syntax = jsx ? "JSX" : "HTML";
    it(`accepts script, region, variant, extension and private-use tags in ${syntax}`, () => {
      for (const tag of valid) {
        assert.deepStrictEqual(languageFindings(` lang="${tag}"`, jsx), [], tag);
      }
    });
    it(`rejects incomplete and malformed subtags with an error in ${syntax}`, () => {
      for (const tag of ["en--US", "en-", "-en", "e", "123", "en-12", "en-abcde!", "en-u", "en-u-a", "en-x", "x", "x-123456789", "en-US-extra1234"]) {
        const findings = languageFindings(` lang="${tag}"`, jsx);
        assert.strictEqual(findings.length, 1, tag);
        assert.strictEqual(findings[0].message, "<html> lang attribute is invalid", tag);
        assert.strictEqual(findings[0].severity, "error", tag);
      }
    });
    it(`distinguishes a missing language from an empty language in ${syntax}`, () => {
      assert.strictEqual(languageFindings("", jsx)[0]?.message, "<html> element missing lang attribute");
      for (const attr of [' lang=""', ' lang="   "', " lang"]) {
        assert.strictEqual(languageFindings(attr, jsx)[0]?.message, "<html> lang attribute is empty", attr);
      }
    });
  }
  for (const jsx of [false, true]) {
    it(`accepts RFC 5646 grandfathered tags case-insensitively in ${jsx ? "JSX" : "HTML"}`, () => {
      // Independent fixed list from RFC 5646 Figure 1, including regular and irregular forms.
      const tags = ["en-GB-oed", "i-ami", "i-bnn", "i-default", "i-enochian", "i-hak",
        "i-klingon", "i-lux", "i-mingo", "i-navajo", "i-pwn", "i-tao", "i-tay", "i-tsu",
        "sgn-BE-FR", "sgn-BE-NL", "sgn-CH-DE", "art-lojban", "cel-gaulish", "no-bok",
        "no-nyn", "zh-guoyu", "zh-hakka", "zh-min", "zh-min-nan", "zh-xiang"];
      for (const tag of tags) {
        assert.deepStrictEqual(languageFindings(` lang="${tag}"`, jsx), [], tag);
        assert.deepStrictEqual(languageFindings(` lang="${tag.toUpperCase()}"`, jsx), [], tag);
      }
      for (const tag of ["i-invented", "i-klingon-extra", "sgn-BE-FR-extra"]) {
        assert.strictEqual(languageFindings(` lang="${tag}"`, jsx)[0]?.message,
          "<html> lang attribute is invalid", tag);
      }
    });
    it(`rejects repeated extension singletons without restricting private use in ${jsx ? "JSX" : "HTML"}`, () => {
      for (const tag of ["en-a-bbb-a-ccc", "en-A-bbb-a-ccc", "en-u-ca-gregory-U-nu-latn", "en-0-ab-0-cd"]) {
        assert.strictEqual(languageFindings(` lang="${tag}"`, jsx)[0]?.message,
          "<html> lang attribute is invalid", tag);
      }
      for (const tag of ["en-a-bbb-b-ccc", "en-a-bbb-x-a-ccc", "x-a-a", "en-0-ab-1-cd"]) {
        assert.deepStrictEqual(languageFindings(` lang="${tag}"`, jsx), [], tag);
      }
    });
  }
  it("does not validate runtime Vue bindings as literal language tags", () => {
    for (const attr of [' :lang="locale.code"', ' v-bind:lang="currentLocale"']) {
      assert.deepStrictEqual(languageFindings(attr), []);
    }
    assert.strictEqual(languageFindings(' :lang="  "')[0]?.message, "<html> lang attribute is empty");
  });
  it("distinguishes literal JSX expressions from conditional empty language values", () => {
    assert.deepStrictEqual(languageFindings(' lang={"sr-Latn"}', true), []);
    assert.deepStrictEqual(languageFindings(' lang={locale}', true), []);
    assert.strictEqual(languageFindings(' lang={ready ? "en" : ""}', true)[0]?.message,
      "<html> lang is possibly empty or undefined");
    assert.strictEqual(languageFindings(' lang={null}', true)[0]?.message, "<html> lang attribute is empty");
  });
});
