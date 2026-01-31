import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("preventZemdomuPlaceholders (JSX)", () => {
  it("ignores JSX without TODO-ZMD", () => {
    const passes = [
      `export default () => <button aria-label="Close"></button>;`,
      `export default () => <span>Ready</span>;`,
      `export default () => <div data-note="todo"></div>;`,
      `export default () => <input aria-label={label} />;`,
    ];

    passes.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        !results.some((r) => r.rule === "preventZemdomuPlaceholders"),
        `Did not expect placeholder warning for pass case ${idx + 1}`
      );
    });
  });

  it("flags TODO-ZMD in JSX text and attributes", () => {
    const failures = [
      `export default () => <button aria-label="TODO-ZMD"></button>;`,
      `export default () => <span>TODO-ZMD</span>;`,
      `export default () => <label htmlFor="TODO-ZMD">TODO-ZMD</label>;`,
      `export default () => <span>{"TODO-ZMD"}</span>;`,
      `export default () => <span>{\`TODO-ZMD\`}</span>;`,
      `export default () => <p>{\`TODO-ZMD\`}</p>;`,
      `export default () => <label htmlFor={"TODO-ZMD"}>{\`TODO-ZMD\`}</label>;`,
      `export default () => <input aria-label={\`TODO-ZMD\`} />;`,
    ];

    failures.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        results.some((r) => r.rule === "preventZemdomuPlaceholders"),
        `Expected placeholder warning for failure case ${idx + 1}`
      );
    });
  });
});
