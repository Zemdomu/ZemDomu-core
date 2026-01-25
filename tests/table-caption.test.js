const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: table without caption
let html = '<table></table>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireTableCaption'), 'Expected table caption warning');

// Positive case
html = '<table><caption>Cap</caption></table>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireTableCaption'), 'Did not expect table caption warning');

// Empty caption case
html = '<table><caption></caption></table>';
results = lint(html);
assert.ok(
  results.some(r => r.rule === 'requireTableCaption' && r.message.includes('empty')),
  'Expected empty caption warning'
);
console.log('table-caption tests passed');
