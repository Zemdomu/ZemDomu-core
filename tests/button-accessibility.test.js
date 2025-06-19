const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: no text or aria-label
let html = '<button></button>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireButtonText'), 'Expected button text warning');

// Positive case: aria-label provided
html = '<button aria-label="Close"></button>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireButtonText'), 'Did not expect button text warning');
console.log('button-accessibility tests passed');
