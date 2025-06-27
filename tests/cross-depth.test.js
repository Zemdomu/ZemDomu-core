const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProjectLinter } = require('../out/src/index');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-depth-'));
  const a = path.join(tmp, 'A.jsx');
  const b = path.join(tmp, 'B.jsx');
  const c = path.join(tmp, 'C.jsx');
  fs.writeFileSync(c, "export default function C(){ return (<div><h1>C</h1></div>); }");
  fs.writeFileSync(b, "import C from './C'; export default function B(){ return (<div><C/></div>); }");
  fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><h1>A</h1><B/></div>); }");

  const l1 = new ProjectLinter({ crossComponentAnalysis: true, crossComponentDepth: 1, rules: { singleH1: true } });
  await l1.lintFile(c);
  await l1.lintFile(b);
  const map1 = await l1.lintFile(a);
  const res1 = Array.from(map1.values()).flat();
  assert.ok(!res1.some(r => r.rule === 'singleH1'), 'Depth 1 should ignore nested h1');

  const l2 = new ProjectLinter({ crossComponentAnalysis: true, crossComponentDepth: 2, rules: { singleH1: true } });
  await l2.lintFile(c);
  await l2.lintFile(b);
  const map2 = await l2.lintFile(a);
  const res2 = Array.from(map2.values()).flat();
  assert.ok(res2.some(r => r.rule === 'singleH1'), 'Depth 2 should detect nested h1');
  console.log('cross-depth tests passed');
})();
