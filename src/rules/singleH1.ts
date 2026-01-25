import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxRenderGroup, getTag } from './utils';

export default function singleH1(): Rule {
  const groupCounts = new Map<string, number>();
  const htmlStack: Array<{
    groupKey: string;
    pendingIfGroup?: string;
    pendingIfExclusive?: boolean;
  }> = [];
  let htmlGroupId = 0;

  const incrementGroup = (groupKey: string): number => {
    const next = (groupCounts.get(groupKey) ?? 0) + 1;
    groupCounts.set(groupKey, next);
    return next;
  };

  const mergeChainIntoBase = (chainId: string, baseGroup: string) => {
    let total = 0;
    for (const [key, value] of groupCounts.entries()) {
      if (key.startsWith(`${chainId}:`)) {
        total += value;
        groupCounts.delete(key);
      }
    }
    if (total > 0) {
      groupCounts.set(baseGroup, (groupCounts.get(baseGroup) ?? 0) + total);
    }
  };
  return {
    name: 'singleH1',
    init() {
      groupCounts.clear();
      htmlStack.length = 0;
      htmlGroupId = 0;
    },
    enterHtml(node: Node): LintResult[] {
      if (node.type === 'element') {
        const parentCtx = htmlStack[htmlStack.length - 1] ?? {
          groupKey: 'root',
        };
        const hasIf = Object.prototype.hasOwnProperty.call(node.attrs, 'v-if');
        const hasElseIf = Object.prototype.hasOwnProperty.call(node.attrs, 'v-else-if');
        const hasElse = Object.prototype.hasOwnProperty.call(node.attrs, 'v-else');

        if (!hasElseIf && !hasElse && parentCtx.pendingIfGroup) {
          if (parentCtx.pendingIfExclusive) {
            parentCtx.pendingIfGroup = undefined;
            parentCtx.pendingIfExclusive = undefined;
          } else {
            mergeChainIntoBase(parentCtx.pendingIfGroup, parentCtx.groupKey);
            parentCtx.pendingIfGroup = undefined;
            parentCtx.pendingIfExclusive = undefined;
          }
        }

        let groupKey = parentCtx.groupKey;
        if (hasElseIf || hasElse) {
          const chainId =
            parentCtx.pendingIfGroup ?? `${parentCtx.groupKey}|cond:${++htmlGroupId}`;
          parentCtx.pendingIfGroup = chainId;
          parentCtx.pendingIfExclusive = true;
          const branch = hasElse ? 'else' : 'else-if';
          groupKey = `${chainId}:${branch}`;
        } else if (hasIf) {
          const chainId = `${parentCtx.groupKey}|cond:${++htmlGroupId}`;
          parentCtx.pendingIfGroup = chainId;
          parentCtx.pendingIfExclusive = false;
          groupKey = `${chainId}:if`;
        }

        htmlStack.push({ groupKey });
      }

      if (node.type === 'element' && node.tagName === 'h1') {
        const ctx = htmlStack[htmlStack.length - 1];
        const groupKey = ctx?.groupKey ?? 'root';
        if (incrementGroup(groupKey) > 1) {
          return [{ line: 0, column: 0, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
        }
      }
      return [];
    },
    exitHtml(node: Node): LintResult[] {
      if (node.type !== 'element') return [];
      const ctx = htmlStack[htmlStack.length - 1];
      if (ctx?.pendingIfGroup) {
        if (ctx.pendingIfExclusive) {
          ctx.pendingIfGroup = undefined;
          ctx.pendingIfExclusive = undefined;
        } else {
          mergeChainIntoBase(ctx.pendingIfGroup, ctx.groupKey);
          ctx.pendingIfGroup = undefined;
          ctx.pendingIfExclusive = undefined;
        }
      }
      htmlStack.pop();
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const tag = getTag(path);
      if (tag === 'h1') {
        const group = getJsxRenderGroup(path);
        if (incrementGroup(group) > 1) {
          const line = (path.node.openingElement.loc?.start.line ?? 1) - 1;
          const column = path.node.openingElement.loc?.start.column ?? 0;
          return [{ line, column, message: 'Only one <h1> allowed per document', rule: 'singleH1' }];
        }
      }
      return [];
    },
  };
}
