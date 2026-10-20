export declare function normalizeGlobPattern(pattern: string): string;
export declare function parseGlobPatterns(inputs: readonly string[]): string[];
export declare function discoverFilesSync(patterns: readonly string[], cwd?: string): string[];
export declare function discoverFiles(patterns: readonly string[], cwd?: string): Promise<string[]>;
