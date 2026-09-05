export interface HtmlVisitor {
    enter?(node: import('./simpleHtmlParser').Node): void;
    exit?(node: import('./simpleHtmlParser').Node): void;
}
export declare function visitHtml(node: import('./simpleHtmlParser').Node, visitor: HtmlVisitor): void;
