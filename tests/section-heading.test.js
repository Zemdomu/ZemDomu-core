const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: <section> without heading or label
let html = '<section><p>Content</p></section>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireSectionHeading'), 'Expected section heading warning');

// Positive case: <section> with heading
html = '<section><h2>Title</h2></section>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireSectionHeading'), 'Did not expect section heading warning');

// Positive case: <section> with aria-label
html = '<section aria-label="Main content"><p>Content</p></section>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireSectionHeading'), 'Did not expect section heading warning for aria-label');

// Positive case: <section> with aria-labelledby
html = '<h2 id="title">Title</h2><section aria-labelledby="title"><p>Content</p></section>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireSectionHeading'), 'Did not expect section heading warning for aria-labelledby');

// Negative case: aria-labelledby missing target
html = '<section aria-labelledby="missing"><p>Content</p></section>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireSectionHeading'), 'Expected section heading warning for missing aria-labelledby target');
console.log('section-heading tests passed');
