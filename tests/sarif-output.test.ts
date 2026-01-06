import { strict as assert } from 'assert';
import { lint } from '../src/linter';
import { resultsToSarif } from '../src/sarif';

const html = '<img />';
const results = lint(html);
const map = new Map<string, ReturnType<typeof lint>>();
map.set('test.html', results);

const sarif = resultsToSarif(map);
const run = sarif.runs[0];
assert.ok(run.tool.driver.rules[0].helpUri.includes('requireAltText'));
assert.equal(run.results[0].ruleId, 'ZMD004');
assert.equal(run.results[0].level, 'error');

console.log('SARIF output test passed');
