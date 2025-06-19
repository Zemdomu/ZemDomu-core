const assert = require('assert');
const { lint } = require('../out/index');

// Negative cases
let html = '<html></html>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected lang attribute warning');

html = '<html lang=""></html>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected empty lang warning');

// Positive case
html = '<html lang="en"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning');
console.log('html-lang tests passed');
