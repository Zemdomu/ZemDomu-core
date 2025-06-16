const assert = require('assert');
const { lint } = require('../out/index');

const jsx = '<div><label for="name">Name</label><input id="name" /></div>';
const results = lint(jsx);
const hasLabelWarning = results.some(r => r.message.includes('Form control'));
assert.strictEqual(hasLabelWarning, false, 'Expected no Form control warning');
console.log('Label tests passed');
