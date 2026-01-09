"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const index_1 = require("../src/index");
describe('visitHtml', () => {
    it('walks nodes in depth-first order', () => {
        const root = (0, index_1.parseHtml)('<div><span>hi</span></div>');
        const types = [];
        const visitor = {
            enter(node) {
                types.push(node.type);
            },
            exit(node) {
                types.push('/' + node.type);
            },
        };
        (0, index_1.visitHtml)(root, visitor);
        assert_1.strict.deepStrictEqual(types, [
            'element',
            'element',
            'element',
            'text',
            '/text',
            '/element',
            '/element',
            '/element',
        ]);
    });
});
