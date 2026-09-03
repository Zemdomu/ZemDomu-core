import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export class ComponentPathResolver {
  private static defaultRootDir = process.cwd();
  private static defaultDevMode = false;
  private resolveCache = new Map<string, string | null>();
  private statCache = new Map<string, boolean>();
  private aliasCache = new Map<string, Map<string, string>>();
  private unresolved = new Set<string>();
  private devMode = ComponentPathResolver.defaultDevMode;
  private tsconfigLoaded = false;
  private tsAliases: Array<{ prefix: string; wildcard: boolean; targets: string[] }> = [];
  private readonly aliasFileLimit = 100;
  private rootDir: string;

  constructor(rootDir: string = ComponentPathResolver.defaultRootDir) {
    this.rootDir = path.resolve(rootDir);
  }

  /** @deprecated Pass rootDir to the constructor instead. */
  static setRootDir(dir: string) {
    this.defaultRootDir = path.resolve(dir);
  }

  /** @deprecated Configure an individual resolver with updateDevMode instead. */
  static updateDevMode(dev: boolean) {
    this.defaultDevMode = dev;
  }

  setRootDir(dir: string) {
    this.rootDir = path.resolve(dir);
    this.resolveCache.clear();
    this.statCache.clear();
    this.aliasCache.clear();
    this.unresolved.clear();
    this.tsconfigLoaded = false;
    this.tsAliases = [];
  }

  updateDevMode(dev: boolean) {
    this.devMode = dev;
  }

  private async loadTsconfig() {
    if (this.tsconfigLoaded) return;
    this.tsconfigLoaded = true;

    const root = this.rootDir;
    const tsconfigPath = path.join(root, 'tsconfig.json');
    try {
      const buf = await fs.readFile(tsconfigPath, 'utf8');
      const json = JSON.parse(buf);
      const opts = json.compilerOptions || {};
      const baseUrl = opts.baseUrl ? path.resolve(root, opts.baseUrl) : root;
      const paths = opts.paths || {};
      for (const [alias, targets] of Object.entries(paths) as [string, string[]][]) {
        const prefix = alias.replace(/\*$/, '').replace(/\/$/, '');
        const wildcard = alias.includes('*');
        const mapped: string[] = [];
        for (const t of targets) {
          const cleaned = t.replace(/\*$/, '').replace(/\/$/, '');
          mapped.push(path.resolve(baseUrl, cleaned));
        }
        this.tsAliases.push({ prefix, wildcard, targets: mapped });
      }
    } catch {
      // ignore
    }
  }

  private async tryExtensions(base: string): Promise<string | null> {
    if (path.extname(base)) {
      if (await this.fileExists(base)) return base;
    } else {
      const exts = ['.tsx', '.jsx', '.ts', '.js', '.vue'];
      for (const ext of exts) {
        const candidate = `${base}${ext}`;
        if (await this.fileExists(candidate)) return candidate;
      }
      for (const ext of exts) {
        const candidate = path.join(base, `index${ext}`);
        if (await this.fileExists(candidate)) return candidate;
      }
      if (await this.fileExists(base)) return base;
    }
    return null;
  }

  private async resolveWithTsconfig(importPath: string): Promise<string | null> {
    await this.loadTsconfig();
    for (const entry of this.tsAliases) {
      if (entry.wildcard) {
        if (!importPath.startsWith(entry.prefix)) continue;
        const rest = importPath.substring(entry.prefix.length);
        for (const tgt of entry.targets) {
          const base = path.join(tgt, rest);
          const r = await this.tryExtensions(base);
          if (r) return r;
        }
      } else {
        if (importPath === entry.prefix || importPath.startsWith(entry.prefix + '/')) {
          let rest = '';
          if (importPath.length > entry.prefix.length) {
            rest = importPath.substring(entry.prefix.length);
            if (rest.startsWith('/')) rest = rest.substring(1);
          }
          for (const tgt of entry.targets) {
            const base = rest ? path.join(tgt, rest) : tgt;
            const r = await this.tryExtensions(base);
            if (r) return r;
          }
        }
      }
    }
    return null;
  }

  private static normalizeKey(p: string): string {
    return p
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .replace(/\.(tsx|ts|jsx|js|vue)$/, '')
      .replace(/\/index$/, '')
      .toLowerCase();
  }

  private async fileExists(p: string): Promise<boolean> {
    if (this.statCache.has(p)) {
      return this.statCache.get(p)!;
    }
    try {
      await fs.stat(p);
      this.statCache.set(p, true);
      return true;
    } catch {
      this.statCache.set(p, false);
      return false;
    }
  }

  async resolve(importPath: string, currentPath: string): Promise<string | null> {
    const tStart = Date.now();
    const rawKey = importPath.startsWith('.')
      ? path.resolve(path.dirname(currentPath), importPath)
      : importPath;
    const key = ComponentPathResolver.normalizeKey(rawKey);
    if (this.unresolved.has(key)) return null;
    if (this.resolveCache.has(key)) {
      return this.resolveCache.get(key)!;
    }

    let result: string | null = null;
    try {
      if (importPath.startsWith('.')) {
        const base = path.resolve(path.dirname(currentPath), importPath);
        result = await this.tryExtensions(base);
      } else {
        result = await this.resolveWithTsconfig(importPath);

        if (!result) {
          const prefix = importPath.split('/')[0];
          let alias = this.aliasCache.get(prefix);
          if (!alias) {
          const pattern = `**/${prefix}/**/*.{tsx,jsx,ts,js,vue}`;
          const files = await glob(pattern, {
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
            if (idx === -1) continue;
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
                const cached = this.resolveCache.get(pKey)!;
                if (cached) { result = cached; break; }
                continue;
              }
              const matches = await glob(ptn, {
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
              } else {
                this.resolveCache.set(pKey, null);
              }
            }
          }
        }
      }
    } catch {
      result = null;
    }
    this.resolveCache.set(key, result);
    if (result === null) this.unresolved.add(key);
    const tTotal = Date.now() - tStart;
    if (this.devMode) {
      console.debug(`[ZemDomu] resolved ${importPath} -> ${result} (${tTotal}ms)`);
    }
    return result;
  }
}
