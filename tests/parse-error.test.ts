const assert = require('assert');
const { lint } = require('../src/index');

const code = 'const Foo = () => (<div></div';
const res = lint(code, { filePath: 'Foo.jsx' });
assert.ok(res.some((r: any) => r.rule === 'parseError'), 'Expected parseError diagnostic');
console.log('parse-error test passed');
