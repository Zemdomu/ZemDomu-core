const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateCoverage } = require('./coverage-guard.cjs');

const root = path.resolve(__dirname, '..');
const reportRoot = path.join(root, 'coverage');
function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Coverage command failed with exit status ' + result.status);
}

let buildRoot;
let passed = false;
try {
  // Invalidate earlier success evidence even if the normal tests fail first.
  fs.rmSync(reportRoot, { recursive: true, force: true });
  if (!process.env.npm_execpath) throw new Error('Use npm run test:coverage to run this command.');
  // Retain the complete normal test/build contract before measuring a different build profile.
  runNode([process.env.npm_execpath, 'test']);
  buildRoot = fs.mkdtempSync(path.join(root, '.coverage-build-'));
  runNode([require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', '--sourceMap', '--inlineSources', '--outDir', buildRoot]);
  runNode([
    require.resolve('c8/bin/c8.js'),
    '--all', '--exclude-after-remap',
    '--include', '**/' + path.basename(buildRoot) + '/src/**/*.js',
    '--include', '**/src/**/*.ts',
    '--temp-directory', path.join(reportRoot, '.v8'),
    '--reports-dir', reportRoot,
    '--reporter', 'text', '--reporter', 'json', '--reporter', 'json-summary', '--reporter', 'html',
    process.execPath, path.join(__dirname, 'run-functional-tests.cjs'), path.basename(buildRoot),
  ]);
  const evidence = validateCoverage({ sourceRoot: path.join(root, 'src'), buildRoot, reportRoot });
  fs.writeFileSync(path.join(reportRoot, 'coverage-verification.json'), JSON.stringify({
    ...evidence,
    node: process.version,
    c8: require('c8/package.json').version,
    typescript: require('typescript/package.json').version,
    profile: 'TypeScript CommonJS compilation with sourceMap and inlineSources; production build unchanged.',
    functionalTests: 'The same Mocha **/*.test.js pattern and shared runner as npm test.',
    omittedTests: [],
    mapsValidatedBeforeCleanup: true,
  }, null, 2) + '\n');
  passed = true;
  console.log('Verified complete first-party source inventory and executable entrypoint counters. Reports: coverage/index.html and coverage/coverage-summary.json');
} catch (error) {
  console.error(error.message);
  if (buildRoot) console.error('Retained coverage build for inspection: ' + buildRoot);
  process.exitCode = 1;
} finally {
  if (passed && buildRoot) fs.rmSync(buildRoot, { recursive: true, force: true });
}
