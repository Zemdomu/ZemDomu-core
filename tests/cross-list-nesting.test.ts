import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cc-list-"));
  const parent = path.join(tmp, "Parent.jsx");
  const child = path.join(tmp, "Item.jsx");

  fs.writeFileSync(
    child,
    "export default function Item(){ return (<li>First item</li>); }"
  );
  fs.writeFileSync(
    parent,
    "import Item from './Item'; export default function Parent(){ return (<ul><Item /></ul>); }"
  );

  const linter = new ProjectLinter({
    crossComponentAnalysis: true,
    rules: { enforceListNesting: "error" },
  });
  const map = await linter.lintFiles([parent, child]);
  const results = Array.from(map.values()).flat();
  assert.ok(
    !results.some((r) => r.rule === "enforceListNesting"),
    "Did not expect list nesting warning for component <li> inside <ul>"
  );

  // Negative case: component used outside list should warn at usage site
  fs.writeFileSync(
    parent,
    "import Item from './Item'; export default function Parent(){ return (<div><Item /></div>); }"
  );
  linter.clear();
  const map2 = await linter.lintFiles([parent, child]);
  const results2 = Array.from(map2.entries()).flatMap(([, r]) => r);
  const parentWarnings = results2.filter(
    (r) => r.rule === "enforceListNesting" && r.filePath === parent
  );
  const childWarnings = results2.filter(
    (r) => r.rule === "enforceListNesting" && r.filePath === child
  );
  assert.ok(parentWarnings.length > 0, "Expected list nesting warning at usage site");
  assert.strictEqual(
    childWarnings.length,
    0,
    "Did not expect list nesting warning in child component"
  );
  console.log("cross-list-nesting tests passed");
})();
