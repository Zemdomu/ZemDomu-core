import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src";

function createRoot(parent: string, name: string, childHeading: "h1" | "h2") {
  const root = path.join(parent, name);
  const components = path.join(root, "components");
  fs.mkdirSync(components, { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "@shared/*": ["components/*"] },
      },
    }),
    "utf8"
  );
  const child = path.join(components, "Child.tsx");
  const entry = path.join(root, "Page.tsx");
  fs.writeFileSync(
    child,
    `export default function Child() { return <${childHeading}>Child</${childHeading}>; }`,
    "utf8"
  );
  fs.writeFileSync(
    entry,
    `import Child from "@shared/Child";
export default function Page() { return <main><h1>Page</h1><Child /></main>; }`,
    "utf8"
  );
  return { root, child, entry };
}

describe("multi-root ProjectLinter isolation", () => {
  it("keeps aliases and resolver caches isolated per workspace root", async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-roots-"));
    const a = createRoot(parent, "root-a", "h1");
    const b = createRoot(parent, "root-b", "h2");
    const options = {
      crossComponentAnalysis: true,
      rules: { singleH1: "warning" as const },
    };
    const linterA = new ProjectLinter({ ...options, rootDir: a.root });
    const linterB = new ProjectLinter({ ...options, rootDir: b.root });

    await linterA.lintFile(a.child);
    await linterB.lintFile(b.child);
    const resultsA = Array.from((await linterA.lintFile(a.entry)).values()).flat();
    const resultsB = Array.from((await linterB.lintFile(b.entry)).values()).flat();

    assert.ok(
      resultsA.some((result) => result.rule === "singleH1"),
      "root A should resolve its h1 child"
    );
    assert.ok(
      !resultsB.some((result) => result.rule === "singleH1"),
      "root B should resolve its h2 child without using root A caches"
    );
  });
});
