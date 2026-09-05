import type { LintResult } from "./linter";
import type { ZemDomuDiagnostic } from "./diagnostics";
declare const SARIF_SCHEMA_URI = "https://json.schemastore.org/sarif-2.1.0.json";
declare const RULE_DOCS_BASE = "https://github.com/ZemDomu/docs/blob/main/rules/";
export interface SarifLocation {
    id?: number;
    message?: {
        text: string;
    };
    physicalLocation: {
        artifactLocation: {
            uri: string;
        };
        region: {
            startLine: number;
            startColumn: number;
        };
    };
}
export interface SarifLog {
    $schema: typeof SARIF_SCHEMA_URI;
    version: "2.1.0";
    runs: Array<{
        tool: {
            driver: {
                name: string;
                informationUri: string;
                rules: Array<{
                    id: string;
                    name: string;
                    helpUri: string;
                    properties?: Record<string, unknown>;
                }>;
            };
        };
        results: Array<{
            ruleId: string;
            message: {
                text: string;
            };
            locations: SarifLocation[];
            relatedLocations?: SarifLocation[];
            level: "error" | "warning" | "note";
            properties?: Record<string, unknown>;
        }>;
    }>;
}
/**
 * Convert canonical diagnostics to SARIF 2.1.0 without flattening semantic
 * context into the human-facing message. Related source evidence becomes
 * native SARIF related locations; page and component metadata remains in
 * structured result properties for consuming integrations.
 */
export declare function diagnosticsToSarif(diagnostics: readonly ZemDomuDiagnostic[]): SarifLog;
/**
 * Compatibility adapter for callers that still hold the legacy lint result
 * map. New integrations should pass `ZemDomuDiagnostic[]` to
 * `diagnosticsToSarif()` directly.
 */
export declare function resultsToSarif(results: ReadonlyMap<string, readonly LintResult[]>): SarifLog;
export { RULE_DOCS_BASE, SARIF_SCHEMA_URI };
