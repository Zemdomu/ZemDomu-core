const assert = require('assert');
const { lint } = require('../out/index');

// Negative case: duplicate ids
let html = '<div id="dup"></div><span id="dup"></span>';
let res = lint(html);
assert.ok(res.some(r => r.rule === 'uniqueIds'), 'Expected duplicate id warning');

// Positive case: unique ids
html = '<div id="a"></div><span id="b"></span>';
res = lint(html);
assert.ok(!res.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
console.log('unique-ids tests passed');
