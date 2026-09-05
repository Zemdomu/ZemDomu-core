"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGlobPattern = normalizeGlobPattern;
exports.parseGlobPatterns = parseGlobPatterns;
exports.discoverFilesSync = discoverFilesSync;
const glob_1 = require("glob");
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
function discoverFilesSync(patterns) {
    const files = new Set();
    for (const rawPattern of patterns) {
        const matches = (0, glob_1.globSync)(normalizeGlobPattern(rawPattern), {
            dot: false,
            follow: false,
            ignore: '**/node_modules/**',
            nodir: true,
        }).sort(comparePaths);
        for (const match of matches)
            files.add(match.replace(/\\/g, '/'));
    }
    return Array.from(files).sort(comparePaths);
}
