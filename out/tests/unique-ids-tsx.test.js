"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const index_1 = require("../src/index");
describe('uniqueIds tsx', () => {
    it('detects duplicate ids in tsx', () => {
        const code = `const Foo = () => (<div><div id='dup'></div><span id='dup'></span></div>);`;
        const res = (0, index_1.lint)(code, { filePath: 'Foo.tsx' });
        assert_1.default.ok(res.some(r => r.rule === 'uniqueIds'), 'Expected duplicate id warning');
    });
    it('allows unique ids in tsx', () => {
        const code = `const Foo = () => (<div><div id='a'></div><span id='b'></span></div>);`;
        const res = (0, index_1.lint)(code, { filePath: 'Foo.tsx' });
        assert_1.default.ok(!res.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
    });
});
