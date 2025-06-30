import assert from 'assert';
import { lint } from '../src/index';

describe('edge cases', () => {
  it('handles empty input', () => {
    const res = lint('');
    assert.deepStrictEqual(res, []);
  });

  it('handles comments only', () => {
    const res = lint('<!-- just a comment -->');
    assert.deepStrictEqual(res, []);
  });
});
