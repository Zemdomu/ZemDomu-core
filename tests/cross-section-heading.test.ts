import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cc-section-"));
  const parent = path.join(tmp, "Parent.jsx");
  const child = path.join(tmp, "Heading.jsx");

  fs.writeFileSync(
    child,
    "export default function Heading(){ return (<div><h3>Hello</h3></div>); }"
  );
  fs.writeFileSync(
    parent,
    "import Heading from './Heading'; export default function Parent(){ return (<section><Heading /></section>); }"
  );

  const linter = new ProjectLinter({
    crossComponentAnalysis: true,
    rules: { requireSectionHeading: "error" },
  });
  const map = await linter.lintFiles([parent, child]);
  const results = Array.from(map.values()).flat();
  assert.ok(
    !results.some((r) => r.rule === "requireSectionHeading"),
    "Did not expect section heading warning for component heading"
  );

  // Nested section heading should not satisfy parent section
  fs.writeFileSync(
    child,
    "export default function Heading(){ return (<section><h3>Hello</h3></section>); }"
  );
  linter.clear();
  const map2 = await linter.lintFiles([parent, child]);
  const results2 = Array.from(map2.values()).flat();
  const parentWarnings = results2.filter(
    (r) => r.rule === "requireSectionHeading" && r.filePath === parent
  );
  assert.ok(
    parentWarnings.length > 0,
    "Expected section heading warning when child heading is inside nested section"
  );
  console.log("cross-section-heading tests passed");
})();
