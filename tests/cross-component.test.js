const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProjectLinter } = require('../out/index');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-'));
  const a = path.join(tmp, 'A.jsx');
  const b = path.join(tmp, 'B.jsx');
  fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><h1>A</h1><B/></div>); }");
  fs.writeFileSync(b, "export default function B(){ return (<div><h1>B</h1></div>); }");
  const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { singleH1: true } });
  await linter.lintFile(b);
  const map = await linter.lintFile(a);
  const results = Array.from(map.values()).flat();
  assert.ok(results.some(r => r.rule === 'singleH1'), 'Expected cross-component singleH1 warning');

  // Positive case: only one h1 across components
  fs.writeFileSync(b, "export default function B(){ return (<div><h2>B</h2></div>); }");
  linter.clear();
  await linter.lintFile(b);
  const map2 = await linter.lintFile(a);
  const results2 = Array.from(map2.values()).flat();
  assert.ok(!results2.some(r => r.rule === 'singleH1'), 'Did not expect singleH1 warning');
  console.log('cross-component tests passed');
})();
