import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectLinter } from '../src/index';

describe('cross component heading order reversed', () => {
  it('flags h1 after h2 across components', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-heading-'));
    const a = path.join(tmp, 'A.jsx');
    const b = path.join(tmp, 'B.jsx');

    fs.writeFileSync(
      a,
      "import B from './B'; export default function A(){ return (<main><h2>Section</h2><B/></main>); }"
    );
    fs.writeFileSync(
      b,
      "export default function B(){ return (<section><h1>Late</h1></section>); }"
    );

    const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { enforceHeadingOrder: 'error' } });
    await linter.lintFile(b);
    const map = await linter.lintFile(a);
    const results = Array.from(map.values()).flat();

    assert.ok(
      results.some(r => r.rule === 'enforceHeadingOrder'),
      'Expected cross-component heading order warning for h2 before h1'
    );
  });
});
