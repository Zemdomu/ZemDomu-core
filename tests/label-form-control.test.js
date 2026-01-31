const assert = require('assert');
const { lint } = require('../out/index');

const goodCases = [
  '<div><label for="name">Name</label><input id="name" /></div>',
  '<div><input aria-label="Name" /></div>',
  '<div><span id="label">Name</span><input aria-labelledby="label" /></div>',
];

goodCases.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    !results.some(r => r.rule === 'requireLabelForFormControls'),
    `Did not expect label warning for good case ${idx + 1}`
  );
});

const badCases = [
  '<div><input id="name" /></div>',
  '<div><input /></div>',
  '<div><input aria-labelledby="missing" /></div>',
  '<div><span id="empty"></span><input aria-labelledby="empty" /></div>',
];

badCases.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    results.some(r => r.rule === 'requireLabelForFormControls'),
    `Expected label warning for bad case ${idx + 1}`
  );
});

console.log('label-form-control tests passed');
