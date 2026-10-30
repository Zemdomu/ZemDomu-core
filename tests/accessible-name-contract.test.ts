import assert from "assert";
import { lint, type LintResult } from "../src";

type Target = { tag: "button" | "a" | "section"; rule: string; message: string };
const targets: Target[] = [
  { tag: "button", rule: "requireButtonText", message: "<button> missing accessible text" },
  { tag: "a", rule: "requireLinkText", message: "<a> missing accessible name" },
  { tag: "section", rule: "requireSectionHeading", message: "<section> missing heading (<h1>-<h6>) or accessible label (aria-label / aria-labelledby)" },
];
function findings(source: string, target: Target, jsx: boolean): LintResult[] {
  const results = lint(source, { forceHtml: !jsx, rules: { [target.rule]: "error" } });
  assert.ok(!results.some((finding) => finding.rule === "parseError"), source);
  return results.filter((finding) => finding.rule === target.rule);
}
function wrap(markup: string, jsx: boolean): string {
  return jsx ? `export default () => (<>${markup}</>);` : markup;
}
function element(target: Target, attrs: string, content = ""): string {
  return `<${target.tag}${target.tag === "a" ? ' href="/docs"' : ""}${attrs}>${content}</${target.tag}>`;
}

// W3C Accname 1.1 section 4.3: these are static lint contracts, not a full browser name computation.
// Hidden content tests concern ordinary descendants, never directly referenced hidden labels.
describe("accessible-name edge contracts", () => {
  for (const jsx of [false, true]) {
    const syntax = jsx ? "JSX" : "HTML";
    for (const target of targets) {
      it(`resolves forward ID references and skips missing/empty IDs for ${syntax} ${target.tag}`, () => {
        const markup = element(target, ' aria-labelledby="missing blank name"') +
          '<span id="blank"> </span><span id="name"><span>Account</span></span>';
        assert.deepStrictEqual(findings(wrap(markup, jsx), target, jsx), []);
        const unnamed = wrap(element(target, ' aria-labelledby="missing blank"') + '<span id="blank"> </span>', jsx);
        const result = findings(unnamed, target, jsx);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].message, target.message);
        assert.strictEqual(result[0].severity, "error");
        assert.strictEqual(result[0].offset, unnamed.indexOf(`<${target.tag}`));
      });
      it(`uses image alternatives in referenced names for ${syntax} ${target.tag}`, () => {
        for (const alt of ["Account", ""]) {
          const source = wrap(element(target, ' aria-labelledby="icon"') + `<span id="icon"><img alt="${alt}"${jsx ? " /" : ""}></span>`, jsx);
          assert.strictEqual(findings(source, target, jsx).length, alt ? 0 : 1, source);
        }
      });
    }
    for (const target of targets.filter((candidate) => candidate.tag !== "section")) {
      it(`excludes hidden descendants but preserves a visible sibling in ${syntax} ${target.tag}`, () => {
        for (const hidden of (jsx ? ["hidden", 'aria-hidden="true"'] : ["hidden", 'aria-hidden="true"', 'style="display: none"', 'style="visibility: hidden"', 'style="visibility: collapse"'])) {
          const invisible = `<span ${hidden}>Invisible name</span>`;
          const source = wrap(element(target, "", invisible) + "\n" + element(target, "", invisible + "Visible name"), jsx);
          const result = findings(source, target, jsx);
          assert.strictEqual(result.length, 1, source);
          assert.strictEqual(result[0].offset, source.indexOf(`<${target.tag}`), source);
          assert.strictEqual(result[0].message, target.message);
        }
      });
      it(`ignores controls hidden from assistive technology in ${syntax} ${target.tag}`, () => {
        for (const hidden of (jsx ? ["hidden", 'aria-hidden=" TRUE "'] : ["hidden", 'aria-hidden=" TRUE "', 'style="DISPLAY: none"', 'style="visibility:collapse"'])) {
          assert.deepStrictEqual(findings(wrap(element(target, ` ${hidden}`), jsx), target, jsx), []);
        }
      });
      it(`reports only the unnamed image control in ${syntax} ${target.tag}`, () => {
        const source = wrap(element(target, "", `<img alt=""${jsx ? " /" : ""}>`) + "\n" +
          element(target, "", `<img alt="Download report"${jsx ? " /" : ""}>`), jsx);
        const result = findings(source, target, jsx);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].offset, source.indexOf(`<${target.tag}`));
      });
    }
  }
  for (const target of targets.filter((candidate) => candidate.tag !== "section")) {
    it(`evaluates static JSX child expressions and fragments for ${target.tag}`, () => {
      const present = ['{"Save"}', '{`Save`}', '{<span>Save</span>}', '{<>Save</>}', '<>{"Save"}</>'];
      for (const content of present) assert.deepStrictEqual(findings(wrap(element(target, "", content), true), target, true), [], content);
      for (const content of ["{null}", "{false}", '{""}', "{undefined}"]) {
        const result = findings(wrap(element(target, "", content), true), target, true);
        assert.strictEqual(result.length, 1, content);
        assert.strictEqual(result[0].message, target.message, content);
      }
    });
    it(`treats false JSX hidden flags as visible for ${target.tag}`, () => {
      for (const attrs of [" hidden={false}", " aria-hidden={false}", ' aria-hidden={"false"}']) {
        assert.strictEqual(findings(wrap(element(target, attrs), true), target, true).length, 1, attrs);
      }
    });
  }
});
