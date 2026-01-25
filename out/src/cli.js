#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const glob_1 = require("glob");
const path_1 = __importDefault(require("path"));
const project_linter_1 = require("./project-linter");
const performance_diagnostics_1 = require("./performance-diagnostics");
const rule_codes_1 = require("./rule-codes");
function parsePatterns(inputs) {
    const result = [];
    for (const input of inputs) {
        const splits = input
            .split(/\r?\n/)
            .flatMap((p) => p.split(/[ ,]+/))
            .filter(Boolean);
        result.push(...splits);
    }
    return result;
}
async function run() {
    var _a, _b, _c;
    const args = process.argv.slice(2);
    const rawPatterns = [];
    const customRules = [];
    let cross = false;
    let depth;
    let perfEnabled = false;
    let perfSlowest = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--custom' || arg === '-c') {
            const file = args[++i];
            if (!file)
                throw new Error('Missing file for --custom');
            const resolved = path_1.default.resolve(file);
            const customDir = path_1.default.resolve('custom-rules');
            const relative = path_1.default.relative(customDir, resolved);
            if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
                throw new Error('Custom rule file must be inside ./custom-rules');
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
                throw new Error('Missing value for --cross-depth');
            depth = parseInt(val, 10);
            if (isNaN(depth))
                throw new Error('Invalid number for --cross-depth');
            cross = true;
        }
        else {
            rawPatterns.push(arg);
        }
    }
    const patterns = parsePatterns(rawPatterns);
    if (patterns.length === 0) {
        patterns.push('**/*.{html,jsx,tsx,vue}');
    }
    const files = new Set();
    for (const pattern of patterns) {
        const matches = (0, glob_1.globSync)(pattern, { nodir: true });
        for (const m of matches)
            files.add(m);
    }
    const perf = perfEnabled ? new performance_diagnostics_1.PerformanceDiagnostics() : undefined;
    const linter = new project_linter_1.ProjectLinter({
        customRules,
        crossComponentAnalysis: cross,
        crossComponentDepth: depth,
        perf,
    });
    const results = await linter.lintFiles(Array.from(files));
    let hasIssues = false;
    for (const [file, issues] of results.entries()) {
        for (const issue of issues) {
            const code = (_c = (_b = issue.code) !== null && _b !== void 0 ? _b : (0, rule_codes_1.getRuleCode)(issue.rule)) !== null && _c !== void 0 ? _c : issue.rule;
            console.error(`${file}:${issue.line + 1}:${issue.column + 1} ${code}: ${issue.message}`);
            hasIssues = true;
        }
    }
    if (perfEnabled && perf) {
        process.stdout.write(perf.getAsJSON() + '\n');
        if (perfSlowest)
            perf.logSlowest();
    }
    if (hasIssues)
        process.exit(1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
