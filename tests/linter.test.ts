/// <reference types="node" />
/// <reference types="mocha" />
import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("lint rule severity", () => {
  it("should respect severity settings", () => {
    const html = `<img src="foo.jpg">`;
    const results = lint(html, {
      rules: {
        requireAltText: "warning",
        requireTableCaption: "off",
      },
    });
    assert.ok(
      results.some(
        (r) => r.rule === "requireAltText" && r.severity === "warning"
      )
    );
    assert.ok(!results.some((r) => r.rule === "requireTableCaption"));
  });
});

describe("lint with custom rules", () => {
  it("should apply custom rules", () => {
    const html = `<div class="custom-rule">Test</div>`;
    const results = lint(html, {
      customRules: [
        {
          name: "customRule",
          test: (node: any) =>
            // HTML node
            (node.type === "element" && node.tagName === "div") ||
            // Babel JSX node
            (node.type === "JSXElement" &&
              node.openingElement &&
              node.openingElement.name &&
              node.openingElement.name.name === "div"),
          message: "Custom rule triggered",
        },
      ],
    });
    assert.ok(results.some((r) => r.rule === "customRule"));
  });
});
