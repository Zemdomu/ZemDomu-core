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
describe('cross component duplicate ids tsx', () => {
    it('detects duplicates across reused components', async () => {
        const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'zd-cc-id-'));
        const a = path_1.default.join(tmp, 'A.tsx');
        const b = path_1.default.join(tmp, 'B.tsx');
        fs_1.default.writeFileSync(b, "export default function B(){ return (<div id='dup'></div>); }");
        fs_1.default.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/><B/></div>); }");
        const linter = new index_1.ProjectLinter({ crossComponentAnalysis: true, rules: { uniqueIds: 'error' } });
        await linter.lintFile(b);
        const map = await linter.lintFile(a);
        const results = Array.from(map.values()).flat();
        assert_1.default.ok(results.some(r => r.rule === 'uniqueIds'), 'Expected cross-component duplicate id warning');
    });
    it('passes when component used once', async () => {
        const tmp = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'zd-cc-id-'));
        const a = path_1.default.join(tmp, 'A.tsx');
        const b = path_1.default.join(tmp, 'B.tsx');
        fs_1.default.writeFileSync(b, "export default function B(){ return (<div id='dup'></div>); }");
        fs_1.default.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/></div>); }");
        const linter = new index_1.ProjectLinter({ crossComponentAnalysis: true, rules: { uniqueIds: 'error' } });
        await linter.lintFile(b);
        const map = await linter.lintFile(a);
        const results = Array.from(map.values()).flat();
        assert_1.default.ok(!results.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
    });
});
