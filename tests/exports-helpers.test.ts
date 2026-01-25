import assert from "assert";
import * as api from "../src/index";

assert.strictEqual(typeof api.getJsxAttribute, "function");
assert.strictEqual(typeof api.getJsxAttributeState, "function");
assert.strictEqual(typeof api.getJsxExpressionState, "function");
assert.strictEqual(typeof api.isJsxExpressionPossiblyEmpty, "function");

console.log("exports helpers test passed");
