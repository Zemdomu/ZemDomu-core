const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-cli-'));
const htmlFile = path.join(tmp, 'test.html');
fs.writeFileSync(htmlFile, '<foo></foo>');

const ruleFile = path.join(tmp, 'my-rule.js');
fs.writeFileSync(ruleFile, `module.exports = {\n  name: 'noFoo',\n  test: n => (n.type === 'element' && n.tagName === 'foo') || (n.type === 'JSXElement' && n.openingElement && n.openingElement.name && n.openingElement.name.name === 'foo'),\n  message: 'Foo elements are not allowed'\n};\n`);

const cli = path.join(__dirname, '..', 'src', 'cli.js');
const result = spawnSync('node', [cli, htmlFile, '--custom', ruleFile], {
  encoding: 'utf8'
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
