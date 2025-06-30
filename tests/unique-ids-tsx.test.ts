import assert from 'assert';
import { lint } from '../src/index';

describe('uniqueIds tsx', () => {
  it('detects duplicate ids in tsx', () => {
    const code = `const Foo = () => (<div><div id='dup'></div><span id='dup'></span></div>);`;
    const res = lint(code, { filePath: 'Foo.tsx' });
    assert.ok(res.some(r => r.rule === 'uniqueIds'), 'Expected duplicate id warning');
  });

  it('allows unique ids in tsx', () => {
    const code = `const Foo = () => (<div><div id='a'></div><span id='b'></span></div>);`;
    const res = lint(code, { filePath: 'Foo.tsx' });
    assert.ok(!res.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
  });
});
