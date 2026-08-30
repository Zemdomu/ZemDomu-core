import type { LintResult } from "./linter";
import type {
  ZemDomuDiagnostic,
  ZemDomuDiagnosticSeverity,
  ZemDomuRelatedLocation,
  ZemDomuSourceLocation,
} from "./diagnostics";
import { toZemDomuDiagnostic } from "./diagnostics";

const SARIF_SCHEMA_URI = "https://json.schemastore.org/sarif-2.1.0.json";
const RULE_DOCS_BASE = "https://github.com/ZemDomu/docs/blob/main/rules/";

export interface SarifLocation {
  id?: number;
  message?: { text: string };
  physicalLocation: {
    artifactLocation: { uri: string };
    region: { startLine: number; startColumn: number };
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
      message: { text: string };
      locations: SarifLocation[];
      relatedLocations?: SarifLocation[];
      level: "error" | "warning" | "note";
      properties?: Record<string, unknown>;
    }>;
  }>;
}

function toSarifLocation(source: ZemDomuSourceLocation): SarifLocation {
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

function toSarifRelatedLocation(
  related: ZemDomuRelatedLocation,
  id: number
): SarifLocation {
  return {
    id,
    ...toSarifLocation(related.source),
    ...(related.message === undefined ? {} : { message: { text: related.message } }),
  };
}

function toSarifLevel(
  severity: ZemDomuDiagnosticSeverity
): "error" | "warning" | "note" {
  return severity === "info" ? "note" : severity;
}

function diagnosticProperties(
  diagnostic: ZemDomuDiagnostic
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "zemdomu/schemaVersion": diagnostic.schemaVersion,
    "zemdomu/rule": diagnostic.rule,
  };
  if (diagnostic.page !== undefined) properties["zemdomu/page"] = diagnostic.page;
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
export function diagnosticsToSarif(
  diagnostics: readonly ZemDomuDiagnostic[]
): SarifLog {
  const ruleMeta = new Map<string, { helpUri: string; name: string }>();
  const results: SarifLog["runs"][0]["results"] = diagnostics.map(
    (diagnostic) => {
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
        ...(diagnostic.relatedLocations?.length
          ? {
              relatedLocations: diagnostic.relatedLocations.map(
                toSarifRelatedLocation
              ),
            }
          : {}),
        level: toSarifLevel(diagnostic.severity),
        properties: diagnosticProperties(diagnostic),
      };
    }
  );

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
export function resultsToSarif(
  results: ReadonlyMap<string, readonly LintResult[]>
): SarifLog {
  return diagnosticsToSarif(
    [...results.entries()].flatMap(([file, issues]) =>
      issues.map((issue) => toZemDomuDiagnostic(issue, { sourceFile: file }))
    )
  );
}

export { RULE_DOCS_BASE, SARIF_SCHEMA_URI };
