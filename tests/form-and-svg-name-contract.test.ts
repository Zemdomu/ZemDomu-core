import assert from "assert";
import { lint } from "../src";

function check(markup: string, jsx: boolean, rule: string) {
  const source = jsx ? `export default () => (<>${markup}</>);` : markup;
  const findings = lint(source, { forceHtml: !jsx, rules: { [rule]: "error" } });
  assert.ok(!findings.some((finding) => finding.rule === "parseError"), source);
  return { source, findings: findings.filter((finding) => finding.rule === rule) };
}

describe("form and SVG accessible-name contracts", () => {
  for (const jsx of [false, true]) {
    const syntax = jsx ? "JSX" : "HTML";
    it(`names each form-control kind through a later ARIA target in ${syntax}`, () => {
      for (const tag of ["input", "select", "textarea"]) {
        const control = tag === "input" ? `<input aria-labelledby="missing empty label"${jsx ? " /" : ""}>` : `<${tag} aria-labelledby="missing empty label"></${tag}>`;
        const empty = '<span id="empty"> </span>';
        for (const label of ['<span id="label"><span>Country</span></span>', `<span id="label"><img alt="Country"${jsx ? " /" : ""}></span>`]) {
          assert.deepStrictEqual(check(control + empty + label, jsx, "requireLabelForFormControls").findings, []);
        }
        const { source, findings } = check(control + empty, jsx, "requireLabelForFormControls");
        assert.strictEqual(findings.length, 1, tag);
        assert.strictEqual(findings[0].message, "Form control missing id or aria-label");
        assert.strictEqual(findings[0].offset, source.indexOf(`<${tag}`));
      }
    });
    it(`does not let a closed implicit label name a following control in ${syntax}`, () => {
      const { source, findings } = check('<label>Country <select></select></label>\n<textarea></textarea>', jsx, "requireLabelForFormControls");
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].offset, source.indexOf("<textarea>"));
    });
    it(`uses image alternatives inside implicit labels in ${syntax}`, () => {
      for (const alt of ["Search", ""]) {
        const { findings } = check(`<label><img alt="${alt}"${jsx ? " /" : ""}><input${jsx ? " /" : ""}></label>`, jsx, "requireLabelForFormControls");
        assert.strictEqual(findings.length, alt ? 0 : 1, alt);
      }
    });
    it(`anchors the unmatched explicit-label diagnostic to its control in ${syntax}`, () => {
      const markup = `<label ${jsx ? "htmlFor" : "for"}="another">Email</label>\n<input id="email"${jsx ? " /" : ""}>`;
      const { source, findings } = check(markup, jsx, "requireLabelForFormControls");
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].message, 'Form control with id="email" missing <label for="email">');
      assert.strictEqual(findings[0].offset, source.indexOf("<input"));
      assert.strictEqual(findings[0].severity, "error");
    });
    it(`requires an SVG image name when references and title are empty in ${syntax}`, () => {
      for (const label of ["", "Map"]) {
        const markup = `<svg role="img" aria-labelledby="missing blank label"><title></title></svg><span id="blank"> </span><span id="label"><span>${label}</span></span>`;
        const { source, findings } = check(markup, jsx, "requireAltText");
        assert.strictEqual(findings.length, label ? 0 : 1);
        if (!label) {
          assert.strictEqual(findings[0].message, "<svg> missing accessible name");
          assert.strictEqual(findings[0].offset, source.indexOf("<svg"));
        }
      }
    });
    it(`distinguishes empty from direct SVG title text in ${syntax}`, () => {
      for (const title of [" ", "Company logo"]) {
        assert.strictEqual(check(`<svg role="img"><title>${title}</title></svg>`, jsx, "requireAltText").findings.length, title.trim() ? 0 : 1);
      }
    });
    it(`accepts a named icon-only parent and requires a name for its unnamed twin in ${syntax}`, () => {
      const markup = '<button aria-label="Open menu"><svg></svg></button>\n<button><svg></svg></button>';
      const { source, findings } = check(markup, jsx, "requireAltText");
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].offset, source.lastIndexOf("<svg"));
    });
    it(`exempts SVGs explicitly hidden from assistive technology in ${syntax}`, () => {
      for (const attr of ["hidden", 'aria-hidden="true"']) {
        assert.deepStrictEqual(check(`<svg role="img" ${attr}></svg>`, jsx, "requireAltText").findings, []);
      }
    });
  }
  it("does not treat null or undefined JSX hidden flags as actually hidden inputs", () => {
    for (const attr of ["hidden={null}", "hidden={undefined}"]) {
      assert.strictEqual(check(`<input ${attr} />`, true, "requireLabelForFormControls").findings.length, 1, attr);
    }
  });
  it("accepts a JSX template literal input type but still checks a blank button value", () => {
    assert.deepStrictEqual(check('<input type={`hidden`} />', true, "requireLabelForFormControls").findings, []);
    assert.strictEqual(check('<input type={`button`} value={""} />', true, "requireLabelForFormControls").findings.length, 1);
  });
});
