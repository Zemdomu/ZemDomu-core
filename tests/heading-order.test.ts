import assert from 'assert';
import { lint } from '../src/index';

describe('heading order', () => {
  it('flags h1 to h3 skip', () => {
    const html = '<h1>One</h1><h3>Two</h3>';
    const results = lint(html);
    assert.ok(results.some(r => r.rule === 'enforceHeadingOrder'), 'Expected heading order warning');
  });

  it('allows sequential headings', () => {
    const html = '<h1>One</h1><h2>Two</h2>';
    const results = lint(html);
    assert.ok(!results.some(r => r.rule === 'enforceHeadingOrder'), 'Did not expect heading order warning');
  });

  it('allows returning to h1 after closing a subsection', () => {
    const html = '<h2>Two</h2><h1>One</h1>';
    const results = lint(html);
    assert.ok(!results.some(r => r.rule === 'enforceHeadingOrder'));
  });

  it('allows downward rank changes that close nested subsections', () => {
    const html = '<h1>One</h1><h2>Two</h2><h4>Four</h4><h2>Another section</h2>';
    const results = lint(html).filter(r => r.rule === 'enforceHeadingOrder');
    assert.strictEqual(results.length, 1, 'Only the upward h2 to h4 skip should warn');
  });
});
