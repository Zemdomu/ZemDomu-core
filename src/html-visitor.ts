export interface HtmlVisitor {
  enter?(node: import('./simpleHtmlParser').Node): void;
  exit?(node: import('./simpleHtmlParser').Node): void;
}

export function visitHtml(
  node: import('./simpleHtmlParser').Node,
  visitor: HtmlVisitor
): void {
  visitor.enter?.(node);
  if (node.type === 'element') {
    for (const child of node.children) {
      visitHtml(child, visitor);
    }
  }
  visitor.exit?.(node);
}
