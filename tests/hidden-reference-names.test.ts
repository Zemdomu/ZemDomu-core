import assert from "assert";
import { lint } from "../src";

const targets = [
  { tag: "button", rule: "requireButtonText" },
  { tag: "a", rule: "requireLinkText" },
  { tag: "section", rule: "requireSectionHeading" },
  { tag: "input", rule: "requireLabelForFormControls" },
  { tag: "select", rule: "requireLabelForFormControls" },
  { tag: "textarea", rule: "requireLabelForFormControls" },
  { tag: "svg", rule: "requireAltText" },
];

describe("directly referenced hidden accessible names", () => {
  // W3C Accname 1.2, Hidden Not Referenced: hidden referenced roots include their
  // hidden subtree; a visible referenced root still excludes hidden descendants.
  for (const jsx of [false, true]) {
    const syntax = jsx ? "JSX" : "HTML";
    for (const { tag, rule } of targets) {
      const control = tag === "input"
        ? `<input aria-labelledby="name"${jsx ? " /" : ""}>`
        : `<${tag}${tag === "a" ? ' href="/"' : tag === "svg" ? ' role="img"' : ""} aria-labelledby="name"></${tag}>`;
      function count(label: string): number {
        const markup = control + label;
        const source = jsx ? `export default () => (<>${markup}</>);` : markup;
        const results = lint(source, { forceHtml: !jsx });
        assert.ok(!results.some((result) => result.rule === "parseError"), source);
        return results.filter((result) => result.rule === rule).length;
      }
      it(`uses a directly referenced hidden label for ${syntax} ${tag}`, () => {
        const hiddenAttrs = jsx ? ["hidden", 'hidden="hidden"', "hidden={true}", 'aria-hidden="true"'] : ["hidden", 'hidden=""', 'aria-hidden="true"', 'style="display:none"'];
        for (const attr of hiddenAttrs) {
          assert.strictEqual(count(`<span id="name" ${attr}>Account</span>`), 0, attr);
          assert.strictEqual(count(`<span id="name" ${attr}><span hidden>Account</span></span>`), 0, `${attr}: nested hidden text`);
          assert.strictEqual(count(`<span id="name" ${attr}><span hidden> </span></span>`), 1, `${attr}: no text`);
        }
      });
      it(`keeps hidden descendants out of a visible label for ${syntax} ${tag}`, () => {
        assert.strictEqual(count('<span id="name"><span hidden>Account</span></span>'), 1);
        assert.strictEqual(count('<span id="name"><span aria-hidden="true">Account</span></span>'), 1);
        assert.strictEqual(count('<span id="name"><span hidden>Decoration</span>Account</span>'), 0);
        assert.strictEqual(count('<span id="other" hidden>Account</span>'), 1, "unresolved target must not borrow unrelated text");
        if (jsx) {
          // React's boolean hidden prop removes the attribute for an empty string.
          assert.strictEqual(count('<span id="name" hidden=""><span hidden>Account</span></span>'), 1,
            "an empty JSX string must not authorize hidden subtree inclusion");
          assert.strictEqual(count('<span id="name" hidden="">Account</span>'), 0,
            "an empty JSX hidden string leaves visible text available");
          assert.strictEqual(count('<span id="name"><span hidden="">Account</span></span>'), 0,
            "ordinary descendants with an empty JSX hidden string remain visible");
          assert.strictEqual(count('<span id="name" hidden>{<><span hidden>Account</span></>}</span>'), 0,
            "hidden-root inclusion propagates through expression containers and fragments");
          assert.strictEqual(count('<span id="name" hidden={false}><span hidden>Account</span></span>'), 1,
            "a literal false hidden flag must not authorize including hidden descendants");
          assert.strictEqual(count('<span id="name" hidden={isHidden}><span hidden>Account</span></span>'), 1,
            "an unknown hidden flag must not authorize including hidden descendants");
        }
      });
    }
  }
});
