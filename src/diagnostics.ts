import type { LintResult } from "./linter";
import { getRuleCode } from "./rule-codes";

/** Schema version for the machine-readable ZemDomu diagnostic contract. */
export const ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION = "1.0" as const;

export type ZemDomuDiagnosticSeverity = "error" | "warning" | "info";
export type ZemDomuDiagnosticConfidence = "certain" | "inferred" | "unknown";
export type ZemDomuDiagnosticProvenanceKind =
  | "source"
  | "cross-component"
  | "inference";

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
  suggestion?: ZemDomuDiagnosticSuggestion;
  provenance?: ZemDomuDiagnosticProvenance;
  confidence?: ZemDomuDiagnosticConfidence;
}

/**
 * Adapt a legacy `LintResult` to the canonical contract without changing the
 * object returned by `lint()` or `ProjectLinter`.
 */
export function toZemDomuDiagnostic(
  result: LintResult,
  context: ZemDomuDiagnosticContext = {}
): ZemDomuDiagnostic {
  const file = result.filePath ?? context.sourceFile;
  if (!file) {
    throw new TypeError(
      "A source file is required to create a ZemDomuDiagnostic. Pass context.sourceFile or use a LintResult with filePath."
    );
  }

  const severity = result.severity;
  const canonicalSeverity =
    severity === "error" || severity === "warning"
      ? severity
      : context.defaultSeverity ?? "error";

  return {
    schemaVersion: ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
    rule: result.rule,
    code: result.code ?? getRuleCode(result.rule) ?? result.rule,
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
    ...(result.related === undefined
      ? {}
      : {
          relatedLocations: result.related.map((related) => ({
            source: {
              file: related.filePath,
              line: related.line,
              column: related.column,
            },
            ...(related.message === undefined
              ? {}
              : { message: related.message }),
          })),
        }),
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
export function serializeZemDomuDiagnostics(
  diagnostics: readonly ZemDomuDiagnostic[],
  space?: number
): string {
  return JSON.stringify(diagnostics, null, space);
}
