import { lint } from './src';

const html = `
<html>
  <body>
    <img src="foo.png">
    <h1>Title</h1>
    <h3>Subheading</h3>
    <li>Orphan item</li>
  </body>
</html>
`;

const results = lint(html);

console.log('Lint results:');
for (const res of results) {
  console.log(`- ${res.rule}: ${res.message} (line ${res.line}, column ${res.column})`);
}

const alt = results.find(r => r.rule === 'requireAltText');
const heading = results.find(r => r.rule === 'enforceHeadingOrder');
const list = results.find(r => r.rule === 'enforceListNesting');

console.assert(Boolean(alt), 'requireAltText should trigger on missing alt');
console.assert(Boolean(heading), 'enforceHeadingOrder should trigger for skipped heading level');
console.assert(Boolean(list), 'enforceListNesting should trigger for <li> outside list');

console.log('All assertions passed.');
