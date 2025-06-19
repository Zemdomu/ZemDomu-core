const assert = require('assert');
const { lint } = require('../out/index');

// Positive case: input has associated label
const good = '<div><label for="name">Name</label><input id="name" /></div>';
let results = lint(good);
assert.ok(!results.some(r => r.rule === 'requireLabelForFormControls'), 'Did not expect label warning');

// Negative case: missing label
const bad = '<div><input id="name" /></div>';
results = lint(bad);
assert.ok(results.some(r => r.rule === 'requireLabelForFormControls'), 'Expected label warning');
console.log('label-form-control tests passed');
