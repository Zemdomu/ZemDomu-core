import assert from "assert";
import { ComponentPathResolver } from "../src";

describe("ComponentPathResolver compatibility", () => {
  it("retains deprecated static configuration methods for existing consumers", () => {
    assert.strictEqual(typeof ComponentPathResolver.setRootDir, "function");
    assert.strictEqual(typeof ComponentPathResolver.updateDevMode, "function");
    ComponentPathResolver.setRootDir(process.cwd());
    ComponentPathResolver.updateDevMode(false);
    assert.ok(new ComponentPathResolver());
  });
});
