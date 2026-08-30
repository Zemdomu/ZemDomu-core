import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("list nesting with JSX expressions", () => {
  it("allows <li> returned from map inside <ul>", () => {
    const jsx = `
      const holdings = [{ id: 1, asset: { id: "btc" } }];
      export default function Holdings() {
        return (
          <ul className="mt-4 space-y-3">
            {holdings.map((holding) => (
              <li key={holding.asset.id}>{holding.asset.id}</li>
            ))}
          </ul>
        );
      }
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "enforceListNesting"),
      "Did not expect list nesting warning for mapped <li> inside <ul>"
    );
  });

  it("does not assume a root <li> component is orphaned", () => {
    const jsx = `export default () => <li>Composed item</li>;`;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "enforceListNesting"),
      "Did not expect a warning when the consumer supplies the parent"
    );
  });

  it("still warns when a known JSX parent is not a list", () => {
    const jsx = `export default () => <div><li>Orphan</li></div>;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "enforceListNesting"),
      "Expected list nesting warning for a known non-list parent"
    );
  });
});
