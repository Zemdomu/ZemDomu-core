#!/usr/bin/env node
import { globSync } from 'glob';
import path from 'path';
import { ProjectLinter } from './project-linter';

function parsePatterns(inputs: string[]): string[] {
  const result: string[] = [];
  for (const input of inputs) {
    const splits = input
      .split(/\r?\n/)
      .flatMap((p) => p.split(/[ ,]+/))
      .filter(Boolean);
    result.push(...splits);
  }
  return result;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const rawPatterns: string[] = [];
  const customRules: any[] = [];
  let cross = false;
  let depth: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--custom' || arg === '-c') {
      const file = args[++i];
      if (!file) throw new Error('Missing file for --custom');
      const resolved = path.resolve(file);
      const customDir = path.resolve('custom-rules');
      const relative = path.relative(customDir, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Custom rule file must be inside ./custom-rules');
      }
      const mod = require(resolved);
      const rules = mod.default ?? mod;
      if (Array.isArray(rules)) customRules.push(...rules);
      else customRules.push(rules);
    } else if (arg === '--cross') {
      cross = true;
    } else if (arg === '--cross-depth') {
      const val = args[++i];
      if (!val) throw new Error('Missing value for --cross-depth');
      depth = parseInt(val, 10);
      if (isNaN(depth)) throw new Error('Invalid number for --cross-depth');
      cross = true;
    } else {
      rawPatterns.push(arg);
    }
  }

  const patterns = parsePatterns(rawPatterns);

  if (patterns.length === 0) {
    patterns.push('**/*.{html,jsx,tsx,vue}');
  }

  const files = new Set<string>();
  for (const pattern of patterns) {
    const matches = globSync(pattern, { nodir: true });
    for (const m of matches) files.add(m);
  }

  const linter = new ProjectLinter({ customRules, crossComponentAnalysis: cross, crossComponentDepth: depth });
  const results = await linter.lintFiles(Array.from(files));
  let hasIssues = false;
  for (const [file, issues] of results.entries()) {
    for (const issue of issues) {
      console.error(
        `${file}:${issue.line + 1}:${issue.column + 1} ${issue.rule}: ${issue.message}`
      );
      hasIssues = true;
    }
  }
  if (hasIssues) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
