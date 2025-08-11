import fs from "fs";
import path from "path";
import * as ts from "typescript";

const EXTS = [".tsx", ".ts", ".jsx", ".js"];

export type ResolveCtx = {
  rootDir: string;
  baseUrl?: string;
  paths?: Record<string, string[]>;
  maxDepth?: number;
};

function resolveWithExtensions(base: string): string | null {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const ext of EXTS) {
    const p = path.join(base, "index" + ext);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function resolveAlias(
  spec: string,
  fileDir: string,
  ctx: ResolveCtx
): string | null {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    return resolveWithExtensions(path.resolve(fileDir, spec));
  }
  const { baseUrl, paths } = ctx;
  if (baseUrl && paths) {
    for (const [pattern, targets] of Object.entries(paths)) {
      const starIdx = pattern.indexOf("*");
      if (starIdx >= 0) {
        const pre = pattern.slice(0, starIdx);
        const post = pattern.slice(starIdx + 1);
        if (spec.startsWith(pre) && spec.endsWith(post)) {
          const middle = spec.slice(pre.length, spec.length - post.length);
          for (const t of targets) {
            const candidate = t.replace("*", middle);
            const abs = path.resolve(baseUrl, candidate);
            const hit = resolveWithExtensions(abs);
            if (hit) return hit;
          }
        }
      } else if (spec === pattern) {
        for (const t of targets) {
          const abs = path.resolve(baseUrl, t);
          const hit = resolveWithExtensions(abs);
          if (hit) return hit;
        }
      }
    }
  }

  return null;
}

export function collectLocalDeps(entries: string[], ctx: ResolveCtx): string[] {
  const root = path.resolve(ctx.rootDir);
  const seen = new Set<string>();
  const q: Array<{ file: string; depth: number }> = entries.map((p) => ({
    file: path.resolve(p),
    depth: 0,
  }));

  while (q.length) {
    const { file, depth } = q.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    if (ctx.maxDepth !== undefined && depth >= ctx.maxDepth) continue;

    let code = "";
    try {
      code = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

    sf.forEachChild((node) => {
      let spec: string | undefined;
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        spec = (node.moduleSpecifier as ts.StringLiteral).text;
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        spec = (node.moduleSpecifier as ts.StringLiteral).text;
      }
      if (!spec) return;

      const resolved = resolveAlias(spec, path.dirname(file), ctx);
      if (resolved && resolved.startsWith(root)) {
        q.push({ file: resolved, depth: depth + 1 });
      }
    });
  }

  return Array.from(seen);
}
