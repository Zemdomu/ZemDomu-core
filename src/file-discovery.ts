import { globSync } from 'glob';

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

export function discoverFilesSync(patterns: readonly string[]): string[] {
  const files = new Set<string>();
  for (const rawPattern of patterns) {
    const matches = globSync(normalizeGlobPattern(rawPattern), {
      dot: false,
      follow: false,
      ignore: '**/node_modules/**',
      nodir: true,
    }).sort(comparePaths);
    for (const match of matches) files.add(match.replace(/\\/g, '/'));
  }
  return Array.from(files).sort(comparePaths);
}
