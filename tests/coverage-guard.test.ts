import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { validateCoverage } = require('../../scripts/coverage-guard.cjs');
const ts = require('typescript');

describe('coverage evidence integrity', function () {
  this.timeout(15000);
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'zemdomu-coverage-guard-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  function measuredFixture() {
    const sourceRoot = path.join(root, 'src');
    const buildRoot = path.join(root, 'build');
    const reportRoot = path.join(root, 'coverage');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(path.join(buildRoot, 'src'), { recursive: true });
    const source = 'export function pick(value: boolean) { if (value) return 1; return 0; }\npick(true);\n';
    const sourceFile = path.join(sourceRoot, 'cli.ts');
    const generated = path.join(buildRoot, 'src', 'cli.js');
    fs.writeFileSync(sourceFile, source);
    const output = ts.transpileModule(source, {
      fileName: sourceFile,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, sourceMap: true, inlineSources: true },
    });
    const map = JSON.parse(output.sourceMapText);
    map.sources = [path.relative(path.dirname(generated), sourceFile).split(path.sep).join('/')];
    fs.writeFileSync(generated, output.outputText);
    fs.writeFileSync(generated + '.map', JSON.stringify(map));
    function measure() {
      const result = spawnSync(process.execPath, [
        require.resolve('c8/bin/c8.js'), '--all', '--exclude-after-remap',
        '--include', '**/build/src/**/*.js', '--include', '**/src/**/*.ts',
        '--reports-dir', reportRoot, '--temp-directory', path.join(reportRoot, '.v8'),
        '--reporter', 'json', '--reporter', 'json-summary', process.execPath, generated,
      ], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    measure();
    return { sourceRoot, buildRoot, reportRoot, generated, measure, requiredEntries: ['cli.ts'] };
  }

  it('accepts actual mapped V8 execution and rejects a missing map on the same code', () => {
    const fixture = measuredFixture();
    const valid = validateCoverage(fixture);
    assert.equal(valid.sourceFileCount, 1);
    assert.ok(valid.totals.branches.total > 0);
    assert.ok(valid.totals.functions.covered > 0);
    fs.rmSync(fixture.generated + '.map');
    fixture.measure();
    assert.throws(() => validateCoverage(fixture), /Missing or invalid coverage evidence/);
  });

  it('rejects displayed 100% with zero executable entrypoint counters', () => {
    const fixture = measuredFixture();
    const finalFile = path.join(fixture.reportRoot, 'coverage-final.json');
    const summaryFile = path.join(fixture.reportRoot, 'coverage-summary.json');
    const final = JSON.parse(fs.readFileSync(finalFile, 'utf8'));
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    for (const file of Object.keys(final)) {
      final[file].f = {};
      final[file].b = {};
      final[file].fnMap = {};
      final[file].branchMap = {};
      for (const metric of ['functions', 'branches']) {
        summary[file][metric] = { total: 0, covered: 0, skipped: 0, pct: 100 };
        summary.total[metric] = { total: 0, covered: 0, skipped: 0, pct: 100 };
      }
    }
    fs.writeFileSync(finalFile, JSON.stringify(final));
    fs.writeFileSync(summaryFile, JSON.stringify(summary));
    assert.throws(() => validateCoverage(fixture), /Missing executable entrypoint counters/);
  });

  it('rejects a source file missing from the reported denominator', () => {
    const fixture = measuredFixture();
    fs.copyFileSync(path.join(fixture.sourceRoot, 'cli.ts'), path.join(fixture.sourceRoot, 'unreported.ts'));
    const generated = path.join(fixture.buildRoot, 'src', 'unreported.js');
    fs.copyFileSync(fixture.generated, generated);
    const map = JSON.parse(fs.readFileSync(fixture.generated + '.map', 'utf8'));
    map.sources = ['../../src/unreported.ts'];
    fs.writeFileSync(generated + '.map', JSON.stringify(map));
    fs.writeFileSync(generated, fs.readFileSync(generated, 'utf8').replace('sourceMappingURL=cli.js.map', 'sourceMappingURL=unreported.js.map'));
    assert.throws(() => validateCoverage(fixture), /omits first-party source files/);
  });

  it('rejects impossible raw or summarized coverage counters', () => {
    const fixture = measuredFixture();
    const summaryFile = path.join(fixture.reportRoot, 'coverage-summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    summary.total.functions.covered = summary.total.functions.total + 1;
    fs.writeFileSync(summaryFile, JSON.stringify(summary));
    assert.throws(() => validateCoverage(fixture), /Invalid coverage counters/);
  });

  it('removes stale success reports even when the normal test suite fails first', () => {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'coverage'));
    const scripts = path.resolve(__dirname, '../../scripts');
    for (const file of ['test-coverage.cjs', 'coverage-guard.cjs']) {
      fs.copyFileSync(path.join(scripts, file), path.join(root, 'scripts', file));
    }
    const stale = path.join(root, 'coverage', 'coverage-verification.json');
    fs.writeFileSync(stale, '{"previousRunPassed":true}');
    const failingNpm = path.join(root, 'fail-normal-test.cjs');
    fs.writeFileSync(failingNpm, 'process.exit(9);');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'test-coverage.cjs')], {
      cwd: root, encoding: 'utf8', env: { ...process.env, npm_execpath: failingNpm },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /exit status 9/);
    assert.equal(fs.existsSync(stale), false, 'A failed new run must not retain earlier success evidence');
  });
});
