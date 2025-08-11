// src/utils/collectLocalDeps.ts
import fs from "fs";
import path from "path";
import ts from "typescript";

const EXTS = [".tsx", ".ts", ".jsx", ".js"];

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

export function collectLocalDeps(
  entries: string[],
  rootDir = process.cwd(),
  maxDepth?: number
): string[] {
  const root = path.resolve(rootDir);
  const seen = new Set<string>();
  const q: Array<{ file: string; depth: number }> = entries.map((p) => ({
    file: path.resolve(p),
    depth: 0,
  }));

  while (q.length) {
    const { file, depth } = q.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    // depth cap if provided
    if (maxDepth !== undefined && depth >= maxDepth) continue;

    const code = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

    sf.forEachChild((node) => {
      const mod =
        (ts.isImportDeclaration(node) && node.moduleSpecifier) ||
        (ts.isExportDeclaration(node) && node.moduleSpecifier)
          ? (node.moduleSpecifier as ts.StringLiteral).text
          : undefined;
      if (!mod) return;

      // follow only local/relative
      if (mod.startsWith(".") || mod.startsWith("/")) {
        const resolved = resolveWithExtensions(
          path.resolve(path.dirname(file), mod)
        );
        if (resolved && resolved.startsWith(root)) {
          q.push({ file: resolved, depth: depth + 1 });
        }
      }
    });
  }

  return Array.from(seen);
}
