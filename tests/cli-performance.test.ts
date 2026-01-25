export {};

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cli-perf-'));
const htmlFile = path.join(tmp, 'ok.html');
fs.writeFileSync(htmlFile, '');

const cli = path.join(__dirname, '..', 'src', 'cli.js');
const result = spawnSync('node', [cli, htmlFile, '--perf'], {
  encoding: 'utf8',
  cwd: tmp,
});

if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  throw new Error('Expected CLI perf run to succeed');
}

let data;
try {
  data = JSON.parse(result.stdout.trim());
} catch (err) {
  console.error(result.stdout, result.stderr);
  throw new Error('Expected CLI perf output to be JSON');
}

const entries = Object.entries(data);
if (entries.length === 0) {
  throw new Error('Expected perf metrics to include at least one file');
}

const [filePath, timings] = entries[0] as [string, { total?: number }];
if (!filePath || typeof timings.total !== 'number') {
  throw new Error('Expected perf metrics to include total timing');
}

console.log('CLI perf diagnostics test passed');
