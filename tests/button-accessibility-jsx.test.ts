import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("requireButtonText (JSX accessible name)", () => {
  it("accepts buttons with aria-label, aria-labelledby, or content text", () => {
    const passes = [
      `export default () => <button aria-label="Close"></button>;`,
      `export default () => (
        <div>
          <span id="label">Close</span>
          <button aria-labelledby="label"></button>
        </div>
      );`,
      `export default () => <button>Save</button>;`,
      `export default () => <button><span>Save</span></button>;`,
      `export default () => <button><img alt="Close" /></button>;`,
      `export default () => <button><span className="sr-only">Hidden label</span></button>;`,
      `export default () => <button title="Close"></button>;`,
      `export default ({ props }) => <button {...props}></button>;`,
      `export default () => <Button></Button>;`,
      `export default () => (
        <div>
          <span id="first">Save</span>
          <span id="second"></span>
          <button aria-labelledby="first second"></button>
        </div>
      );`,
    ];

    passes.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        !results.some((r) => r.rule === "requireButtonText"),
        `Did not expect requireButtonText warning for pass case ${idx + 1}`
      );
    });
  });

  it("flags buttons without a provable accessible name", () => {
    const failures = [
      `export default () => <button></button>;`,
      `export default () => <button aria-label=""></button>;`,
      `export default () => <button aria-labelledby="missing"></button>;`,
      `export default () => (
        <div>
          <span id="empty"></span>
          <button aria-labelledby="empty"></button>
        </div>
      );`,
      `export default () => <button><svg /></button>;`,
      `export default () => <button><span aria-hidden="true">Hidden</span></button>;`,
      `export default () => <button><img alt="" /></button>;`,
      `export default () => <button><img alt={label} /></button>;`,
    ];

    failures.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        results.some((r) => r.rule === "requireButtonText"),
        `Expected requireButtonText warning for failure case ${idx + 1}`
      );
    });
  });
});
