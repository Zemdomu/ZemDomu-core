import { strict as assert } from "assert";
import {
  serializeZemDomuDiagnostics,
  toZemDomuDiagnostic,
  ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
} from "../src";
import type { LintResult, ZemDomuDiagnostic } from "../src";

describe("ZemDomuDiagnostic contract", () => {
  it("adapts legacy results into the required versioned shape", () => {
    const legacy: LintResult = {
      rule: "requireAltText",
      message: "<img> tag missing alt attribute",
      severity: "warning",
      line: 3,
      column: 7,
      offset: 42,
    };

    const diagnostic = toZemDomuDiagnostic(legacy, {
      sourceFile: "src/Card.tsx",
    });

    assert.deepEqual(diagnostic, {
      schemaVersion: "1.0",
      rule: "requireAltText",
      code: "ZMD004",
      severity: "warning",
      message: "<img> tag missing alt attribute",
      source: {
        file: "src/Card.tsx",
        line: 3,
        column: 7,
        offset: 42,
      },
    });
    assert.equal(
      diagnostic.schemaVersion,
      ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION
    );
    assert.deepEqual(legacy, {
      rule: "requireAltText",
      message: "<img> tag missing alt attribute",
      severity: "warning",
      line: 3,
      column: 7,
      offset: 42,
    });
  });

  it("preserves optional semantic context and related locations", () => {
    const diagnostic = toZemDomuDiagnostic(
      {
        rule: "customSemanticRule",
        code: "TEAM001",
        message: "Primary content is ambiguous.",
        filePath: "src/ProductPage.tsx",
        line: 4,
        column: 2,
        related: [
          {
            filePath: "src/AppLayout.tsx",
            line: 8,
            column: 6,
            message: "Rendered by AppLayout",
          },
        ],
      },
      {
        defaultSeverity: "info",
        page: "/products/[id]",
        componentPath: ["AppLayout", "ProductPage"],
        suggestion: {
          message: "Wrap the primary content in <main>.",
          replacement: "<main>{children}</main>",
        },
        provenance: {
          kind: "inference",
          analyzer: "page-composition",
          description: "Derived from the statically resolved render path.",
        },
        confidence: "inferred",
      }
    );

    assert.deepEqual(diagnostic.relatedLocations, [
      {
        source: {
          file: "src/AppLayout.tsx",
          line: 8,
          column: 6,
        },
        message: "Rendered by AppLayout",
      },
    ]);
    assert.equal(diagnostic.code, "TEAM001");
    assert.equal(diagnostic.severity, "info");
    assert.equal(diagnostic.page, "/products/[id]");
    assert.deepEqual(diagnostic.componentPath, ["AppLayout", "ProductPage"]);
    assert.equal(diagnostic.confidence, "inferred");
  });

  it("uses a stable custom-rule code fallback and requires a source file", () => {
    const customResult: LintResult = {
      rule: "teamRule",
      message: "Team rule failed.",
      line: 0,
      column: 0,
    };

    assert.equal(
      toZemDomuDiagnostic(customResult, { sourceFile: "index.html" }).code,
      "teamRule"
    );
    assert.throws(
      () => toZemDomuDiagnostic(customResult),
      /A source file is required/
    );
  });

  it("serializes the complete contract without dropping optional context", () => {
    const diagnostic: ZemDomuDiagnostic = {
      schemaVersion: ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
      rule: "singleH1",
      code: "ZMD003",
      severity: "warning",
      message: "Multiple page headings were found.",
      source: { file: "src/Page.tsx", line: 1, column: 2 },
      page: "/",
      componentPath: ["App", "Page"],
      relatedLocations: [
        {
          source: { file: "src/Header.tsx", line: 3, column: 4 },
          message: "Conflicting heading",
        },
      ],
      suggestion: { message: "Keep one primary page heading." },
      provenance: { kind: "cross-component", analyzer: "ComponentAnalyzer" },
      confidence: "certain",
    };

    const parsed = JSON.parse(
      serializeZemDomuDiagnostics([diagnostic], 2)
    ) as ZemDomuDiagnostic[];

    assert.deepEqual(parsed, [diagnostic]);
    assert.equal(parsed[0].schemaVersion, "1.0");
  });
});
