"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION = void 0;
exports.toZemDomuDiagnostic = toZemDomuDiagnostic;
exports.serializeZemDomuDiagnostics = serializeZemDomuDiagnostics;
exports.formatZemDomuDiagnosticPretty = formatZemDomuDiagnosticPretty;
const rule_codes_1 = require("./rule-codes");
/** Schema version for the machine-readable ZemDomu diagnostic contract. */
exports.ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION = "1.0";
/**
 * Adapt a legacy `LintResult` to the canonical contract without changing the
 * object returned by `lint()` or `ProjectLinter`.
 */
function toZemDomuDiagnostic(result, context = {}) {
    var _a, _b, _c, _d, _e, _f;
    const file = (_a = result.filePath) !== null && _a !== void 0 ? _a : context.sourceFile;
    if (!file) {
        throw new TypeError("A source file is required to create a ZemDomuDiagnostic. Pass context.sourceFile or use a LintResult with filePath.");
    }
    const severity = result.severity;
    const canonicalSeverity = severity === "error" || severity === "warning"
        ? severity
        : (_b = context.defaultSeverity) !== null && _b !== void 0 ? _b : "error";
    return {
        schemaVersion: exports.ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
        rule: result.rule,
        code: (_d = (_c = result.code) !== null && _c !== void 0 ? _c : (0, rule_codes_1.getRuleCode)(result.rule)) !== null && _d !== void 0 ? _d : result.rule,
        severity: canonicalSeverity,
        message: result.message,
        source: {
            file,
            line: result.line,
            column: result.column,
            ...(result.offset === undefined ? {} : { offset: result.offset }),
        },
        ...(context.page === undefined ? {} : { page: context.page }),
        ...(context.componentPath === undefined
            ? {}
            : { componentPath: [...context.componentPath] }),
        ...(result.related === undefined && context.relatedLocations === undefined
            ? {}
            : {
                relatedLocations: [
                    ...((_e = result.related) !== null && _e !== void 0 ? _e : []).map((related) => ({
                        source: {
                            file: related.filePath,
                            line: related.line,
                            column: related.column,
                        },
                        ...(related.message === undefined
                            ? {}
                            : { message: related.message }),
                    })),
                    ...((_f = context.relatedLocations) !== null && _f !== void 0 ? _f : []).map((related) => ({
                        source: { ...related.source },
                        ...(related.message === undefined
                            ? {}
                            : { message: related.message }),
                    })),
                ],
            }),
        ...(context.preferredEditLocation === undefined
            ? {}
            : { preferredEditLocation: { ...context.preferredEditLocation } }),
        ...(context.suggestion === undefined
            ? {}
            : { suggestion: { ...context.suggestion } }),
        ...(context.provenance === undefined
            ? {}
            : { provenance: { ...context.provenance } }),
        ...(context.confidence === undefined
            ? {}
            : { confidence: context.confidence }),
    };
}
/** Serialize canonical diagnostics as a JSON array without mutating them. */
function serializeZemDomuDiagnostics(diagnostics, space) {
    return JSON.stringify(diagnostics, null, space);
}
/** Render one canonical diagnostic for developer-facing terminal output. */
function formatZemDomuDiagnosticPretty(diagnostic) {
    var _a, _b;
    const lines = [
        `${diagnostic.source.file}:${diagnostic.source.line + 1}:${diagnostic.source.column + 1} ${diagnostic.code}: ${diagnostic.message}`,
    ];
    if (diagnostic.page)
        lines.push(`Page: ${diagnostic.page}`);
    if ((_a = diagnostic.componentPath) === null || _a === void 0 ? void 0 : _a.length) {
        lines.push(`Component path: ${diagnostic.componentPath.join(" → ")}`);
    }
    if ((_b = diagnostic.relatedLocations) === null || _b === void 0 ? void 0 : _b.length) {
        lines.push("Related locations:");
        for (const related of diagnostic.relatedLocations) {
            lines.push(`  ${related.source.file}:${related.source.line + 1}:${related.source.column + 1}${related.message ? ` — ${related.message}` : ""}`);
        }
    }
    if (diagnostic.preferredEditLocation) {
        const edit = diagnostic.preferredEditLocation;
        lines.push(`Suggested location: ${edit.file}:${edit.line + 1}:${edit.column + 1}`);
    }
    if (diagnostic.suggestion) {
        lines.push(`Suggestion: ${diagnostic.suggestion.message}`);
    }
    return lines.join("\n");
}
