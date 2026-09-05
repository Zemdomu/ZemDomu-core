export type Node = ElementNode | TextNode | CommentNode;
export interface ElementNode {
    type: 'element';
    tagName: string;
    attrs: Record<string, string>;
    children: Node[];
    startIndex: number;
    selfClosing?: boolean;
}
export interface TextNode {
    type: 'text';
    text: string;
    startIndex: number;
}
export interface CommentNode {
    type: 'comment';
    text: string;
    startIndex: number;
}
export declare function parse(html: string): ElementNode;
