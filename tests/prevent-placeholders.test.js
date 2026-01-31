const assert = require('assert');
const { lint } = require('../out/index');

const goodCases = [
  '<p>Ready</p>',
  '<div data-note="todo"></div>',
  '<span title="TODO"></span>',
  '<div aria-label="Close"></div>',
];

goodCases.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    !results.some(r => r.rule === 'preventZemdomuPlaceholders'),
    `Did not expect placeholder warning for good case ${idx + 1}`
  );
});

const badCases = [
  '<p>TODO-ZMD</p>',
  '<label for="TODO-ZMD">TODO-ZMD</label>',
  '<div aria-label="TODO-ZMD"></div>',
  '<div data-note="prefix TODO-ZMD suffix"></div>',
  '<button title="TODO-ZMD"></button>',
];

badCases.forEach((html, idx) => {
  const results = lint(html);
  assert.ok(
    results.some(r => r.rule === 'preventZemdomuPlaceholders'),
    `Expected placeholder warning for bad case ${idx + 1}`
  );
});

console.log('prevent placeholders tests passed');
