const { lint } = require('zemdomu');
const results = lint('<img>', { rules: { requireAltText: true } });
if (!results.some(r => r.rule === 'requireAltText')) {
  throw new Error('Core link smoke-test failed');
}
console.log('Smoke test passed');
