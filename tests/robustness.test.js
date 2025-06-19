const assert = require('assert');
const { lint } = require('../out/index');

const html = '<div><li>Item</li></div>';
let results;
assert.doesNotThrow(() => { results = lint(html); }, 'Linter should not throw on invalid nesting');
assert.ok(results.some(r => r.rule === 'enforceListNesting'), 'Expected list nesting warning');
console.log('robustness tests passed');
