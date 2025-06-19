const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: <section> without heading
let html = '<section><p>Content</p></section>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireSectionHeading'), 'Expected section heading warning');

// Positive case: <section> with heading
html = '<section><h2>Title</h2></section>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireSectionHeading'), 'Did not expect section heading warning');
console.log('section-heading tests passed');
