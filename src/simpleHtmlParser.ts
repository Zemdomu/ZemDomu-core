export type Node = ElementNode | TextNode | CommentNode;

export interface CommentNode {
  type: 'comment';
  text: string;
  startIndex: number;
}

export interface ElementNode {
  type: 'element';
  tagName: string;
  attrs: Record<string, string>;
  children: Node[];
  startIndex: number;
}

export interface TextNode {
  type: 'text';
  text: string;
  startIndex: number;
}

export function parse(html: string): ElementNode {
  // Simple tokenizer omitted for brevity.
  // Returns a root node with children.
  return { type: 'element', tagName: 'root', attrs: {}, children: [], startIndex: 0 };
}