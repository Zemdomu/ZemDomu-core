import assert from 'assert';
import { lint } from '../src/index';

describe('uniqueIds html', () => {
  it('detects duplicate ids', () => {
    const html = '<div id="dup"></div><span id="dup"></span>';
    const res = lint(html);
    assert.ok(res.some(r => r.rule === 'uniqueIds'), 'Expected duplicate id warning');
  });

  it('allows unique ids', () => {
    const html = '<div id="a"></div><span id="b"></span>';
    const res = lint(html);
    assert.ok(!res.some(r => r.rule === 'uniqueIds'), 'Did not expect duplicate id warning');
  });
});
