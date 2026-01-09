export type VueSfcBlock = {
    content: string;
    start: number;
    end: number;
    attrs: Record<string, string | true>;
};
export declare function extractVueTemplate(source: string): VueSfcBlock | null;
export declare function extractVueScripts(source: string): VueSfcBlock[];
export declare function isHtmlVueTemplate(block: VueSfcBlock | null): block is VueSfcBlock;
