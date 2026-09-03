import { strict as assert } from 'assert';
import { spawnSync } from 'child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { discoverFilesSync, parseGlobPatterns } from '../src/file-discovery';

const cliPath = path.resolve(__dirname, '../src/cli.js');

function runCli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

describe('CLI file discovery', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'zemdomu-cli-discovery-'));

  before(() => {
    mkdirSync(path.join(root, 'nested'));
    mkdirSync(path.join(root, '.hidden'));
    mkdirSync(path.join(root, 'node_modules', 'fixture'), { recursive: true });
    writeFileSync(path.join(root, 'root.html'), '<img>');
    writeFileSync(path.join(root, 'nested', 'page.html'), '<button></button>');
    writeFileSync(path.join(root, 'nested', 'view.tsx'), '<a href="#" />');
    writeFileSync(path.join(root, '.hidden', 'hidden.html'), '<img>');
    writeFileSync(path.join(root, 'node_modules', 'fixture', 'vendor.html'), '<img>');
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it('supports braces and multiple patterns while sorting and deduplicating matches', () => {
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      assert.deepEqual(
        discoverFilesSync([
          'root.html',
          'nested\\*.html',
          '**/*.{html,tsx}',
          'nested/page.html',
        ]),
        ['nested/page.html', 'nested/view.tsx', 'root.html']
      );
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('does not split commas inside brace expressions', () => {
    assert.deepEqual(
      parseGlobPatterns(['**/*.{html,tsx}, nested/*.vue\nroot.html']),
      ['**/*.{html,tsx}', 'nested/*.vue', 'root.html']
    );
  });

  it('normalizes path separators through the CLI contract', () => {
    const result = runCli(root, ['check', 'nested\\*.html', '--format', 'json']);
    assert.equal(result.status, 1);
    const diagnostics = JSON.parse(result.stdout);
    assert.ok(diagnostics.length > 0);
    assert.ok(diagnostics.every((entry: { source: { file: string } }) => {
      const file = entry.source.file.replace(/\\/g, '/');
      return file === 'nested/page.html' || file.endsWith('/nested/page.html');
    }));
  });

  it('excludes hidden, dependency, and directory entries from the default pattern', () => {
    const result = runCli(root, ['check', '--format', 'json']);
    assert.equal(result.status, 1);
    const files = new Set(
      JSON.parse(result.stdout).map((entry: { source: { file: string } }) => {
        const file = path.isAbsolute(entry.source.file)
          ? entry.source.file
          : path.resolve(root, entry.source.file);
        return path.relative(root, file).replace(/\\/g, '/');
      })
    );
    assert.ok(files.has('root.html'));
    assert.ok(files.has('nested/page.html'));
    assert.ok(files.has('nested/view.tsx'));
    assert.ok(!files.has('.hidden/hidden.html'));
    assert.ok(!files.has('node_modules/fixture/vendor.html'));
  });

  it('treats an empty check match as a successful empty result', () => {
    const result = runCli(root, ['check', 'missing/**/*.html', '--format', 'json']);
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });
});
