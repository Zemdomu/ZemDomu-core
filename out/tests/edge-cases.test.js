"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const index_1 = require("../src/index");
describe('edge cases', () => {
    it('handles empty input', () => {
        const res = (0, index_1.lint)('');
        assert_1.default.deepStrictEqual(res, []);
    });
    it('handles comments only', () => {
        const res = (0, index_1.lint)('<!-- just a comment -->');
        assert_1.default.deepStrictEqual(res, []);
    });
});
