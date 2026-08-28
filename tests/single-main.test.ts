import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("requireSingleMain", () => {
  it("flags documents with <html> that have no <main>", () => {
    const html =
      "<html><head><title>ZemDomu</title></head><body><section>Content</section></body></html>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      results.some((r) => r.rule === "requireSingleMain"),
      "Expected missing main warning"
    );
  });

  it("flags documents with multiple <main> landmarks", () => {
    const html =
      "<html><head><title>ZemDomu</title></head><body><main>One</main><main>Two</main></body></html>";
    const results = lint(html, { forceHtml: true });
    const warning = results.find((r) => r.rule === "requireSingleMain");
    assert.ok(warning, "Expected duplicate main warning");
    assert.ok(
      warning?.message.includes("Only one <main>"),
      "Expected duplicate main message"
    );
  });

  it("reports every extra main at a distinct location", () => {
    const html =
      "<html><head><title>ZemDomu</title></head><body><main>One</main><main>Two</main><main>Three</main></body></html>";
    const results = lint(html, { forceHtml: true }).filter(
      (result) => result.rule === "requireSingleMain"
    );
    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(
      results.map((result) => result.offset),
      [html.indexOf("<main>Two"), html.indexOf("<main>Three")]
    );
  });

  it("passes when exactly one <main> exists in an html document", () => {
    const html =
      "<html><head><title>ZemDomu</title></head><body><main>Only main</main></body></html>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireSingleMain"),
      "Did not expect main warning"
    );
  });

  it("does not enforce when there is no html root", () => {
    const html = "<main>Standalone snippet</main>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireSingleMain"),
      "Did not expect main warning for snippet"
    );
  });

  it("flags duplicate main in JSX documents", () => {
    const jsx = `
      export default function Page() {
        return (
          <html>
            <head><title>ZemDomu</title></head>
            <body>
              <main>One</main>
              <main>Two</main>
            </body>
          </html>
        );
      }
    `;
    const results = lint(jsx);
    assert.ok(
      results.some((r) => r.rule === "requireSingleMain"),
      "Expected JSX duplicate main warning"
    );
  });
});
