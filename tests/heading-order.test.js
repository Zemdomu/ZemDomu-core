const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: skip from h1 to h3
let html = '<h1>One</h1><h3>Two</h3>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected heading order warning');

// Positive case: sequential headings
html = '<h1>One</h1><h2>Two</h2>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'enforceHeadingOrder'), 'Did not expect heading order warning');

// Resetting to h1 after deeper headings should warn
html = '<h2>Two</h2><h1>Reset</h1>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected heading order warning when <h1> follows a deeper heading');
console.log('heading-order tests passed');
