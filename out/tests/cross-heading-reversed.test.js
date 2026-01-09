"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../src/index");
describe('cross component heading order reversed', () => {
    it('flags h1 after h2 across components', async () => {
        const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'zd-cc-heading-'));
        const a = path_1.default.join(tmp, 'A.jsx');
        const b = path_1.default.join(tmp, 'B.jsx');
        fs_1.default.writeFileSync(a, "import B from './B'; export default function A(){ return (<main><h2>Section</h2><B/></main>); }");
        fs_1.default.writeFileSync(b, "export default function B(){ return (<section><h1>Late</h1></section>); }");
        const linter = new index_1.ProjectLinter({ crossComponentAnalysis: true, rules: { enforceHeadingOrder: 'error' } });
        await linter.lintFile(b);
        const map = await linter.lintFile(a);
        const results = Array.from(map.values()).flat();
        assert_1.default.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected cross-component heading order warning for h2 before h1');
    });
});
