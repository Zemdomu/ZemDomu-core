const fs = require('node:fs');
const path = require('node:path');

const METRICS = ['lines', 'statements', 'functions', 'branches'];
const REQUIRED_ENTRIES = ['cli.ts', 'linter.ts', 'project-linter.ts'];

function sourceInventory(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && /\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        files.push(path.relative(root, file).split(path.sep).join('/'));
      }
    }
  }
  visit(root);
  return files.sort();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Missing or invalid coverage evidence: ${file}`);
  }
}

function assertMetric(metric, label) {
  if (!metric || !Number.isSafeInteger(metric.total) || !Number.isSafeInteger(metric.covered)
      || !Number.isSafeInteger(metric.skipped) || metric.skipped < 0
      || metric.total < 0 || metric.covered < 0 || metric.covered > metric.total
      || !Number.isFinite(metric.pct) || metric.pct < 0 || metric.pct > 100) {
    throw new Error(`Invalid coverage counters: ${label}`);
  }
}

function validateCoverage({ sourceRoot, buildRoot, reportRoot, requiredEntries = REQUIRED_ENTRIES }) {
  sourceRoot = fs.realpathSync(sourceRoot);
  buildRoot = fs.realpathSync(buildRoot);
  const inventory = sourceInventory(sourceRoot);
  if (!inventory.length) throw new Error('The first-party source inventory is empty.');
  // Validate every external source map before accepting any displayed percentage.
  // index.ts and type-only files remain in the inventory, even without branches.
  for (const source of inventory) {
    const generated = path.join(buildRoot, 'src', source.replace(/\.ts$/, '.js'));
    const mapFile = generated + '.map';
    const map = readJson(mapFile);
    const expectedSource = path.join(sourceRoot, source);
    if (map.version !== 3 || !Array.isArray(map.sources) || map.sources.length !== 1
        || path.resolve(path.dirname(mapFile), map.sourceRoot || '', map.sources[0]) !== expectedSource
        || !Array.isArray(map.sourcesContent) || typeof map.sourcesContent[0] !== 'string'
        || map.sourcesContent[0].replace(/^\uFEFF/, '') !== fs.readFileSync(expectedSource, 'utf8').replace(/^\uFEFF/, '')
        || typeof map.mappings !== 'string' || !map.mappings.length) {
      throw new Error(`Source map does not describe the measured source: ${source}`);
    }
    const script = fs.readFileSync(generated, 'utf8');
    if (!script.includes('//# sourceMappingURL=' + path.basename(mapFile))) {
      throw new Error(`Generated source has no matching source map: ${source}`);
    }
  }

  const full = readJson(path.join(reportRoot, 'coverage-final.json'));
  const summary = readJson(path.join(reportRoot, 'coverage-summary.json'));
  if (JSON.stringify(Object.keys(summary).filter(file => file !== 'total').sort()) !== JSON.stringify(Object.keys(full).sort())) {
    throw new Error('Coverage summary and raw report source inventories disagree.');
  }
  const reported = new Map();
  for (const [file, counters] of Object.entries(full)) {
    const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
    if (!path.isAbsolute(file) || !inventory.includes(relative) || reported.has(relative)) {
      throw new Error('Coverage includes an unexpected, unmapped, or duplicate file: ' + file);
    }
    reported.set(relative, { counters, summary: summary[file] });
  }
  if (reported.size !== inventory.length || inventory.some(file => !reported.has(file))) {
    throw new Error('Coverage omits first-party source files.');
  }

  const totals = Object.fromEntries(METRICS.map(metric => [metric, { total: 0, covered: 0 }]));
  for (const [file, evidence] of reported) {
    for (const metric of METRICS) {
      assertMetric(evidence.summary?.[metric], file + ':' + metric);
      totals[metric].total += evidence.summary[metric].total;
      totals[metric].covered += evidence.summary[metric].covered;
    }
    const { s, f, b } = evidence.counters;
    for (const [mapName, counterName] of [['statementMap', 's'], ['fnMap', 'f'], ['branchMap', 'b']]) {
      const map = evidence.counters[mapName];
      const values = evidence.counters[counterName];
      if (!map || !values || typeof map !== 'object' || typeof values !== 'object'
          || JSON.stringify(Object.keys(map).sort()) !== JSON.stringify(Object.keys(values).sort())) {
        throw new Error('Incomplete raw coverage counter map: ' + file + ':' + counterName);
      }
    }
    if (!s || !f || !b || typeof s !== 'object' || typeof f !== 'object' || typeof b !== 'object'
        || Object.values(b).some(value => !Array.isArray(value))) {
      throw new Error('Malformed raw coverage counters: ' + file);
    }
    const raw = { statements: Object.values(s), functions: Object.values(f), branches: Object.values(b).flat() };
    for (const [metric, values] of Object.entries(raw)) {
      if (values.some(value => !Number.isSafeInteger(value) || value < 0)
          || values.length !== evidence.summary[metric].total
          || values.filter(value => value > 0).length !== evidence.summary[metric].covered) {
        throw new Error('Raw and summarized coverage counters disagree: ' + file + ':' + metric);
      }
    }
  }
  for (const metric of METRICS) {
    assertMetric(summary.total?.[metric], 'total:' + metric);
    if (summary.total[metric].total !== totals[metric].total || summary.total[metric].covered !== totals[metric].covered) {
      throw new Error('Aggregate coverage counters disagree: ' + metric);
    }
  }
  for (const entry of requiredEntries) {
    const evidence = reported.get(entry)?.summary;
    if (!evidence || ['branches', 'functions'].some(metric => evidence[metric].total <= 0 || evidence[metric].covered <= 0)) {
      throw new Error('Missing executable entrypoint counters: ' + entry);
    }
  }
  return {
    sourceFiles: inventory,
    sourceFileCount: inventory.length,
    totals: summary.total,
    requiredEntries,
    entrypointCoverage: Object.fromEntries(requiredEntries.map(file => [file, reported.get(file).summary])),
    barrelNote: 'index.ts is retained in the full source inventory; re-exports and types do not require executable branch/function counters.',
  };
}

module.exports = { sourceInventory, validateCoverage };
