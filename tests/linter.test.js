"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
/// <reference types="mocha" />
const assert_1 = require("assert");
const linter_1 = require("../src/linter");
describe("lint rule severity", () => {
    it("should respect severity settings", () => {
        const html = `<img src="foo.jpg">`;
        const results = (0, linter_1.lint)(html, {
            rules: {
                requireAltText: "warning",
                requireTableCaption: "off",
            },
        });
        assert_1.strict.ok(results.some((r) => r.rule === "requireAltText" && r.severity === "warning"));
        assert_1.strict.ok(!results.some((r) => r.rule === "requireTableCaption"));
    });
});
describe("lint with custom rules", () => {
    it("should apply custom rules", () => {
        const html = `<div class="custom-rule">Test</div>`;
        const results = (0, linter_1.lint)(html, {
            customRules: [
                {
                    name: "customRule",
                    test: (node) => node.type === "element" && node.tagName === "div",
                    message: "Custom rule triggered",
                },
            ],
        });
        assert_1.strict.ok(results.some((r) => r.rule === "customRule"));
    });
});
