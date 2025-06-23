const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ProjectLinter } = require('../out/index');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cc-nav-'));
  const a = path.join(tmp, 'A.jsx');
  const b = path.join(tmp, 'B.jsx');
  fs.writeFileSync(b, "export default function B(){ return (<div></div>); }");
  fs.writeFileSync(a, "import B from './B'; export default function A(){ return (<nav><B/></nav>); }");
  const linter = new ProjectLinter({ crossComponentAnalysis: true, rules: { requireNavLinks: true } });
  await linter.lintFile(b);
  const map = await linter.lintFile(a);
  const results = Array.from(map.values()).flat();
  assert.ok(results.some(r => r.rule === 'requireNavLinks'), 'Expected cross-component nav link warning');

  // Positive case
  fs.writeFileSync(b, "export default function B(){ return (<a href='#'>x</a>); }");
  linter.clear();
  await linter.lintFile(b);
  const map2 = await linter.lintFile(a);
  const results2 = Array.from(map2.values()).flat();
  assert.ok(!results2.some(r => r.rule === 'requireNavLinks'), 'Did not expect nav link warning');
  console.log('cross-nav-links tests passed');
})();
