const assert = require('assert');
const { lint } = require(process.env.ZEMDOMU_CORE_ENTRY || '../out/index');

// Negative case: empty <strong>
let html = '<div><strong></strong></div>';
let results = lint(html);
assert.ok(results.some(r => r.rule === 'preventEmptyInlineTags'), 'Expected empty inline tag warning');

// Positive case: inline tag containing text
html = '<div><strong>text</strong></div>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'preventEmptyInlineTags'), 'Did not expect inline tag warning');

// Nested visible content and named images also make the inline element non-empty.
html = '<div><strong><span>text</span></strong><em><img alt="Status"></em></div>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'preventEmptyInlineTags'), 'Did not expect nested inline content warning');

// CSS icon elements intentionally use classes or ARIA metadata instead of text.
html = '<button><i class="fas fa-search"></i></button><i aria-hidden="true"></i>';
results = lint(html);
assert.ok(!results.some(r => r.rule === 'preventEmptyInlineTags'), 'Did not expect intentional icon warning');

const jsx = 'export default () => <button><i className="fas fa-search" /></button>;';
results = lint(jsx);
assert.ok(!results.some(r => r.rule === 'preventEmptyInlineTags'), 'Did not expect JSX icon warning');
console.log('prevent-empty-inline tests passed');
