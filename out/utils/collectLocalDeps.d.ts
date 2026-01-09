export type ResolveCtx = {
    rootDir: string;
    baseUrl?: string;
    paths?: Record<string, string[]>;
    maxDepth?: number;
};
export declare function collectLocalDeps(entries: string[], ctx: ResolveCtx): string[];
