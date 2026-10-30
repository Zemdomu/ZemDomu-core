const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function runFunctionalTests(buildDirectory = 'out') {
  if (buildDirectory !== 'out' && !/^\.coverage-build-[A-Za-z0-9]+$/.test(buildDirectory)) {
    throw new Error('Expected the normal or isolated coverage build directory.');
  }
  const pattern = `${buildDirectory}/**/*.test.js`;
  const result = spawnSync(process.execPath, [require.resolve('mocha/bin/mocha.js'), pattern], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status === null) throw new Error('The functional test process did not complete.');
  return result.status;
}

module.exports = { runFunctionalTests };

if (require.main === module) {
  try {
    process.exitCode = runFunctionalTests(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
