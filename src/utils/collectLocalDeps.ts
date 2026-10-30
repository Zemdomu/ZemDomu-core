import fs from "fs";
import path from "path";
import type * as TypeScript from "typescript";
import { extractVueScripts } from "./vue-sfc";

const EXTS = [".tsx", ".ts", ".jsx", ".js", ".vue"];

function isSupportedSourceFile(filePath: string): boolean {
  return EXTS.includes(path.extname(filePath).toLowerCase());
}

export type ResolveCtx = {
  rootDir: string;
  baseUrl?: string;
  paths?: Record<string, string[]>;
  maxDepth?: number;
};

function scriptKindForFile(
  filePath: string,
  ts: typeof TypeScript
): TypeScript.ScriptKind {
  switch (path.extname(filePath).toLowerCase()) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".ts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.Unknown;
  }
}

/** A negative check only: ambiguous source still uses the existing parser. */
function mayHaveModuleDependency(source: string): boolean {
  // Escaped or non-ASCII identifiers and any dependency-looking text are
  // deliberately left to TypeScript, including text inside comments/strings.
  if (/[^\x00-\x7f]|\\|import|require|from/.test(source)) return true;

  // `export default` produces an assignment or declaration, not an
  // ExportDeclaration with a module specifier. Restrict both separators to
  // ASCII whitespace so identifier prefixes and uncertain spellings defer.
  // Keep every other export: TypeScript can recover a module specifier even
  // from malformed declarations such as `export * './child'` (missing from).
  return source
    .replace(/export[ \t\r\n]+default[ \t\r\n]+/g, "")
    .includes("export");
}

function resolveWithExtensions(base: string): string | null {
  if (
    isSupportedSourceFile(base) &&
    fs.existsSync(base) &&
    fs.statSync(base).isFile()
  ) {
    return base;
  }
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

    const ext = path.extname(file).toLowerCase();
    let parseCode = code;
    let langs: string[] = [];
    if (ext === ".vue") {
      const scripts = extractVueScripts(code);
      if (scripts.length === 0) continue;
      parseCode = scripts.map((s) => s.content).join("\n");
      langs = scripts
        .map((s) =>
          typeof s.attrs.lang === "string" ? s.attrs.lang.toLowerCase() : ""
        )
        .filter(Boolean);
    }

    if (!mayHaveModuleDependency(parseCode)) continue;
    const ts: typeof TypeScript = require("typescript");
    let scriptKind = scriptKindForFile(file, ts);
    if (ext === ".vue") {
      if (langs.some((l) => l.includes("tsx") || l.includes("jsx"))) {
        scriptKind = ts.ScriptKind.TSX;
      } else if (langs.some((l) => l.includes("ts"))) {
        scriptKind = ts.ScriptKind.TS;
      } else {
        scriptKind = ts.ScriptKind.JS;
      }
    }

    const sf = ts.createSourceFile(
      file,
      parseCode,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );

    sf.forEachChild((node) => {
      let spec: string | undefined;
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        spec = (node.moduleSpecifier as TypeScript.StringLiteral).text;
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        spec = (node.moduleSpecifier as TypeScript.StringLiteral).text;
      }
      if (!spec) return;

      const resolved = resolveAlias(spec, path.dirname(file), ctx);
      const relative = resolved ? path.relative(root, resolved) : "";
      const isInsideRoot = Boolean(resolved) &&
        relative !== "" &&
        !relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative);
      if (resolved && isInsideRoot) {
        q.push({ file: resolved, depth: depth + 1 });
      }
    });
  }

  return Array.from(seen);
}
