import { strict as assert } from "assert";
import { lint } from "../src/linter";

describe("requireDocumentTitle", () => {
  it("flags documents with <html> that have no <title>", () => {
    const html = "<html><head></head><body><main>Content</main></body></html>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      results.some((r) => r.rule === "requireDocumentTitle"),
      "Expected missing title warning"
    );
  });

  it("flags empty <title> content", () => {
    const html =
      "<html><head><title>   </title></head><body><main>Content</main></body></html>";
    const results = lint(html, { forceHtml: true });
    const warning = results.find((r) => r.rule === "requireDocumentTitle");
    assert.ok(warning, "Expected empty title warning");
    assert.ok(
      warning?.message.includes("must not be empty"),
      "Expected empty title message"
    );
  });

  it("passes when <title> is present and non-empty", () => {
    const html =
      "<html><head><title>ZemDomu</title></head><body><main>Content</main></body></html>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireDocumentTitle"),
      "Did not expect title warning"
    );
  });

  it("does not accept a title outside head", () => {
    const html =
      "<html><head></head><body><title>Wrong place</title><main>Content</main></body></html>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      results.some((r) => r.rule === "requireDocumentTitle"),
      "Expected a title outside head to remain reportable"
    );
  });

  it("does not enforce when there is no <html> root", () => {
    const html = "<div><title>Fragment title</title></div>";
    const results = lint(html, { forceHtml: true });
    assert.ok(
      !results.some((r) => r.rule === "requireDocumentTitle"),
      "Did not expect title warning in fragment markup"
    );
  });

  it("accepts static and identifier JSX title content", () => {
    const jsx = `
      const pageTitle = "Dashboard";
      export default function Page() {
        return (
          <html>
            <head>
              <title>{pageTitle}</title>
            </head>
            <body>
              <main>Content</main>
            </body>
          </html>
        );
      }
    `;
    const results = lint(jsx);
    assert.ok(
      !results.some((r) => r.rule === "requireDocumentTitle"),
      "Did not expect title warning for JSX identifier content"
    );
  });
});
