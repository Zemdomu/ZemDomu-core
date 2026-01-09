"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../src/index");
describe("cross component heading order (entry-only)", () => {
    it("follows imports from Page and finds violations", async () => {
        var _a, _b;
        const pagePath = path_1.default.resolve(__dirname, "../../../tests/crossComponent/Page.tsx");
        const linter = new index_1.ProjectLinter({
            crossComponentAnalysis: true,
            rules: {
                singleH1: "error",
                enforceHeadingOrder: "error",
                requireButtonText: "off",
            },
        });
        const map = await linter.lintFiles([pagePath]);
        const results = Array.from(map.values()).flat();
        const byRule = results.reduce((a, r) => {
            var _a;
            a[r.rule] = ((_a = a[r.rule]) !== null && _a !== void 0 ? _a : 0) + 1;
            return a;
        }, {});
        assert_1.default.ok(((_a = byRule["singleH1"]) !== null && _a !== void 0 ? _a : 0) >= 1);
        assert_1.default.ok(((_b = byRule["enforceHeadingOrder"]) !== null && _b !== void 0 ? _b : 0) >= 1);
    });
});
