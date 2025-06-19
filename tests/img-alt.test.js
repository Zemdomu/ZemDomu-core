const assert = require('assert');
const { lint } = require('../out/index');

// Negative cases
let html = '<img>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireAltText'), 'Expected alt text warning');

html = '<img alt="">';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireAltText'), 'Expected empty alt text warning');

// Positive case
html = '<img alt="desc">';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireAltText'), 'Did not expect alt text warning');
console.log('img-alt tests passed');
