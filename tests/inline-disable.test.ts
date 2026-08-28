import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { ProjectLinter } from "../src";

async function lintTempFile(name: string, content: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-inline-"));
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, content, "utf8");
  const linter = new ProjectLinter({
    rules: {
      requireAltText: "error",
      requireHrefOnAnchors: "error",
    },
  });
  const results = (await linter.lintFile(filePath)).get(filePath) ?? [];
  return { content, results };
}

describe("ProjectLinter inline disable directives", () => {
  it("applies disable-next to every matching HTML diagnostic on the next line", async () => {
    const { results } = await lintTempFile(
      "index.html",
      `<!-- zemdomu-disable-next requireAltText, requireHrefOnAnchors -->
<img><a>First</a>
<img><a>Second</a>`
    );
    const relevant = results.filter((result) =>
      ["requireAltText", "requireHrefOnAnchors"].includes(result.rule)
    );
    assert.deepStrictEqual(
      relevant.map(({ rule, line }) => ({ rule, line })),
      [
        { rule: "requireAltText", line: 2 },
        { rule: "requireHrefOnAnchors", line: 2 },
      ]
    );
  });

  it("honors HTML block disable and enable boundaries", async () => {
    const { results } = await lintTempFile(
      "index.html",
      `<!-- zemdomu-disable requireAltText -->
<img>
<!-- zemdomu-enable requireAltText -->
<img>`
    );
    const altResults = results.filter((result) => result.rule === "requireAltText");
    assert.strictEqual(altResults.length, 1);
    assert.strictEqual(altResults[0].line, 3);
  });

  it("does not let same-line disable-next reach findings before the comment", async () => {
    const { results } = await lintTempFile(
      "index.html",
      `<img><!-- zemdomu-disable-next requireAltText --><img>`
    );
    const altResults = results.filter((result) => result.rule === "requireAltText");
    assert.strictEqual(altResults.length, 1);
    assert.strictEqual(altResults[0].offset, 0);
  });

  it("ignores directive-looking strings and script text", async () => {
    const jsx = await lintTempFile(
      "Component.tsx",
      `const marker = "<!-- zemdomu-disable requireAltText -->";
export default function Component() { return <img />; }`
    );
    assert.ok(jsx.results.some((result) => result.rule === "requireAltText"));

    const html = await lintTempFile(
      "index.html",
      `<script>const marker = "<!-- zemdomu-disable requireAltText -->";</script><img>`
    );
    assert.ok(html.results.some((result) => result.rule === "requireAltText"));
  });

  it("supports JSX and TSX comments", async () => {
    for (const extension of ["jsx", "tsx"]) {
      const { results } = await lintTempFile(
        `Component.${extension}`,
        `export default function Component() {
  return <>
    {/* zemdomu-disable-next requireAltText */}
    <img />
    <img />
  </>;
}`
      );
      const altResults = results.filter((result) => result.rule === "requireAltText");
      assert.strictEqual(altResults.length, 1, extension);
      assert.strictEqual(altResults[0].line, 4, extension);
    }
  });

  it("supports Vue templates and rebases locations to the full document", async () => {
    const source = `<script setup>const value = 1;</script>
<template>
  <!-- zemdomu-disable-next requireAltText -->
  <img>
  <img>
</template>`;
    const { results } = await lintTempFile("Component.vue", source);
    const altResults = results.filter((result) => result.rule === "requireAltText");
    assert.strictEqual(altResults.length, 1);
    assert.strictEqual(altResults[0].line, 4);
    assert.strictEqual(altResults[0].offset, source.lastIndexOf("<img>"));
  });

  it("filters cross-component results against the source file that owns them", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-inline-cross-"));
    const child = path.join(directory, "Child.tsx");
    const page = path.join(directory, "Page.tsx");
    fs.writeFileSync(
      child,
      `export default function Child() { return <>
  {/* zemdomu-disable enforceHeadingOrder */}
  <h1>Child</h1><h5>Deep child heading</h5>
  {/* zemdomu-enable enforceHeadingOrder */}
</>; }`,
      "utf8"
    );
    fs.writeFileSync(
      page,
      `import Child from "./Child";
export default function Page() { return <main><h1>Page</h1><Child /></main>; }`,
      "utf8"
    );
    const linter = new ProjectLinter({
      rootDir: directory,
      crossComponentAnalysis: true,
      rules: { enforceHeadingOrder: "error" },
    });
    await linter.lintFile(child);
    const results = Array.from((await linter.lintFile(page)).values()).flat();
    assert.ok(
      !results.some(
        (result) =>
          result.rule === "enforceHeadingOrder" && result.filePath === child
      )
    );
  });
});
