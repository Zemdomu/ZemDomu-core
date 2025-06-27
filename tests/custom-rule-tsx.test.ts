import { strict as assert } from 'assert';
import { lint } from '../src/linter';

describe('custom rule tsx', () => {
  it('should apply custom rules to tsx files', () => {
    const code = `const Foo = () => (<div className="custom">Test</div>);`;
    const results = lint(code, {
      filePath: 'Foo.tsx',
      customRules: [
        {
          name: 'noDiv',
          test: (node: any) =>
            (node.type === 'element' && node.tagName === 'div') ||
            (node.type === 'JSXElement' &&
              node.openingElement &&
              node.openingElement.name &&
              node.openingElement.name.name === 'div'),
          message: 'Div not allowed',
        },
      ],
    });
    assert.ok(results.some((r) => r.rule === 'noDiv'), 'Expected custom rule result');
  });
});

