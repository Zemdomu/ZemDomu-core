const assert = require('assert');
const { lint } = require('../out/index');

const html = '<div id="dup"></div><span id="dup"></span>';
const res = lint(html);
assert.ok(res.some(r => r.rule === 'uniqueIds'), 'Expected duplicate id warning');
console.log('Unique id test passed');
