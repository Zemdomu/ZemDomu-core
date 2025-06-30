import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectLinter } from '../src/index';

describe('cross component duplicate ids tsx', () => {
  it('detects duplicates across reused components', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-id-'));
    const a = path.join(tmp, 'A.tsx');
    const b = path.join(tmp, 'B.tsx');
    fs.writeFileSync(b, "export default function B(){ return (<div id='dup'></div>); }");
    fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/><B/></div>); }");
    const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { uniqueIds: 'error' } });
    await linter.lintFile(b);
    const map = await linter.lintFile(a);
    const results = Array.from(map.values()).flat();
    assert.ok(results.some(r => r.rule === 'uniqueIds'), 'Expected cross-component duplicate id warning');
  });

  it('passes when component used once', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-id-'));
    const a = path.join(tmp, 'A.tsx');
    const b = path.join(tmp, 'B.tsx');
    fs.writeFileSync(b, "export default function B(){ return (<div id='dup'></div>); }");
    fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/></div>); }");
    const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { uniqueIds: 'error' } });
    await linter.lintFile(b);
    const map = await linter.lintFile(a);
    const results = Array.from(map.values()).flat();
    assert.ok(!results.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
  });
});
