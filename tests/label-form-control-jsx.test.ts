import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("requireLabelForFormControls (JSX)", () => {
  it("accepts htmlFor labels and ARIA names", () => {
    const goodCases = [
      `export default () => (<div><label htmlFor="email">Email</label><input id="email" /></div>);`,
      `export default () => (<div><input aria-label="Email" /></div>);`,
      `export default () => (<div><span id="email-label">Email</span><input aria-labelledby="email-label" /></div>);`,
      `export default () => (<label>Email <input /></label>);`,
      `export default () => (<div><input type="hidden" /><input hidden /></div>);`,
      `export default () => (<input type={"hidden"} />);`,
      `export default () => (<input type="image" alt="Search" />);`,
      `export default () => (<div><input type="submit" /><input type="reset" /><input type="button" value="Save" /></div>);`,
      `export default () => (<div><Input /><Select /><Textarea /></div>);`,
      `export default ({ props }) => (<input {...props} />);`,
    ];

    goodCases.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        !results.some((r) => r.rule === "requireLabelForFormControls"),
        `Did not expect label warning for JSX good case ${idx + 1}`
      );
    });
  });

  it("flags missing labels or empty aria-labelledby", () => {
    const badCases = [
      `export default () => (<div><input id="email" /></div>);`,
      `export default () => (<div><input /></div>);`,
      `export default () => (<div><input aria-labelledby="missing" /></div>);`,
      `export default () => (<div><span id="empty"></span><input aria-labelledby="empty" /></div>);`,
      `export default () => (<input type="image" alt="" />);`,
      `export default () => (<input type="button" value="" />);`,
      `export default () => (<label><input /></label>);`,
      `export default () => (<input hidden={false} />);`,
    ];

    badCases.forEach((code, idx) => {
      const results = lint(code);
      assert.ok(
        results.some((r) => r.rule === "requireLabelForFormControls"),
        `Expected label warning for JSX bad case ${idx + 1}`
      );
    });
  });
});
