import assert from 'assert';
import { lint } from '../src/index';

const code = 'const Foo = () => (<div></div';
const res = lint(code, { filePath: 'Foo.jsx' });
assert.ok(res.some((r: any) => r.rule === 'parseError'), 'Expected parseError diagnostic');
console.log('parse-error test passed');
