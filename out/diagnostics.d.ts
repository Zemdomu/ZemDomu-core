import type { LintResult } from "./linter";
/** Schema version for the machine-readable ZemDomu diagnostic contract. */
export declare const ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION: "1.0";
export type ZemDomuDiagnosticSeverity = "error" | "warning" | "info";
export type ZemDomuDiagnosticConfidence = "certain" | "inferred" | "unknown";
export type ZemDomuDiagnosticProvenanceKind = "source" | "cross-component" | "inference";
export interface ZemDomuSourceLocation {
    /** Source file path or URI supplied by the caller or ProjectLinter. */
    file: string;
    /** Zero-based source line. */
    line: number;
    /** Zero-based source column. */
    column: number;
    /** Zero-based absolute source offset, when known. */
    offset?: number;
}
export interface ZemDomuRelatedLocation {
    source: ZemDomuSourceLocation;
    message?: string;
}
export interface ZemDomuDiagnosticSuggestion {
    message: string;
    /** Optional replacement text for consumers that can safely apply an edit. */
    replacement?: string;
}
export interface ZemDomuDiagnosticProvenance {
    kind: ZemDomuDiagnosticProvenanceKind;
    /** Producer or analysis stage that supplied the evidence. */
    analyzer?: string;
    /** Human-readable explanation of the evidence used. */
    description?: string;
}
/**
 * Canonical, versioned diagnostic exchanged between ZemDomu integrations.
 *
 * Unlike the compatibility-focused `LintResult`, every identity, severity and
 * primary source-location field is required.
 */
export interface ZemDomuDiagnostic {
    schemaVersion: typeof ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION;
    rule: string;
    code: string;
    severity: ZemDomuDiagnosticSeverity;
    message: string;
    source: ZemDomuSourceLocation;
    page?: string;
    componentPath?: string[];
    relatedLocations?: ZemDomuRelatedLocation[];
    /** Preferred source location for an edit, only when analysis resolves it deterministically. */
    preferredEditLocation?: ZemDomuSourceLocation;
    suggestion?: ZemDomuDiagnosticSuggestion;
    provenance?: ZemDomuDiagnosticProvenance;
    confidence?: ZemDomuDiagnosticConfidence;
}
export interface ZemDomuDiagnosticContext {
    /** Required when the legacy result does not already contain `filePath`. */
    sourceFile?: string;
    /** Used when a legacy result does not contain an emitted severity. */
    defaultSeverity?: ZemDomuDiagnosticSeverity;
    page?: string;
    componentPath?: string[];
    relatedLocations?: ZemDomuRelatedLocation[];
    preferredEditLocation?: ZemDomuSourceLocation;
    suggestion?: ZemDomuDiagnosticSuggestion;
    provenance?: ZemDomuDiagnosticProvenance;
    confidence?: ZemDomuDiagnosticConfidence;
}
/**
 * Adapt a legacy `LintResult` to the canonical contract without changing the
 * object returned by `lint()` or `ProjectLinter`.
 */
export declare function toZemDomuDiagnostic(result: LintResult, context?: ZemDomuDiagnosticContext): ZemDomuDiagnostic;
/** Serialize canonical diagnostics as a JSON array without mutating them. */
export declare function serializeZemDomuDiagnostics(diagnostics: readonly ZemDomuDiagnostic[], space?: number): string;
/** Render one canonical diagnostic for developer-facing terminal output. */
export declare function formatZemDomuDiagnosticPretty(diagnostic: ZemDomuDiagnostic): string;
