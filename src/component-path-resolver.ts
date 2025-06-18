import * as fs from 'fs/promises';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const glob: any = require('glob');


let vscodeApi: any | undefined;
try {
  vscodeApi = require('vscode');
} catch {
  vscodeApi = undefined;
}

export class ComponentPathResolver {
  private static resolveCache = new Map<string, string | null>();
  private static statCache = new Map<string, boolean>();
  private static aliasCache = new Map<string, Map<string, string>>();
  private static unresolved = new Set<string>();
  private static devMode = false;
  private static tsconfigLoaded = false;
  private static tsAliases: Array<{ prefix: string; wildcard: boolean; targets: string[] }> = [];
  private static readonly aliasFileLimit = 100;
  private static rootDir: string = process.cwd();

  static setRootDir(dir: string) {
    this.rootDir = dir;
  }

  static updateDevMode(dev: boolean) {
    this.devMode = dev;
  }

  private static async loadTsconfig() {
    if (this.tsconfigLoaded) return;
    this.tsconfigLoaded = true;

    const folder = vscodeApi?.workspace.workspaceFolders?.[0];
    const root = folder ? folder.uri.fsPath : this.rootDir;
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
      const exts = ['.tsx', '.jsx', '.ts', '.js'];
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
    await ComponentPathResolver.loadTsconfig();
    for (const entry of ComponentPathResolver.tsAliases) {
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
      .replace(/\.(tsx|ts|jsx|js)$/, '')
      .replace(/\/index$/, '')
      .toLowerCase();
  }

  private async fileExists(p: string): Promise<boolean> {
    if (ComponentPathResolver.statCache.has(p)) {
      return ComponentPathResolver.statCache.get(p)!;
    }
    try {
      await fs.stat(p);
      ComponentPathResolver.statCache.set(p, true);
      return true;
    } catch {
      ComponentPathResolver.statCache.set(p, false);
      return false;
    }
  }

  async resolve(importPath: string, currentPath: string): Promise<string | null> {
    const tStart = Date.now();
    const rawKey = importPath.startsWith('.')
      ? path.resolve(path.dirname(currentPath), importPath)
      : importPath;
    const key = ComponentPathResolver.normalizeKey(rawKey);
    if (ComponentPathResolver.unresolved.has(key)) return null;
    if (ComponentPathResolver.resolveCache.has(key)) {
      return ComponentPathResolver.resolveCache.get(key)!;
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
          let alias = ComponentPathResolver.aliasCache.get(prefix);
          if (!alias) {
          const pattern = `**/${prefix}/**/*.{tsx,jsx,ts,js}`;
          const files = await new Promise<string[]>((resolve, reject) => {
            glob(
              pattern,
              { cwd: ComponentPathResolver.rootDir, ignore: '**/node_modules/**', nodir: true },
              (err: any, matches: any) => (err ? reject(err) : resolve(matches))
            );
          });
          alias = new Map();
          for (const relPath of files.slice(0, ComponentPathResolver.aliasFileLimit)) {
            const rel = path.resolve(ComponentPathResolver.rootDir, relPath).replace(/\\/g, '/');
            const idx = rel.lastIndexOf(`/${prefix}/`);
            if (idx === -1) continue;
            const after = rel.substring(idx + prefix.length + 2).replace(/\.(tsx|ts|jsx|js)$/, '');
            const key1 = ComponentPathResolver.normalizeKey(`${prefix}/${after}`);
            alias.set(key1, rel);
            if (after.endsWith('/index')) {
              const trimmed = after.replace(/\/index$/, '');
              alias.set(ComponentPathResolver.normalizeKey(`${prefix}/${trimmed}`), rel);
            }
          }
          ComponentPathResolver.aliasCache.set(prefix, alias);
          }

          const normImport = ComponentPathResolver.normalizeKey(importPath);
          result = alias.get(normImport) || null;

          if (!result) {
            const patterns = [
              `**/${importPath}.{tsx,jsx,ts,js}`,
              `**/${importPath}/index.{tsx,jsx,ts,js}`
            ];
            for (const ptn of patterns) {
              const pKey = `glob:${ptn}`;
              if (ComponentPathResolver.resolveCache.has(pKey)) {
                const cached = ComponentPathResolver.resolveCache.get(pKey)!;
                if (cached) { result = cached; break; }
                continue;
              }
              const matches = await new Promise<string[]>((resolve, reject) => {
                glob(
                  ptn,
                  { cwd: ComponentPathResolver.rootDir, ignore: '**/node_modules/**', nodir: true },
                  (err: any, files: any) => (err ? reject(err) : resolve(files))
                );
              });
              if (matches.length) {
                result = path.resolve(ComponentPathResolver.rootDir, matches[0]);
                ComponentPathResolver.resolveCache.set(pKey, result);
                break;
              } else {
                ComponentPathResolver.resolveCache.set(pKey, null);
              }
            }
          }
        }
      }
    } catch {
      result = null;
    }
    ComponentPathResolver.resolveCache.set(key, result);
    if (result === null) ComponentPathResolver.unresolved.add(key);
    const tTotal = Date.now() - tStart;
    if (ComponentPathResolver.devMode) {
      console.debug(`[ZemDomu] resolved ${importPath} -> ${result} (${tTotal}ms)`);
    }
    return result;
  }
}
