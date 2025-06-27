import { strict as assert } from 'assert';
import { lint, PerformanceDiagnostics } from '../src/index';

PerformanceDiagnostics.resetMetrics();
const perf = new PerformanceDiagnostics();

const html = '<img src="foo.jpg" alt="bar">';
lint(html, { filePath: 'perf.html', perf });

const metrics = PerformanceDiagnostics.getLatestMetrics();
const data = metrics.get('perf.html');
assert.ok(data && typeof data.total === 'number', 'Expected performance metrics');
console.log('performance diagnostics test passed');

