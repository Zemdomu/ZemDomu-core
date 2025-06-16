import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { LintResult } from '../linter';

export default function requireAltTextJSX(
  path: NodePath<t.JSXElement>
): LintResult[] {
  const opening = path.node.openingElement;
  const name = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
  if (name !== 'img') {
    return [];
  }
  const altAttr = opening.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name) &&
      a.name.name === 'alt'
  );
  if (
    !altAttr ||
    !t.isStringLiteral(altAttr.value) ||
    altAttr.value.value.trim() === ''
  ) {
    const line = (opening.loc?.start.line ?? 1) - 1;
    const column = opening.loc?.start.column ?? 0;
    return [
      {
        line,
        column,
        message: '<img> tag missing alt attribute',
        rule: 'requireAltText',
      },
    ];
  }
  return [];
}
