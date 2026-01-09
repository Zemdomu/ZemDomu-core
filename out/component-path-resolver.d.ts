export declare class ComponentPathResolver {
    private static resolveCache;
    private static statCache;
    private static aliasCache;
    private static unresolved;
    private static devMode;
    private static tsconfigLoaded;
    private static tsAliases;
    private static readonly aliasFileLimit;
    private static rootDir;
    static setRootDir(dir: string): void;
    static updateDevMode(dev: boolean): void;
    private static loadTsconfig;
    private tryExtensions;
    private resolveWithTsconfig;
    private static normalizeKey;
    private fileExists;
    resolve(importPath: string, currentPath: string): Promise<string | null>;
}
