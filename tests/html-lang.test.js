const assert = require('assert');
const { lint } = require('../out/index');

// Negative cases
let html = '<html></html>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected lang attribute warning');

html = '<html lang=""></html>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected empty lang warning');

html = '<html lang="en_US"></html>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected invalid lang warning for underscore');

html = '<html lang="english"></html>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireHtmlLang'), 'Expected invalid lang warning for non-BCP47 tag');

// Positive case
html = '<html lang="en"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning');
html = '<html lang="en-US"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning for en-US');

html = '<html lang="sv"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning for sv');

html = '<html lang="sv-SE"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning for sv-SE');

html = '<html lang="es-419"></html>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireHtmlLang'), 'Did not expect lang warning for es-419');
console.log('html-lang tests passed');
