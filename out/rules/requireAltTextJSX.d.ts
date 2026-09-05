import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { LintResult } from '../linter';
export default function requireAltTextJSX(path: NodePath<t.JSXElement>): LintResult[];
