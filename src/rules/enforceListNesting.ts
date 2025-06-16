import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getTag } from './utils';

export default function enforceListNesting(): Rule {
  const stack: string[] = [];
  return {
    name: 'enforceListNesting',
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        stack.push(node.tagName);
        if (node.tagName === 'li') {
          const parent = stack[stack.length - 2];
          if (!parent || !['ul', 'ol'].includes(parent)) {
            return [{ line: 0, column: 0, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
          }
        }
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        stack.pop();
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'li') {
        const parent = path.parentPath?.parentPath?.node as t.JSXElement | undefined;
        if (parent) {
          const pTag = t.isJSXIdentifier(parent.openingElement.name) ? parent.openingElement.name.name.toLowerCase() : '';
          if (!['ul', 'ol'].includes(pTag)) {
            const line = (path.node.loc?.start.line ?? 1) - 1;
            const column = path.node.loc?.start.column ?? 0;
            return [{ line, column, message: '<li> must be inside a <ul> or <ol>', rule: 'enforceListNesting' }];
          }
        }
      }
      return [];
    },
  };
}
