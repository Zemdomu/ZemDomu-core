import { strict as assert } from "assert";
import {
  diagnosticsToSarif,
  formatZemDomuDiagnosticPretty,
  resultsToSarif,
  SARIF_SCHEMA_URI,
  serializeZemDomuDiagnostics,
  ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
} from "../src";
import type { ZemDomuDiagnostic } from "../src";

describe("SARIF output", () => {
  const diagnostic: ZemDomuDiagnostic = {
    schemaVersion: ZEMDOMU_DIAGNOSTIC_SCHEMA_VERSION,
    rule: "singleH1",
    code: "ZMD003",
    severity: "warning",
    message: "Multiple page headings were found.",
    source: { file: "src/Page.tsx", line: 1, column: 2 },
    page: "/products/[id]",
    componentPath: ["AppLayout", "ProductPage"],
    relatedLocations: [
      {
        source: { file: "src/Header.tsx", line: 3, column: 4 },
        message: "Conflicting heading",
      },
    ],
    provenance: { kind: "cross-component", analyzer: "SemanticPageComposer" },
    confidence: "certain",
  };

  it("preserves canonical identity and semantic context in SARIF 2.1.0", () => {
    const sarif = diagnosticsToSarif([diagnostic]);
    const run = sarif.runs[0];
    const result = run.results[0];

    assert.equal(sarif.$schema, SARIF_SCHEMA_URI);
    assert.equal(sarif.version, "2.1.0");
    assert.equal(run.tool.driver.rules[0].id, diagnostic.code);
    assert.equal(run.tool.driver.rules[0].name, diagnostic.rule);
    assert.equal(result.ruleId, diagnostic.code);
    assert.equal(result.level, diagnostic.severity);
    assert.deepEqual(result.locations[0].physicalLocation, {
      artifactLocation: { uri: diagnostic.source.file },
      region: { startLine: diagnostic.source.line + 1, startColumn: diagnostic.source.column + 1 },
    });
    assert.equal(result.message.text, diagnostic.message);
    assert.equal(result.message.text.includes("Page:"), false);
    assert.deepEqual(result.relatedLocations?.[0].physicalLocation, {
      artifactLocation: { uri: "src/Header.tsx" },
      region: { startLine: 4, startColumn: 5 },
    });
    assert.equal(result.relatedLocations?.[0].message?.text, "Conflicting heading");
    assert.deepEqual(result.properties?.["zemdomu/componentPath"], diagnostic.componentPath);
    assert.equal(result.properties?.["zemdomu/page"], diagnostic.page);
  });

  it("keeps pretty, JSON, and SARIF views aligned to the canonical diagnostic", () => {
    const pretty = formatZemDomuDiagnosticPretty(diagnostic);
    const json = JSON.parse(serializeZemDomuDiagnostics([diagnostic])) as ZemDomuDiagnostic[];
    const sarif = diagnosticsToSarif([diagnostic]);
    const result = sarif.runs[0].results[0];

    assert.match(pretty, /ZMD003/);
    assert.match(pretty, /Page: \/products\/\[id\]/);
    assert.match(pretty, /AppLayout → ProductPage/);
    assert.deepEqual(json, [diagnostic]);
    assert.equal(result.ruleId, json[0].code);
    assert.equal(result.level, json[0].severity);
    assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, json[0].source.file);
    assert.equal(result.properties?.["zemdomu/page"], json[0].page);
    assert.deepEqual(result.properties?.["zemdomu/componentPath"], json[0].componentPath);
  });

  it("adapts legacy results through the canonical contract before SARIF formatting", () => {
    const sarif = resultsToSarif(
      new Map([
        [
          "test.html",
          [
            {
              rule: "requireAltText",
              message: "<img> tag missing alt attribute",
              severity: "error" as const,
              line: 0,
              column: 0,
            },
          ],
        ],
      ])
    );

    assert.equal(sarif.runs[0].results[0].ruleId, "ZMD004");
    assert.equal(sarif.runs[0].results[0].level, "error");
    assert.equal(sarif.runs[0].results[0].properties?.["zemdomu/schemaVersion"], "1.0");
  });
});
