import assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import path from "path";
import { lint, ProjectLinter } from "../src/index";

describe("public API boundary", () => {
  it("supports in-memory file analysis through the package root surface", () => {
    const filePath = path.resolve("src/Card.tsx");
    const results = lint("export const Card = () => <img />;", { filePath });

    assert(results.some((result) => result.rule === "requireAltText"));
    assert(results.every((result) => Number.isFinite(result.line)));
  });

  it("supports project analysis through the package root surface", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "zemdomu-public-api-"));
    const filePath = path.join(rootDir, "Card.tsx");
    try {
      await fs.writeFile(filePath, "export const Card = () => <img />;", "utf8");
      const linter = new ProjectLinter({ rootDir });
      const results = await linter.lintFiles([filePath]);

      assert(results.has(filePath));
      assert(results.get(filePath)?.some((result) => result.rule === "requireAltText"));
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
