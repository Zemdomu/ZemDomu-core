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

// Returning to h1 after deeper headings closes the prior subsection
html = '<h2>Two</h2><h1>Reset</h1>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'enforceHeadingOrder'), 'Did not expect a warning when <h1> closes a deeper subsection');

// A reset is allowed, while the following upward skip still warns
html = '<h2>Two</h2><h1>Reset</h1><h4>Too deep</h4>';
results = lint(html);
const headingMessages = results.filter(r => r.rule === 'enforceHeadingOrder').map(r => r.message);
assert.ok(
  !headingMessages.some(msg => msg.includes('<h1>') && msg.includes('after <h2>')),
  'Did not expect reset <h1> to trigger a heading order warning'
);
assert.ok(
  headingMessages.some(msg => msg.includes('<h4>') && msg.includes('after <h1>')),
  'Expected skipped <h4> to trigger a heading order warning'
);
console.log('heading-order tests passed');
