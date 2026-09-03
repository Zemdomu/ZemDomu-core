#!/usr/bin/env node
import path from 'path';
import { discoverFilesSync, parseGlobPatterns } from './file-discovery';
import { ProjectLinter } from './project-linter';
import { PerformanceDiagnostics } from './performance-diagnostics';
import {
  formatZemDomuDiagnosticPretty,
  serializeZemDomuDiagnostics,
  type ZemDomuDiagnostic,
} from './diagnostics';
import { diagnosticsToSarif } from './sarif';
import {
  formatSemanticGraphInspection,
  formatSemanticPageInspection,
} from './inspection';
import {
  composeSemanticPageModel,
  createConfiguredRouteAdapter,
} from './page-model';

type OutputFormat = 'pretty' | 'json' | 'sarif';
type Command = 'check' | 'graph' | 'inspect';

const EXIT_CODES = {
  success: 0,
  diagnostics: 1,
  invocationError: 2,
} as const;

class CliUsageError extends Error {}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command: Command =
    args[0] === 'graph' || args[0] === 'inspect' || args[0] === 'check'
      ? (args.shift() as Command)
      : 'check';
  const inspectRoute = command === 'inspect' ? args.shift() : undefined;
  const rawPatterns: string[] = [];
  const customRules: any[] = [];
  let cross = false;
  let depth: number | undefined;
  let perfEnabled = false;
  let perfSlowest = false;
  let format: OutputFormat = 'pretty';
  let entryFile: string | undefined;

  if (command === 'inspect' && (!inspectRoute || inspectRoute.startsWith('-'))) {
    throw new CliUsageError('Usage: zemdomu inspect <page> --entry <file>');
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' || arg.startsWith('--format=')) {
      const value =
        arg === '--format' ? args[++i] : arg.slice('--format='.length);
      if (value !== 'pretty' && value !== 'json' && value !== 'sarif') {
        throw new CliUsageError('--format must be one of: pretty, json, sarif');
      }
      format = value;
    } else if (arg === '--custom' || arg === '-c') {
      const file = args[++i];
      if (!file) throw new CliUsageError('Missing file for --custom');
      const resolved = path.resolve(file);
      const customDir = path.resolve('custom-rules');
      const relative = path.relative(customDir, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new CliUsageError('Custom rule file must be inside ./custom-rules');
      }
      const mod = require(resolved);
      const rules = mod.default ?? mod;
      if (Array.isArray(rules)) customRules.push(...rules);
      else customRules.push(rules);
    } else if (arg === '--cross') {
      cross = true;
    } else if (arg === '--entry') {
      entryFile = args[++i];
      if (!entryFile) throw new CliUsageError('Missing file for --entry');
    } else if (arg === '--perf') {
      perfEnabled = true;
    } else if (arg === '--perf-slowest') {
      perfEnabled = true;
      perfSlowest = true;
    } else if (arg === '--cross-depth') {
      const val = args[++i];
      if (!val) throw new CliUsageError('Missing value for --cross-depth');
      depth = parseInt(val, 10);
      if (isNaN(depth)) throw new CliUsageError('Invalid number for --cross-depth');
      cross = true;
    } else {
      rawPatterns.push(arg);
    }
  }

  const patterns = parseGlobPatterns(rawPatterns);

  if (command !== 'check' && format !== 'pretty') {
    throw new CliUsageError('--format is currently only supported by zemdomu check');
  }
  if (command !== 'inspect' && entryFile) {
    throw new CliUsageError('--entry is only supported by zemdomu inspect');
  }
  if (format !== 'pretty' && perfEnabled) {
    throw new CliUsageError('--perf and --perf-slowest require --format pretty');
  }

  if (command === 'inspect') {
    if (!entryFile) {
      throw new CliUsageError('zemdomu inspect requires --entry <file>');
    }
    if (patterns.length === 0) patterns.push(entryFile);
    else if (!patterns.includes(entryFile)) patterns.push(entryFile);
  } else if (patterns.length === 0) {
    patterns.push('**/*.{html,jsx,tsx,vue}');
  }

  const files = discoverFilesSync(patterns);

  if (files.length === 0 && command !== 'check') {
    throw new CliUsageError(`No files matched: ${patterns.join(', ')}`);
  }

  const perf = perfEnabled ? new PerformanceDiagnostics() : undefined;
  const linter = new ProjectLinter({
    customRules,
    crossComponentAnalysis: cross,
    crossComponentDepth: depth,
    perf,
    rootDir: process.cwd(),
  });

  if (command === 'graph') {
    const graph = await linter.buildSemanticGraph(files);
    process.stdout.write(formatSemanticGraphInspection(graph) + '\n');
    process.exitCode = EXIT_CODES.success;
    return;
  }
  if (command === 'inspect' && inspectRoute) {
    const graph = await linter.buildSemanticGraph(files);
    const model = await composeSemanticPageModel(graph, [
      createConfiguredRouteAdapter([{ route: inspectRoute, entryFile: entryFile! }]),
    ]);
    process.stdout.write(
      formatSemanticPageInspection(model, graph, inspectRoute) + '\n'
    );
    process.exitCode = EXIT_CODES.success;
    return;
  }
  const diagnostics = sortDiagnostics(
    await linter.lintPageDiagnostics(files)
  );

  if (format === 'json') {
    process.stdout.write(serializeZemDomuDiagnostics(diagnostics, 2) + '\n');
  } else if (format === 'sarif') {
    process.stdout.write(JSON.stringify(diagnosticsToSarif(diagnostics), null, 2) + '\n');
  } else {
    for (const diagnostic of diagnostics) {
      console.error(formatZemDomuDiagnosticPretty(diagnostic));
    }
  }
  if (perfEnabled && perf) {
    process.stdout.write(perf.getAsJSON() + '\n');
    if (perfSlowest) perf.logSlowest();
  }
  process.exitCode = diagnostics.length
    ? EXIT_CODES.diagnostics
    : EXIT_CODES.success;
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode =
    e instanceof CliUsageError
      ? EXIT_CODES.invocationError
      : EXIT_CODES.diagnostics;
});

function sortDiagnostics(
  diagnostics: readonly ZemDomuDiagnostic[]
): ZemDomuDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const leftKey = [
      left.source.file,
      left.source.line,
      left.source.column,
      left.code,
      left.message,
    ].join("\u0000");
    const rightKey = [
      right.source.file,
      right.source.line,
      right.source.column,
      right.code,
      right.message,
    ].join("\u0000");
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}
