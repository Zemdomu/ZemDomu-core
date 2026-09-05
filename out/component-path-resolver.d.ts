export declare class ComponentPathResolver {
    private static defaultRootDir;
    private static defaultDevMode;
    private resolveCache;
    private statCache;
    private aliasCache;
    private unresolved;
    private devMode;
    private tsconfigLoaded;
    private tsAliases;
    private readonly aliasFileLimit;
    private rootDir;
    constructor(rootDir?: string);
    /** @deprecated Pass rootDir to the constructor instead. */
    static setRootDir(dir: string): void;
    /** @deprecated Configure an individual resolver with updateDevMode instead. */
    static updateDevMode(dev: boolean): void;
    setRootDir(dir: string): void;
    updateDevMode(dev: boolean): void;
    private loadTsconfig;
    private tryExtensions;
    private resolveWithTsconfig;
    private static normalizeKey;
    private fileExists;
    resolve(importPath: string, currentPath: string): Promise<string | null>;
}
