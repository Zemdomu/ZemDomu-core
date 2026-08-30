import { strict as assert } from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";

describe("html file classification", () => {
  it("treats framework host index.html as an app shell for document rules", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-html-shell-"));
    const file = path.join(tmp, "index.html");
    fs.writeFileSync(
      file,
      `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
  </head>
  <body>
    <div id="app">{{ message }}</div>
    <img src="/logo.png">
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      "utf8"
    );

    const linter = new ProjectLinter({
      rules: {
        requireAltText: "error",
        requireHtmlLang: "error",
        requireDocumentTitle: "error",
        requireSingleMain: "error",
      },
    });
    const map = await linter.lintFile(file);
    const results = map.get(file) ?? [];

    assert.ok(
      results.some((r) => r.rule === "requireAltText"),
      "Expected element-level checks to stay enabled"
    );
    assert.ok(
      !results.some((r) => r.rule === "requireHtmlLang"),
      "Did not expect lang warnings for framework host index.html"
    );
    assert.ok(
      !results.some((r) => r.rule === "requireDocumentTitle"),
      "Did not expect title warnings for framework host index.html"
    );
    assert.ok(
      !results.some((r) => r.rule === "requireSingleMain"),
      "Did not expect main landmark warnings for framework host index.html"
    );
    assert.ok(
      !results.some((r) => r.rule === "parseError"),
      "Did not expect JSX/Vue parse errors for HTML files"
    );
  });

  it("still enforces document rules for normal html pages", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-html-page-"));
    const file = path.join(tmp, "index.html");
    fs.writeFileSync(
      file,
      `<!doctype html>
<html>
  <head></head>
  <body><section>Content</section></body>
</html>
`,
      "utf8"
    );

    const linter = new ProjectLinter({
      rules: {
        requireHtmlLang: "error",
        requireDocumentTitle: "error",
        requireSingleMain: "error",
      },
    });
    const map = await linter.lintFile(file);
    const results = map.get(file) ?? [];

    assert.ok(
      results.some((r) => r.rule === "requireHtmlLang"),
      "Expected lang warning for a normal HTML page"
    );
    assert.ok(
      results.some((r) => r.rule === "requireDocumentTitle"),
      "Expected title warning for a normal HTML page"
    );
    assert.ok(
      results.some((r) => r.rule === "requireSingleMain"),
      "Expected main landmark warning for a normal HTML page"
    );
  });

  it("recognizes Next.js root-layout metadata and deferred page landmarks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-next-layout-"));
    const appDir = path.join(tmp, "app");
    fs.mkdirSync(appDir);
    const file = path.join(appDir, "layout.tsx");
    fs.writeFileSync(
      file,
      `export const metadata = { title: "Store" };
       export default function Layout({ children }) {
         return <html lang="en"><body>{children}</body></html>;
       }`,
      "utf8"
    );

    const linter = new ProjectLinter({
      rules: {
        requireDocumentTitle: "error",
        requireSingleMain: "error",
      },
    });
    const map = await linter.lintFile(file);
    const results = map.get(file) ?? [];

    assert.ok(!results.some((r) => r.rule === "requireDocumentTitle"));
    assert.ok(!results.some((r) => r.rule === "requireSingleMain"));
  });

  it("still reports duplicate main landmarks in a Next.js root layout", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-next-layout-main-"));
    const appDir = path.join(tmp, "app");
    fs.mkdirSync(appDir);
    const file = path.join(appDir, "layout.tsx");
    fs.writeFileSync(
      file,
      `export const metadata = { title: "Store" };
       export default function Layout() {
         return <html lang="en"><body><main>One</main><main>Two</main></body></html>;
       }`,
      "utf8"
    );
    const results = (await new ProjectLinter().lintFile(file)).get(file) ?? [];
    assert.ok(results.some((r) => r.rule === "requireSingleMain"));
  });
});
