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

// SVG cases
html = '<svg role="img"></svg>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireAltText'), 'Expected svg accessible-name warning');

html = '<svg role="img" aria-label="Logo"></svg>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireAltText'), 'Did not expect svg warning with aria-label');

html = '<svg role="img"><title>Logo</title></svg>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireAltText'), 'Did not expect svg warning with title');

html = '<a href="#"><svg></svg></a>';
results = lint(html);
assert.ok(results.some(r => r.rule === 'requireAltText'), 'Expected svg warning for icon-only link');

html = '<a href="#"><svg aria-label="Close"></svg></a>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireAltText'), 'Did not expect svg warning for labeled icon-only link');

html = '<button><svg></svg><span class="sr-only">Close</span></button>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'requireAltText'), 'Did not expect svg warning when not icon-only');
console.log('img-alt tests passed');
