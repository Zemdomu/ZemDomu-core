const assert = require('assert');
const { lint } = require('../out/index');

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>ZemDomu Test</title>
  </head>
  <body>
    <h1>h1 one</h1>
    <h1>h1 two</h1>
    <section>
      <p>Content with <strong></strong></p>
    </section>
  </body>
</html>
`;

const results = lint(html);
assert.ok(results.some(r => r.rule === 'singleH1'), 'Expected singleH1 warning');
console.log('bad-html tests passed');
