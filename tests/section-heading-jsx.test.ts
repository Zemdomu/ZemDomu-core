import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("requireSectionHeading (JSX)", () => {
  it("accepts aria-label or aria-labelledby when no heading exists", () => {
    const passes = [
      `export default () => <section aria-label="Main content"><div /></section>;`,
      `export default () => (
        <div>
          <h2 id="title">Title</h2>
          <section aria-labelledby="title"><div /></section>
        </div>
      );`,
    ];

    passes.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        !results.some((r) => r.rule === "requireSectionHeading"),
        `Did not expect section heading warning for pass case ${idx + 1}`
      );
    });
  });

  it("flags sections without headings or accessible labels", () => {
    const failures = [
      `export default () => <section><div /></section>;`,
      `export default () => <section aria-labelledby="missing"><div /></section>;`,
      `export default () => <section aria-label=""></section>;`,
    ];

    failures.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        results.some((r) => r.rule === "requireSectionHeading"),
        `Expected section heading warning for failure case ${idx + 1}`
      );
    });
  });
});
