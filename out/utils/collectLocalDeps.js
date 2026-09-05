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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectLocalDeps = collectLocalDeps;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ts = __importStar(require("typescript"));
const vue_sfc_1 = require("./vue-sfc");
const EXTS = [".tsx", ".ts", ".jsx", ".js", ".vue"];
function scriptKindForFile(filePath) {
    switch (path_1.default.extname(filePath).toLowerCase()) {
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
function resolveWithExtensions(base) {
    if (fs_1.default.existsSync(base) && fs_1.default.statSync(base).isFile())
        return base;
    for (const ext of EXTS) {
        const p = base + ext;
        if (fs_1.default.existsSync(p) && fs_1.default.statSync(p).isFile())
            return p;
    }
    for (const ext of EXTS) {
        const p = path_1.default.join(base, "index" + ext);
        if (fs_1.default.existsSync(p) && fs_1.default.statSync(p).isFile())
            return p;
    }
    return null;
}
function resolveAlias(spec, fileDir, ctx) {
    if (spec.startsWith(".") || spec.startsWith("/")) {
        return resolveWithExtensions(path_1.default.resolve(fileDir, spec));
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
                        const abs = path_1.default.resolve(baseUrl, candidate);
                        const hit = resolveWithExtensions(abs);
                        if (hit)
                            return hit;
                    }
                }
            }
            else if (spec === pattern) {
                for (const t of targets) {
                    const abs = path_1.default.resolve(baseUrl, t);
                    const hit = resolveWithExtensions(abs);
                    if (hit)
                        return hit;
                }
            }
        }
    }
    return null;
}
function collectLocalDeps(entries, ctx) {
    const root = path_1.default.resolve(ctx.rootDir);
    const seen = new Set();
    const q = entries.map((p) => ({
        file: path_1.default.resolve(p),
        depth: 0,
    }));
    while (q.length) {
        const { file, depth } = q.pop();
        if (seen.has(file))
            continue;
        seen.add(file);
        if (ctx.maxDepth !== undefined && depth >= ctx.maxDepth)
            continue;
        let code = "";
        try {
            code = fs_1.default.readFileSync(file, "utf8");
        }
        catch {
            continue;
        }
        const ext = path_1.default.extname(file).toLowerCase();
        let parseCode = code;
        let scriptKind = scriptKindForFile(file);
        if (ext === ".vue") {
            const scripts = (0, vue_sfc_1.extractVueScripts)(code);
            if (scripts.length === 0)
                continue;
            parseCode = scripts.map((s) => s.content).join("\n");
            const langs = scripts
                .map((s) => typeof s.attrs.lang === "string" ? s.attrs.lang.toLowerCase() : "")
                .filter(Boolean);
            if (langs.some((l) => l.includes("tsx") || l.includes("jsx"))) {
                scriptKind = ts.ScriptKind.TSX;
            }
            else if (langs.some((l) => l.includes("ts"))) {
                scriptKind = ts.ScriptKind.TS;
            }
            else {
                scriptKind = ts.ScriptKind.JS;
            }
        }
        const sf = ts.createSourceFile(file, parseCode, ts.ScriptTarget.Latest, true, scriptKind);
        sf.forEachChild((node) => {
            let spec;
            if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
                spec = node.moduleSpecifier.text;
            }
            else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
                spec = node.moduleSpecifier.text;
            }
            if (!spec)
                return;
            const resolved = resolveAlias(spec, path_1.default.dirname(file), ctx);
            const relative = resolved ? path_1.default.relative(root, resolved) : "";
            const isInsideRoot = Boolean(resolved) &&
                relative !== "" &&
                !relative.startsWith(`..${path_1.default.sep}`) &&
                relative !== ".." &&
                !path_1.default.isAbsolute(relative);
            if (resolved && isInsideRoot) {
                q.push({ file: resolved, depth: depth + 1 });
            }
        });
    }
    return Array.from(seen);
}
