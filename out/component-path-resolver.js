"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentPathResolver = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class ComponentPathResolver {
    constructor(rootDir = ComponentPathResolver.defaultRootDir) {
        this.resolveCache = new Map();
        this.statCache = new Map();
        this.aliasCache = new Map();
        this.unresolved = new Set();
        this.devMode = ComponentPathResolver.defaultDevMode;
        this.tsconfigLoaded = false;
        this.tsAliases = [];
        this.aliasFileLimit = 100;
        this.rootDir = path.resolve(rootDir);
    }
    /** @deprecated Pass rootDir to the constructor instead. */
    static setRootDir(dir) {
        this.defaultRootDir = path.resolve(dir);
    }
    /** @deprecated Configure an individual resolver with updateDevMode instead. */
    static updateDevMode(dev) {
        this.defaultDevMode = dev;
    }
    setRootDir(dir) {
        this.rootDir = path.resolve(dir);
        this.resolveCache.clear();
        this.statCache.clear();
        this.aliasCache.clear();
        this.unresolved.clear();
        this.tsconfigLoaded = false;
        this.tsAliases = [];
    }
    updateDevMode(dev) {
        this.devMode = dev;
    }
    async loadTsconfig() {
        if (this.tsconfigLoaded)
            return;
        this.tsconfigLoaded = true;
        const root = this.rootDir;
        const tsconfigPath = path.join(root, 'tsconfig.json');
        try {
            const buf = await fs.readFile(tsconfigPath, 'utf8');
            const json = JSON.parse(buf);
            const opts = json.compilerOptions || {};
            const baseUrl = opts.baseUrl ? path.resolve(root, opts.baseUrl) : root;
            const paths = opts.paths || {};
            for (const [alias, targets] of Object.entries(paths)) {
                const prefix = alias.replace(/\*$/, '').replace(/\/$/, '');
                const wildcard = alias.includes('*');
                const mapped = [];
                for (const t of targets) {
                    const cleaned = t.replace(/\*$/, '').replace(/\/$/, '');
                    mapped.push(path.resolve(baseUrl, cleaned));
                }
                this.tsAliases.push({ prefix, wildcard, targets: mapped });
            }
        }
        catch {
            // ignore
        }
    }
    async tryExtensions(base) {
        if (path.extname(base)) {
            if (await this.fileExists(base))
                return base;
        }
        else {
            const exts = ['.tsx', '.jsx', '.ts', '.js', '.vue'];
            for (const ext of exts) {
                const candidate = `${base}${ext}`;
                if (await this.fileExists(candidate))
                    return candidate;
            }
            for (const ext of exts) {
                const candidate = path.join(base, `index${ext}`);
                if (await this.fileExists(candidate))
                    return candidate;
            }
            if (await this.fileExists(base))
                return base;
        }
        return null;
    }
    async resolveWithTsconfig(importPath) {
        await this.loadTsconfig();
        for (const entry of this.tsAliases) {
            if (entry.wildcard) {
                if (!importPath.startsWith(entry.prefix))
                    continue;
                const rest = importPath.substring(entry.prefix.length);
                for (const tgt of entry.targets) {
                    const base = path.join(tgt, rest);
                    const r = await this.tryExtensions(base);
                    if (r)
                        return r;
                }
            }
            else {
                if (importPath === entry.prefix || importPath.startsWith(entry.prefix + '/')) {
                    let rest = '';
                    if (importPath.length > entry.prefix.length) {
                        rest = importPath.substring(entry.prefix.length);
                        if (rest.startsWith('/'))
                            rest = rest.substring(1);
                    }
                    for (const tgt of entry.targets) {
                        const base = rest ? path.join(tgt, rest) : tgt;
                        const r = await this.tryExtensions(base);
                        if (r)
                            return r;
                    }
                }
            }
        }
        return null;
    }
    static normalizeKey(p) {
        return p
            .replace(/\\/g, '/')
            .replace(/\/+$/, '')
            .replace(/\.(tsx|ts|jsx|js|vue)$/, '')
            .replace(/\/index$/, '')
            .toLowerCase();
    }
    async fileExists(p) {
        if (this.statCache.has(p)) {
            return this.statCache.get(p);
        }
        try {
            await fs.stat(p);
            this.statCache.set(p, true);
            return true;
        }
        catch {
            this.statCache.set(p, false);
            return false;
        }
    }
    async resolve(importPath, currentPath) {
        const tStart = Date.now();
        const rawKey = importPath.startsWith('.')
            ? path.resolve(path.dirname(currentPath), importPath)
            : importPath;
        const key = ComponentPathResolver.normalizeKey(rawKey);
        if (this.unresolved.has(key))
            return null;
        if (this.resolveCache.has(key)) {
            return this.resolveCache.get(key);
        }
        let result = null;
        try {
            if (importPath.startsWith('.')) {
                const base = path.resolve(path.dirname(currentPath), importPath);
                result = await this.tryExtensions(base);
            }
            else {
                result = await this.resolveWithTsconfig(importPath);
                if (!result) {
                    const prefix = importPath.split('/')[0];
                    let alias = this.aliasCache.get(prefix);
                    if (!alias) {
                        const pattern = `**/${prefix}/**/*.{tsx,jsx,ts,js,vue}`;
                        const files = await (0, glob_1.glob)(pattern, {
                            cwd: this.rootDir,
                            dot: false,
                            follow: false,
                            ignore: '**/node_modules/**',
                            nodir: true,
                        });
                        files.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
                        alias = new Map();
                        for (const relPath of files.slice(0, this.aliasFileLimit)) {
                            const rel = path.resolve(this.rootDir, relPath).replace(/\\/g, '/');
                            const idx = rel.lastIndexOf(`/${prefix}/`);
                            if (idx === -1)
                                continue;
                            const after = rel.substring(idx + prefix.length + 2).replace(/\.(tsx|ts|jsx|js|vue)$/, '');
                            const key1 = ComponentPathResolver.normalizeKey(`${prefix}/${after}`);
                            alias.set(key1, rel);
                            if (after.endsWith('/index')) {
                                const trimmed = after.replace(/\/index$/, '');
                                alias.set(ComponentPathResolver.normalizeKey(`${prefix}/${trimmed}`), rel);
                            }
                        }
                        this.aliasCache.set(prefix, alias);
                    }
                    const normImport = ComponentPathResolver.normalizeKey(importPath);
                    result = alias.get(normImport) || null;
                    if (!result) {
                        const patterns = [
                            `**/${importPath}.{tsx,jsx,ts,js,vue}`,
                            `**/${importPath}/index.{tsx,jsx,ts,js,vue}`
                        ];
                        for (const ptn of patterns) {
                            const pKey = `glob:${ptn}`;
                            if (this.resolveCache.has(pKey)) {
                                const cached = this.resolveCache.get(pKey);
                                if (cached) {
                                    result = cached;
                                    break;
                                }
                                continue;
                            }
                            const matches = await (0, glob_1.glob)(ptn, {
                                cwd: this.rootDir,
                                dot: false,
                                follow: false,
                                ignore: '**/node_modules/**',
                                nodir: true,
                            });
                            matches.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
                            if (matches.length) {
                                result = path.resolve(this.rootDir, matches[0]);
                                this.resolveCache.set(pKey, result);
                                break;
                            }
                            else {
                                this.resolveCache.set(pKey, null);
                            }
                        }
                    }
                }
            }
        }
        catch {
            result = null;
        }
        this.resolveCache.set(key, result);
        if (result === null)
            this.unresolved.add(key);
        const tTotal = Date.now() - tStart;
        if (this.devMode) {
            console.debug(`[ZemDomu] resolved ${importPath} -> ${result} (${tTotal}ms)`);
        }
        return result;
    }
}
exports.ComponentPathResolver = ComponentPathResolver;
ComponentPathResolver.defaultRootDir = process.cwd();
ComponentPathResolver.defaultDevMode = false;
