import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src/index";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-parse-multi-"));
const badFile = path.join(tmp, "Bad.jsx");
const goodFile = path.join(tmp, "Good.html");

fs.writeFileSync(badFile, "const Foo = () => (<div></div", "utf8");
fs.writeFileSync(goodFile, "<img>", "utf8");

const linter = new ProjectLinter({ rules: { requireAltText: "error" } });

linter
  .lintFiles([badFile, goodFile])
  .then((results) => {
    const badResults = results.get(badFile) || [];
    const goodResults = results.get(goodFile) || [];

    assert.ok(
      badResults.some((r) => r.rule === "parseError"),
      "Expected parseError diagnostic for malformed JSX"
    );
    assert.ok(
      goodResults.some((r) => r.rule === "requireAltText"),
      "Expected lint results for other files"
    );
    console.log("parse-error multi-file test passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
