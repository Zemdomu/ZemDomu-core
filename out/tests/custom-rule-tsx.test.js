"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const linter_1 = require("../src/linter");
describe('custom rule tsx', () => {
    it('should apply custom rules to tsx files', () => {
        const code = `const Foo = () => (<div className="custom">Test</div>);`;
        const results = (0, linter_1.lint)(code, {
            filePath: 'Foo.tsx',
            customRules: [
                {
                    name: 'noDiv',
                    test: (node) => (node.type === 'element' && node.tagName === 'div') ||
                        (node.type === 'JSXElement' &&
                            node.openingElement &&
                            node.openingElement.name &&
                            node.openingElement.name.name === 'div'),
                    message: 'Div not allowed',
                },
            ],
        });
        assert_1.strict.ok(results.some((r) => r.rule === 'noDiv'), 'Expected custom rule result');
    });
});
