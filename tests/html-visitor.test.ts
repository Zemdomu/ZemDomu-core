import { strict as assert } from 'assert';
import { parseHtml, visitHtml, HtmlVisitor } from '../src/index';

describe('visitHtml', () => {
  it('walks nodes in depth-first order', () => {
    const root = parseHtml('<div><span>hi</span></div>');
    const types: string[] = [];
    const visitor: HtmlVisitor = {
      enter(node) {
        types.push(node.type);
      },
      exit(node) {
        types.push('/' + node.type);
      },
    };
    visitHtml(root, visitor);
    assert.deepStrictEqual(types, [
      'element',
      'element',
      'element',
      'text',
      '/text',
      '/element',
      '/element',
      '/element',
    ]);
  });
});
