"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tests/crossComponent/cross-heading-order.test.ts
const assert_1 = __importDefault(require("assert"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../src/index");
describe("cross component heading order", () => {
    it("detects heading order and h1 issues across components", async () => {
        var _a, _b;
        const buttonPath = path_1.default.resolve(__dirname, "../../../tests/crossComponent/Button.tsx");
        const sectionPath = path_1.default.resolve(__dirname, "../../../tests/crossComponent/Section.tsx");
        const subSectionPath = path_1.default.resolve(__dirname, "../../../tests/crossComponent/SubSection.tsx");
        const pagePath = path_1.default.resolve(__dirname, "../../../tests/crossComponent/Page.tsx");
        const linter = new index_1.ProjectLinter({
            crossComponentAnalysis: true,
            rules: {
                singleH1: "error",
                enforceHeadingOrder: "error",
                requireButtonText: "off",
            },
        });
        const map = await linter.lintFiles([
            buttonPath,
            sectionPath,
            subSectionPath,
            pagePath,
        ]);
        const results = Array.from(map.values()).flat();
        // Presence checks
        assert_1.default.ok(results.some((r) => r.rule === "singleH1"), "Expected cross-component singleH1 warning");
        assert_1.default.ok(results.some((r) => r.rule === "enforceHeadingOrder"), "Expected cross-component heading order warning");
        // Count checks (looser; tighten later if you want)
        const byRule = results.reduce((acc, r) => {
            var _a;
            acc[r.rule] = ((_a = acc[r.rule]) !== null && _a !== void 0 ? _a : 0) + 1;
            return acc;
        }, {});
        assert_1.default.ok(((_a = byRule["singleH1"]) !== null && _a !== void 0 ? _a : 0) >= 1, "Expected at least one singleH1");
        assert_1.default.ok(((_b = byRule["enforceHeadingOrder"]) !== null && _b !== void 0 ? _b : 0) >= 1, // set to >=2 if you expect more
        "Expected at least one enforceHeadingOrder");
        const singleH1Files = new Set(results
            .filter((r) => r.rule === "singleH1" && r.filePath)
            .map((r) => path_1.default.basename(r.filePath)));
        assert_1.default.ok(singleH1Files.has("Page.tsx"), "Expected cross-component singleH1 to surface on Page.tsx");
        assert_1.default.ok(singleH1Files.has("Button.tsx"), "Expected cross-component singleH1 to surface on Button.tsx");
        assert_1.default.ok(singleH1Files.has("SubSection.tsx"), "Expected cross-component singleH1 to surface on SubSection.tsx usage");
        const headingLocations = results
            .filter((r) => r.rule === "enforceHeadingOrder" && r.filePath)
            .map((r) => path_1.default.basename(r.filePath));
        assert_1.default.ok(headingLocations.includes("Button.tsx"), "Expected heading order issue to highlight the component containing the offending heading");
        const headingMessages = results
            .filter((r) => r.rule === "enforceHeadingOrder")
            .map((r) => r.message || "");
        assert_1.default.ok(headingMessages.some((msg) => msg.includes("<h1>") && msg.includes("after <h3>")), "Expected cross-component reset <h1> warning");
        assert_1.default.ok(headingMessages.some((msg) => msg.includes("<h5>") && msg.includes("after <h1>")), "Expected cross-component skipped <h5> warning");
    });
});
