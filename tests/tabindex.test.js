const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: tabindex greater than 0
let html = '<div tabindex="5"></div>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'noTabindexGreaterThanZero'), 'Expected tabindex warning');

// Positive case: tabindex 0
html = '<div tabindex="0"></div>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'noTabindexGreaterThanZero'), 'Did not expect tabindex warning');

console.log('tabindex tests passed');
