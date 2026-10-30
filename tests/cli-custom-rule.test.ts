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
const outsideMarker = path.join(tmp, 'outside-executed');
fs.writeFileSync(
  outsideRule,
  `require('fs').writeFileSync(${JSON.stringify(outsideMarker)}, 'executed'); module.exports = {};`
);
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

function expectRejectedRule(file: string): void {
  const rejected = spawnSync(process.execPath, [cli, htmlFile, '--custom', file], {
    encoding: 'utf8',
    cwd: tmp,
  });
  if (!rejected.status || !rejected.stderr.includes('Custom rule file must be inside ./custom-rules')) {
    throw new Error(`Expected directory restriction for ${file}: ${rejected.stdout}${rejected.stderr}`);
  }
  if (fs.existsSync(outsideMarker)) throw new Error('An outside custom rule was executed');
}

// A permitted path may have a different spelling than the subprocess cwd
// (including macOS /var versus /private/var aliases).
const projectAlias = `${tmp}-alias`;
fs.symlinkSync(tmp, projectAlias, 'junction');
try {
  for (const [cwd, file] of [
    [fs.realpathSync(tmp), path.join(projectAlias, 'custom-rules', 'array-rule.js')],
    [projectAlias, fs.realpathSync(arrayRule)],
  ]) {
    const aliased = spawnSync(process.execPath, [cli, htmlFile, '--custom', file], {
      encoding: 'utf8', cwd,
    });
    if (aliased.status !== 1 || !(aliased.stdout + aliased.stderr).includes('Bar elements are not allowed')) {
      throw new Error(`Expected custom rule through a path alias: ${aliased.stdout}${aliased.stderr}`);
    }
  }
} finally {
  fs.rmSync(projectAlias, { force: true });
}

// Links to a file that remains inside the allowed directory are legitimate.
const insideLink = path.join(customDir, 'inside-link.js');
fs.symlinkSync(arrayRule, insideLink, 'file');
const inside = spawnSync(process.execPath, [cli, htmlFile, '-c', insideLink], {
  encoding: 'utf8', cwd: tmp,
});
if (inside.status !== 1 || !(inside.stdout + inside.stderr).includes('Bar elements are not allowed')) {
  throw new Error(`Expected an in-directory symlink to load: ${inside.stdout}${inside.stderr}`);
}

// Both a symlinked file and an ancestor directory can otherwise bypass a
// lexical path check. Outside code must not run, even as a module side effect.
const outsideLink = path.join(customDir, 'outside-link.js');
fs.symlinkSync(outsideRule, outsideLink, 'file');
expectRejectedRule(outsideLink);
const outsideDir = path.join(tmp, 'outside-directory');
fs.mkdirSync(outsideDir);
const nestedRule = path.join(outsideDir, 'nested-rule.js');
fs.copyFileSync(outsideRule, nestedRule);
const nestedLink = path.join(customDir, 'nested-link');
fs.symlinkSync(outsideDir, nestedLink, 'junction');
expectRejectedRule(path.join(nestedLink, 'nested-rule.js'));

// A directory is not a validated rule file: Node's package main resolution
// could redirect it outside custom-rules after a directory-only check.
const packageRule = path.join(customDir, 'package-rule');
fs.mkdirSync(packageRule);
fs.writeFileSync(path.join(packageRule, 'package.json'), JSON.stringify({ main: '../../other-rule.js' }));
expectRejectedRule(packageRule);

const missing = spawnSync(process.execPath, [cli, htmlFile, '--custom'], {
  encoding: 'utf8', cwd: tmp,
});
if (!missing.status || !/Missing (?:value|file) for --custom/.test(missing.stderr)) {
  throw new Error(`Expected the existing missing custom-rule value error: ${missing.stdout}${missing.stderr}`);
}
if (fs.existsSync(outsideMarker)) throw new Error('An outside custom rule was executed');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('CLI custom rule canonical path and symlink confinement tests passed');
