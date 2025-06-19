const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: empty <strong>
let html = '<div><strong></strong></div>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'preventEmptyInlineTags'), 'Expected empty inline tag warning');

// Positive case: inline tag followed by text (current rule behavior)
html = '<div><strong></strong>text</div>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'preventEmptyInlineTags'), 'Did not expect inline tag warning');
console.log('prevent-empty-inline tests passed');
