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

  it("still warns when <li> is not inside <ul> or <ol>", () => {
    const jsx = `export default () => <li>Orphan</li>;`;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "enforceListNesting"),
      "Expected list nesting warning for orphan <li>"
    );
  });
});
