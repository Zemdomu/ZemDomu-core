const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProjectLinter } = require('../out/src/index');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-id-'));
  const a = path.join(tmp, 'A.jsx');
  const b = path.join(tmp, 'B.jsx');
  fs.writeFileSync(b, "export default function B(){ return (<div id='dup'></div>); }");
  fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/><B/></div>); }");
  const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { uniqueIds: true } });
  await linter.lintFile(b);
  const map = await linter.lintFile(a);
  const results = Array.from(map.values()).flat();
  assert.ok(results.some(r => r.rule === 'uniqueIds'), 'Expected cross-component duplicate id warning');

  // Positive case
  fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<div><B/></div>); }");
  linter.clear();
  await linter.lintFile(b);
  const map2 = await linter.lintFile(a);
  const results2 = Array.from(map2.values()).flat();
  assert.ok(!results2.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
  console.log('cross-duplicate-ids tests passed');
})();
