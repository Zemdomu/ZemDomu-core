import assert from "assert";
import { lint } from "../src/linter";

describe("requireNavLinks with link components", () => {
  it("accepts Link components with to", () => {
    const jsx = `
      export default function Nav() {
        return (
          <nav>
            <Link to="/home">Home</Link>
          </nav>
        );
      }
    `;
    const results = lint(jsx, { rules: { requireNavLinks: "error" } });
    assert.ok(
      !results.some((r) => r.rule === "requireNavLinks"),
      "Did not expect requireNavLinks warning for Link components"
    );
  });

  it("accepts a nav wrapper that forwards its children through props", () => {
    const results = lint(`export default ({ props }) => <nav {...props} />;`, {
      rules: { requireNavLinks: "error" },
    });
    assert.ok(!results.some((r) => r.rule === "requireNavLinks"));
  });

  it("accepts custom elements with to/href in HTML mode", () => {
    const html = `<nav><router-link to="/home"></router-link></nav>`;
    const results = lint(html, { rules: { requireNavLinks: "error" }, forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireNavLinks"),
      "Did not expect requireNavLinks warning for router-link"
    );
  });
});
