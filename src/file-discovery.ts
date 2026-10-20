import { globSync, statSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

const comparePaths = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function normalizeGlobPattern(pattern: string): string {
  return pattern.replace(/\\/g, '/');
}

export function parseGlobPatterns(inputs: readonly string[]): string[] {
  const patterns: string[] = [];
  for (const input of inputs) {
    let current = '';
    let braceDepth = 0;
    for (const character of input) {
      if (character === '{') braceDepth++;
      if (character === '}' && braceDepth > 0) braceDepth--;
      if (braceDepth === 0 && (character === ',' || /\s/.test(character))) {
        if (current) patterns.push(current);
        current = '';
      } else {
        current += character;
      }
    }
    if (current) patterns.push(current);
  }
  return patterns;
}

function excludeEntry(entry: Dirent, literalRoot?: string): boolean {
  if (entry.name === 'node_modules') return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    const absolute = path.join(entry.parentPath, entry.name);
    if (literalRoot && (literalRoot === absolute || literalRoot.startsWith(absolute + path.sep))) return false;
    return !statSync(absolute).isFile();
  } catch {
    return true;
  }
}

function literalRoot(pattern: string, cwd: string): string {
  // Native glob checks literal ancestors too (including macOS /var).
  // Allow explicitly named ancestors while excluding discovered directory links.
  const magic = pattern.search(/[*?{\[]/);
  return path.resolve(cwd, magic < 0 ? path.dirname(pattern) : pattern.slice(0, magic).replace(/[^/]*$/, '') || '.');
}

function matchedFile(entry: Dirent, pattern: string, cwd: string): string | undefined {
  if (entry.isDirectory() || excludeEntry(entry)) return undefined;
  const absolute = path.join(entry.parentPath, entry.name);
  if (absolute.split(path.sep).includes('node_modules')) return undefined;
  return (path.isAbsolute(pattern) ? absolute : path.relative(cwd, absolute)).replace(/\\/g, '/');
}

export function discoverFilesSync(patterns: readonly string[], cwd = process.cwd()): string[] {
  const files = new Set<string>();
  for (const rawPattern of patterns) {
    const pattern = normalizeGlobPattern(rawPattern);
    const root = literalRoot(pattern, cwd);
    for (const entry of globSync(pattern, { cwd, withFileTypes: true, exclude: entry => excludeEntry(entry, root) })) {
      const file = matchedFile(entry, pattern, cwd);
      if (file !== undefined) files.add(file);
    }
  }
  return Array.from(files).sort(comparePaths);
}

export async function discoverFiles(patterns: readonly string[], cwd = process.cwd()): Promise<string[]> {
  const files = new Set<string>();
  for (const rawPattern of patterns) {
    const pattern = normalizeGlobPattern(rawPattern);
    const root = literalRoot(pattern, cwd);
    for await (const entry of glob(pattern, { cwd, withFileTypes: true, exclude: entry => excludeEntry(entry, root) })) {
      const file = matchedFile(entry, pattern, cwd);
      if (file !== undefined) files.add(file);
    }
  }
  return Array.from(files).sort(comparePaths);
}
