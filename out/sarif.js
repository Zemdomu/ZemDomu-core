"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SARIF_SCHEMA_URI = exports.RULE_DOCS_BASE = void 0;
exports.diagnosticsToSarif = diagnosticsToSarif;
exports.resultsToSarif = resultsToSarif;
const diagnostics_1 = require("./diagnostics");
const SARIF_SCHEMA_URI = "https://json.schemastore.org/sarif-2.1.0.json";
exports.SARIF_SCHEMA_URI = SARIF_SCHEMA_URI;
const RULE_DOCS_BASE = "https://github.com/ZemDomu/docs/blob/main/rules/";
exports.RULE_DOCS_BASE = RULE_DOCS_BASE;
function toSarifLocation(source) {
    return {
        physicalLocation: {
            artifactLocation: { uri: source.file },
            region: {
                // SARIF coordinates are one-based while the canonical contract is zero-based.
                startLine: source.line + 1,
                startColumn: source.column + 1,
            },
        },
    };
}
function toSarifRelatedLocation(related, id) {
    return {
        id,
        ...toSarifLocation(related.source),
        ...(related.message === undefined ? {} : { message: { text: related.message } }),
    };
}
function toSarifLevel(severity) {
    return severity === "info" ? "note" : severity;
}
function diagnosticProperties(diagnostic) {
    const properties = {
        "zemdomu/schemaVersion": diagnostic.schemaVersion,
        "zemdomu/rule": diagnostic.rule,
    };
    if (diagnostic.page !== undefined)
        properties["zemdomu/page"] = diagnostic.page;
    if (diagnostic.componentPath !== undefined) {
        properties["zemdomu/componentPath"] = diagnostic.componentPath;
    }
    if (diagnostic.preferredEditLocation !== undefined) {
        properties["zemdomu/preferredEditLocation"] = diagnostic.preferredEditLocation;
    }
    if (diagnostic.suggestion !== undefined) {
        properties["zemdomu/suggestion"] = diagnostic.suggestion;
    }
    if (diagnostic.provenance !== undefined) {
        properties["zemdomu/provenance"] = diagnostic.provenance;
    }
    if (diagnostic.confidence !== undefined) {
        properties["zemdomu/confidence"] = diagnostic.confidence;
    }
    return properties;
}
/**
 * Convert canonical diagnostics to SARIF 2.1.0 without flattening semantic
 * context into the human-facing message. Related source evidence becomes
 * native SARIF related locations; page and component metadata remains in
 * structured result properties for consuming integrations.
 */
function diagnosticsToSarif(diagnostics) {
    const ruleMeta = new Map();
    const results = diagnostics.map((diagnostic) => {
        var _a;
        const ruleId = diagnostic.code;
        if (!ruleMeta.has(ruleId)) {
            ruleMeta.set(ruleId, {
                helpUri: `${RULE_DOCS_BASE}${diagnostic.rule}.md`,
                name: diagnostic.rule,
            });
        }
        return {
            ruleId,
            message: { text: diagnostic.message },
            locations: [toSarifLocation(diagnostic.source)],
            ...(((_a = diagnostic.relatedLocations) === null || _a === void 0 ? void 0 : _a.length)
                ? {
                    relatedLocations: diagnostic.relatedLocations.map(toSarifRelatedLocation),
                }
                : {}),
            level: toSarifLevel(diagnostic.severity),
            properties: diagnosticProperties(diagnostic),
        };
    });
    const rules = Array.from(ruleMeta.entries()).map(([id, meta]) => ({
        id,
        name: meta.name,
        helpUri: meta.helpUri,
        properties: { "zemdomu/rule": meta.name },
    }));
    return {
        $schema: SARIF_SCHEMA_URI,
        version: "2.1.0",
        runs: [
            {
                tool: {
                    driver: {
                        name: "ZemDomu",
                        informationUri: "https://github.com/ZemDomu",
                        rules,
                    },
                },
                results,
            },
        ],
    };
}
/**
 * Compatibility adapter for callers that still hold the legacy lint result
 * map. New integrations should pass `ZemDomuDiagnostic[]` to
 * `diagnosticsToSarif()` directly.
 */
function resultsToSarif(results) {
    return diagnosticsToSarif([...results.entries()].flatMap(([file, issues]) => issues.map((issue) => (0, diagnostics_1.toZemDomuDiagnostic)(issue, { sourceFile: file }))));
}
