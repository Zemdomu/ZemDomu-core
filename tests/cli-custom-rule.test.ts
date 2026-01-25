export {};

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cli-'));
const htmlFile = path.join(tmp, 'test.html');
fs.writeFileSync(htmlFile, '<foo></foo>');

const customDir = path.join(tmp, 'custom-rules');
fs.mkdirSync(customDir);
const ruleFile = path.join(customDir, 'my-rule.js');
fs.writeFileSync(
  ruleFile,
  `module.exports = {\n  name: 'noFoo',\n  test: n => (n.type === 'element' && n.tagName === 'foo') || (n.type === 'JSXElement' && n.openingElement && n.openingElement.name && n.openingElement.name.name === 'foo'),\n  message: 'Foo elements are not allowed'\n};\n`
);

const cli = path.join(__dirname, '..', 'src', 'cli.js');
const result = spawnSync('node', [cli, htmlFile, '--custom', ruleFile], {
  encoding: 'utf8',
  cwd: tmp,
});

if (result.status === 0) {
  console.error(result.stdout, result.stderr);
  throw new Error('Expected CLI to fail');
}

const output = result.stdout + result.stderr;
if (!output.includes('Foo elements are not allowed')) {
  console.error(output);
  throw new Error('Expected custom rule message');
}

console.log('CLI custom rule test passed');

// Array export should work too
const arrayRule = path.join(customDir, 'array-rule.js');
fs.writeFileSync(
  arrayRule,
  `module.exports = [{\n  name: 'noBar',\n  test: n => (n.type === 'element' && n.tagName === 'bar') || (n.type === 'JSXElement' && n.openingElement && n.openingElement.name && n.openingElement.name.name === 'bar'),\n  message: 'Bar elements are not allowed'\n}];\n`
);
fs.writeFileSync(htmlFile, '<bar></bar>');
const arrayResult = spawnSync('node', [cli, htmlFile, '--custom', arrayRule], {
  encoding: 'utf8',
  cwd: tmp,
});
if (arrayResult.status === 0) {
  console.error(arrayResult.stdout, arrayResult.stderr);
  throw new Error('Expected CLI to fail for array rule');
}
const arrayOutput = arrayResult.stdout + arrayResult.stderr;
if (!arrayOutput.includes('Bar elements are not allowed')) {
  console.error(arrayOutput);
  throw new Error('Expected array custom rule message');
}
console.log('CLI custom rule array test passed');

// Should error when rule file is outside the custom-rules directory
const outsideRule = path.join(tmp, 'other-rule.js');
fs.writeFileSync(outsideRule, 'module.exports = {};');
const bad = spawnSync('node', [cli, htmlFile, '--custom', outsideRule], {
  encoding: 'utf8',
  cwd: tmp,
});
if (bad.status === 0) {
  throw new Error('Expected CLI to fail for outside rule');
}
if (!bad.stderr.includes('Custom rule file must be inside ./custom-rules')) {
  console.error(bad.stdout, bad.stderr);
  throw new Error('Expected directory restriction error');
}

console.log('CLI custom rule path restriction test passed');
