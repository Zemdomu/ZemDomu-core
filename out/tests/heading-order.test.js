"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const index_1 = require("../src/index");
describe('heading order', () => {
    it('flags h1 to h3 skip', () => {
        const html = '<h1>One</h1><h3>Two</h3>';
        const results = (0, index_1.lint)(html);
        assert_1.default.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected heading order warning');
    });
    it('allows sequential headings', () => {
        const html = '<h1>One</h1><h2>Two</h2>';
        const results = (0, index_1.lint)(html);
        assert_1.default.ok(!results.some(r => r.rule === 'enforceHeadingOrder'), 'Did not expect heading order warning');
    });
    it('flags h2 before h1', () => {
        const html = '<h2>Two</h2><h1>One</h1>';
        const results = (0, index_1.lint)(html);
        assert_1.default.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected heading order warning for h2 before h1');
    });
});
