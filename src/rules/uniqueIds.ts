import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr } from './utils';
import { isResolvedPage, isUnconditional, relatedCompositionForFact, relatedForFact, sourceForFact } from './page-utils';

export default function uniqueIds(): Rule {
  const ids = new Set<string>();
  const htmlIdOwners = new Map<
    string,
    { node: Extract<Node, { type: 'element' }>; parent: Extract<Node, { type: 'element' }> | null }
  >();
  const htmlStack: Array<Extract<Node, { type: 'element' }>> = [];
  return {
    name: 'uniqueIds',
    enterHtml(node: Node): LintResult[] {
      if (node.type !== 'element') return [];
      const parent = htmlStack[htmlStack.length - 1] ?? null;
      htmlStack.push(node);
      if (node.attrs.id) {
        const id = String(node.attrs.id);
        if (ids.has(id)) {
          const first = htmlIdOwners.get(id);
          const firstStartsBranch = first && (
            Object.prototype.hasOwnProperty.call(first.node.attrs, 'v-if') ||
            Object.prototype.hasOwnProperty.call(first.node.attrs, 'v-else-if')
          );
          const currentContinuesBranch =
            Object.prototype.hasOwnProperty.call(node.attrs, 'v-else-if') ||
            Object.prototype.hasOwnProperty.call(node.attrs, 'v-else');
          const branchAdjacent = first?.parent && first.parent === parent && (() => {
            const firstIndex = first.parent.children.indexOf(first.node);
            const currentIndex = first.parent.children.indexOf(node);
            return firstIndex >= 0 && currentIndex > firstIndex && first.parent.children
              .slice(firstIndex + 1, currentIndex)
              .every((child) => child.type === 'comment' || (child.type === 'text' && !child.text.trim()));
          })();
          if (branchAdjacent && firstStartsBranch && currentContinuesBranch) {
            return [];
          }
          return [{ line: 0, column: 0, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
        }
        ids.add(id);
        htmlIdOwners.set(id, { node, parent });
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type === 'element') htmlStack.pop();
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const id = getJsxAttr(path.node.openingElement, 'id');
      if (id) {
        if (ids.has(id)) {
          const line = (path.node.openingElement.loc?.start.line ?? 1) - 1;
          const column = path.node.openingElement.loc?.start.column ?? 0;
          return [{ line, column, message: `Duplicate id "${id}"`, rule: 'uniqueIds' }];
        }
        ids.add(id);
      }
      return [];
    },
    analyzePage(context): LintResult[] {
      if (!isResolvedPage(context)) return [];
      const firstById = new Map<string, (typeof context.page.facts)[number]>();
      const results: LintResult[] = [];
      for (const fact of context.page.facts) {
        if (fact.kind !== 'document-id' || typeof fact.value !== 'string' || !isUnconditional(fact)) {
          continue;
        }
        const first = firstById.get(fact.value);
        if (!first) {
          firstById.set(fact.value, fact);
          continue;
        }
        const source = sourceForFact(fact, context);
        if (!source) continue;
        const repeatedInstance = first.renderNodeId === fact.renderNodeId;
        const related = [
          ...(repeatedInstance ? [] : [relatedForFact(first, context, `First element with id "${fact.value}"`)]),
          relatedCompositionForFact(first, context, 'First conflicting component usage'),
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        results.push({
          ...source,
          message: `Duplicate id "${fact.value}" in composed page`,
          rule: 'uniqueIds',
          ...(related.length ? { related } : {}),
          pageEditSafe: !repeatedInstance,
        });
      }
      return results;
    },
  };
}
