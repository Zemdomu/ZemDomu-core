#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const file_discovery_1 = require("./file-discovery");
const project_linter_1 = require("./project-linter");
const performance_diagnostics_1 = require("./performance-diagnostics");
const diagnostics_1 = require("./diagnostics");
const sarif_1 = require("./sarif");
const inspection_1 = require("./inspection");
const page_model_1 = require("./page-model");
const EXIT_CODES = {
    success: 0,
    diagnostics: 1,
    invocationError: 2,
};
class CliUsageError extends Error {
}
async function run() {
    var _a;
    const args = process.argv.slice(2);
    const command = args[0] === 'graph' || args[0] === 'inspect' || args[0] === 'check'
        ? args.shift()
        : 'check';
    const inspectRoute = command === 'inspect' ? args.shift() : undefined;
    const rawPatterns = [];
    const customRules = [];
    let cross = false;
    let depth;
    let perfEnabled = false;
    let perfSlowest = false;
    let format = 'pretty';
    let entryFile;
    if (command === 'inspect' && (!inspectRoute || inspectRoute.startsWith('-'))) {
        throw new CliUsageError('Usage: zemdomu inspect <page> --entry <file>');
    }
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--format' || arg.startsWith('--format=')) {
            const value = arg === '--format' ? args[++i] : arg.slice('--format='.length);
            if (value !== 'pretty' && value !== 'json' && value !== 'sarif') {
                throw new CliUsageError('--format must be one of: pretty, json, sarif');
            }
            format = value;
        }
        else if (arg === '--custom' || arg === '-c') {
            const file = args[++i];
            if (!file)
                throw new CliUsageError('Missing file for --custom');
            const resolved = path_1.default.resolve(file);
            const customDir = path_1.default.resolve('custom-rules');
            const relative = path_1.default.relative(customDir, resolved);
            if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
                throw new CliUsageError('Custom rule file must be inside ./custom-rules');
            }
            const mod = require(resolved);
            const rules = (_a = mod.default) !== null && _a !== void 0 ? _a : mod;
            if (Array.isArray(rules))
                customRules.push(...rules);
            else
                customRules.push(rules);
        }
        else if (arg === '--cross') {
            cross = true;
        }
        else if (arg === '--entry') {
            entryFile = args[++i];
            if (!entryFile)
                throw new CliUsageError('Missing file for --entry');
        }
        else if (arg === '--perf') {
            perfEnabled = true;
        }
        else if (arg === '--perf-slowest') {
            perfEnabled = true;
            perfSlowest = true;
        }
        else if (arg === '--cross-depth') {
            const val = args[++i];
            if (!val)
                throw new CliUsageError('Missing value for --cross-depth');
            depth = parseInt(val, 10);
            if (isNaN(depth))
                throw new CliUsageError('Invalid number for --cross-depth');
            cross = true;
        }
        else {
            rawPatterns.push(arg);
        }
    }
    const patterns = (0, file_discovery_1.parseGlobPatterns)(rawPatterns);
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
        if (patterns.length === 0)
            patterns.push(entryFile);
        else if (!patterns.includes(entryFile))
            patterns.push(entryFile);
    }
    else if (patterns.length === 0) {
        patterns.push('**/*.{html,jsx,tsx,vue}');
    }
    const files = (0, file_discovery_1.discoverFilesSync)(patterns);
    if (files.length === 0 && command !== 'check') {
        throw new CliUsageError(`No files matched: ${patterns.join(', ')}`);
    }
    const perf = perfEnabled ? new performance_diagnostics_1.PerformanceDiagnostics() : undefined;
    const linter = new project_linter_1.ProjectLinter({
        customRules,
        crossComponentAnalysis: cross,
        crossComponentDepth: depth,
        perf,
        rootDir: process.cwd(),
    });
    if (command === 'graph') {
        const graph = await linter.buildSemanticGraph(files);
        process.stdout.write((0, inspection_1.formatSemanticGraphInspection)(graph) + '\n');
        process.exitCode = EXIT_CODES.success;
        return;
    }
    if (command === 'inspect' && inspectRoute) {
        const graph = await linter.buildSemanticGraph(files);
        const model = await (0, page_model_1.composeSemanticPageModel)(graph, [
            (0, page_model_1.createConfiguredRouteAdapter)([{ route: inspectRoute, entryFile: entryFile }]),
        ]);
        process.stdout.write((0, inspection_1.formatSemanticPageInspection)(model, graph, inspectRoute) + '\n');
        process.exitCode = EXIT_CODES.success;
        return;
    }
    const diagnostics = sortDiagnostics(await linter.lintPageDiagnostics(files));
    if (format === 'json') {
        process.stdout.write((0, diagnostics_1.serializeZemDomuDiagnostics)(diagnostics, 2) + '\n');
    }
    else if (format === 'sarif') {
        process.stdout.write(JSON.stringify((0, sarif_1.diagnosticsToSarif)(diagnostics), null, 2) + '\n');
    }
    else {
        for (const diagnostic of diagnostics) {
            console.error((0, diagnostics_1.formatZemDomuDiagnosticPretty)(diagnostic));
        }
    }
    if (perfEnabled && perf) {
        process.stdout.write(perf.getAsJSON() + '\n');
        if (perfSlowest)
            perf.logSlowest();
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
function sortDiagnostics(diagnostics) {
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
