import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";
import { lint } from "../src/linter";

describe("singleH1 exclusive returns", () => {
  it("does not flag multiple h1 across mutually exclusive returns", () => {
    const jsx = `
      export default function Page({ show }) {
        if (show) {
          return <main><h1>One</h1></main>;
        }
        return <main><h1>Two</h1></main>;
      }
    `;
    const results = lint(jsx, { rules: { singleH1: "error" } });
    assert.ok(
      !results.some((r) => r.rule === "singleH1"),
      "Did not expect singleH1 warning for exclusive returns"
    );
  });

  it("does not flag h1 in conditional JSX branches", () => {
    const jsx = `
      export default function Page({ show }) {
        return (
          <main>
            {show ? <h1>One</h1> : <h1>Two</h1>}
          </main>
        );
      }
    `;
    const results = lint(jsx, { rules: { singleH1: "error" } });
    assert.ok(
      !results.some((r) => r.rule === "singleH1"),
      "Did not expect singleH1 warning for conditional branches"
    );
  });

  it("does not flag cross-component h1 when returns are exclusive", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-h1-returns-"));
    const a = path.join(tmp, "A.jsx");
    const b = path.join(tmp, "B.jsx");
    const page = path.join(tmp, "Page.jsx");
    fs.writeFileSync(a, "export default function A(){ return (<h1>A</h1>); }");
    fs.writeFileSync(b, "export default function B(){ return (<h1>B</h1>); }");
    fs.writeFileSync(
      page,
      "import A from './A'; import B from './B'; export default function Page({ show }){ if (show) { return (<main><A/></main>); } return (<main><B/></main>); }"
    );

    const linter = new ProjectLinter({
      crossComponentAnalysis: true,
      rules: { singleH1: "error" },
    });
    await linter.lintFile(a);
    await linter.lintFile(b);
    const map = await linter.lintFile(page);
    const results = Array.from(map.values()).flat();

    assert.ok(
      !results.some((r) => r.rule === "singleH1"),
      "Did not expect cross-component singleH1 warning for exclusive returns"
    );
  });

  it("does not flag cross-component h1 for conditional component branches", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-h1-conditional-"));
    const a = path.join(tmp, "A.jsx");
    const b = path.join(tmp, "B.jsx");
    const page = path.join(tmp, "Page.jsx");
    fs.writeFileSync(a, "export default function A(){ return (<h1>A</h1>); }");
    fs.writeFileSync(b, "export default function B(){ return (<h1>B</h1>); }");
    fs.writeFileSync(
      page,
      "import A from './A'; import B from './B'; export default function Page({ show }){ return (<main>{show ? <A/> : <B/>}</main>); }"
    );

    const linter = new ProjectLinter({
      crossComponentAnalysis: true,
      rules: { singleH1: "error" },
    });
    await linter.lintFile(a);
    await linter.lintFile(b);
    const map = await linter.lintFile(page);
    const results = Array.from(map.values()).flat();

    assert.ok(
      !results.some((r) => r.rule === "singleH1"),
      "Did not expect cross-component singleH1 warning for conditional components"
    );
  });
});
