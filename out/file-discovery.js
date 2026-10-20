"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGlobPattern = normalizeGlobPattern;
exports.parseGlobPatterns = parseGlobPatterns;
exports.discoverFilesSync = discoverFilesSync;
exports.discoverFiles = discoverFiles;
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const comparePaths = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function normalizeGlobPattern(pattern) {
    return pattern.replace(/\\/g, '/');
}
function parseGlobPatterns(inputs) {
    const patterns = [];
    for (const input of inputs) {
        let current = '';
        let braceDepth = 0;
        for (const character of input) {
            if (character === '{')
                braceDepth++;
            if (character === '}' && braceDepth > 0)
                braceDepth--;
            if (braceDepth === 0 && (character === ',' || /\s/.test(character))) {
                if (current)
                    patterns.push(current);
                current = '';
            }
            else {
                current += character;
            }
        }
        if (current)
            patterns.push(current);
    }
    return patterns;
}
function excludeEntry(entry, literalRoot) {
    if (entry.name === 'node_modules')
        return true;
    if (!entry.isSymbolicLink())
        return false;
    try {
        const absolute = node_path_1.default.join(entry.parentPath, entry.name);
        if (literalRoot && (literalRoot === absolute || literalRoot.startsWith(absolute + node_path_1.default.sep)))
            return false;
        return !(0, node_fs_1.statSync)(absolute).isFile();
    }
    catch {
        return true;
    }
}
function literalRoot(pattern, cwd) {
    // Native glob checks literal ancestors too (including macOS /var).
    // Allow explicitly named ancestors while excluding discovered directory links.
    const magic = pattern.search(/[*?{\[]/);
    return node_path_1.default.resolve(cwd, magic < 0 ? node_path_1.default.dirname(pattern) : pattern.slice(0, magic).replace(/[^/]*$/, '') || '.');
}
function matchedFile(entry, pattern, cwd) {
    if (entry.isDirectory() || excludeEntry(entry))
        return undefined;
    const absolute = node_path_1.default.join(entry.parentPath, entry.name);
    if (absolute.split(node_path_1.default.sep).includes('node_modules'))
        return undefined;
    return (node_path_1.default.isAbsolute(pattern) ? absolute : node_path_1.default.relative(cwd, absolute)).replace(/\\/g, '/');
}
function discoverFilesSync(patterns, cwd = process.cwd()) {
    const files = new Set();
    for (const rawPattern of patterns) {
        const pattern = normalizeGlobPattern(rawPattern);
        const root = literalRoot(pattern, cwd);
        for (const entry of (0, node_fs_1.globSync)(pattern, { cwd, withFileTypes: true, exclude: entry => excludeEntry(entry, root) })) {
            const file = matchedFile(entry, pattern, cwd);
            if (file !== undefined)
                files.add(file);
        }
    }
    return Array.from(files).sort(comparePaths);
}
async function discoverFiles(patterns, cwd = process.cwd()) {
    const files = new Set();
    for (const rawPattern of patterns) {
        const pattern = normalizeGlobPattern(rawPattern);
        const root = literalRoot(pattern, cwd);
        for await (const entry of (0, promises_1.glob)(pattern, { cwd, withFileTypes: true, exclude: entry => excludeEntry(entry, root) })) {
            const file = matchedFile(entry, pattern, cwd);
            if (file !== undefined)
                files.add(file);
        }
    }
    return Array.from(files).sort(comparePaths);
}
