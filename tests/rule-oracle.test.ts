import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { lint, ProjectLinter } from "../src";
import type { LintResult, RuleSeverity } from "../src/linter";
import { RULE_CODES } from "../src/rule-codes";
import { RULE_ORACLE_MATRIX } from "./rule-oracle/dataset";
import {
  getEnforcedRuleOracleMinimums,
  RULE_ORACLE_COVERAGE_POLICY,
  RULE_ORACLE_SYNTAXES,
  RuleOracleCase,
  RuleOracleName,
  RuleOracleOffsetExpectation,
  RuleOracleSyntax,
} from "./rule-oracle/schema";

type OracleAdapter = (
  fixture: RuleOracleCase,
  rule: RuleOracleName
) => Promise<LintResult[]>;

const ruleNames = Object.keys(RULE_CODES) as RuleOracleName[];

function isolatedRuleOptions(rule: RuleOracleName): Record<string, RuleSeverity> {
  return Object.fromEntries(
    ruleNames.map((name) => [name, name === rule ? "error" : "off"])
  );
}

async function lintMarkup(
  fixture: RuleOracleCase,
  rule: RuleOracleName,
  syntax: "jsx" | "tsx"
): Promise<LintResult[]> {
  return lint(fixture.source, {
    filePath: `rule-oracle.${syntax}`,
    rules: isolatedRuleOptions(rule),
  }).filter((result) => result.rule === rule);
}

const adapters: Record<RuleOracleSyntax, OracleAdapter> = {
  html: async (fixture, rule) =>
    lint(fixture.source, {
      filePath: "rule-oracle.html",
      forceHtml: true,
      rules: isolatedRuleOptions(rule),
    }).filter((result) => result.rule === rule),
  jsx: (fixture, rule) => lintMarkup(fixture, rule, "jsx"),
  tsx: (fixture, rule) => lintMarkup(fixture, rule, "tsx"),
  vue: async (fixture, rule) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-oracle-"));
    const filePath = path.join(directory, "Fixture.vue");
    try {
      fs.writeFileSync(filePath, fixture.source, "utf8");
      const projectLinter = new ProjectLinter({
        rules: isolatedRuleOptions(rule),
      });
      const resultMap = await projectLinter.lintFile(filePath);
      return (resultMap.get(filePath) ?? []).filter(
        (result) => result.rule === rule
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
};

function expectedOffset(
  source: string,
  expectation: RuleOracleOffsetExpectation
): number {
  const occurrence = expectation.occurrence ?? 0;
  let offset = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(expectation.needle, offset + 1);
  }
  assert.notStrictEqual(
    offset,
    -1,
    `Expected occurrence ${occurrence} of ${JSON.stringify(expectation.needle)}`
  );
  return offset + (expectation.delta ?? 0);
}

function positionAt(source: string, offset: number) {
  const lines = source.slice(0, offset).split(/\r?\n/);
  return { line: lines.length - 1, column: lines[lines.length - 1].length };
}

function caseCounts(cases: readonly RuleOracleCase[]) {
  return {
    knownBad: cases.filter((fixture) => fixture.kind === "known-bad").length,
    knownGoodOrAmbiguous: cases.filter(
      (fixture) => fixture.kind === "known-good" || fixture.kind === "ambiguous"
    ).length,
  };
}

describe("rule oracle matrix", () => {
  it("has complete RULE_CODES topology, unique IDs, and valid expectations", () => {
    assert.deepStrictEqual(
      Object.keys(RULE_ORACLE_MATRIX).sort(),
      [...ruleNames].sort(),
      "The oracle must contain exactly the registered rules"
    );

    const ids = new Set<string>();
    for (const rule of ruleNames) {
      const cells = RULE_ORACLE_MATRIX[rule];
      assert.ok(cells, `Missing oracle row for ${rule}`);
      assert.deepStrictEqual(
        Object.keys(cells).sort(),
        [...RULE_ORACLE_SYNTAXES].sort(),
        `${rule} must define every required syntax cell`
      );

      for (const syntax of RULE_ORACLE_SYNTAXES) {
        const cell = cells[syntax];
        assert.ok(cell, `Missing ${rule}/${syntax} cell`);
        if (!cell.applicable) {
          assert.ok(
            cell.rationale.trim().length >= 12,
            `${rule}/${syntax} needs a meaningful N/A rationale`
          );
          continue;
        }

        for (const fixture of cell.cases) {
          assert.match(
            fixture.id,
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            `${rule}/${syntax} fixture IDs must be stable kebab-case`
          );
          assert.ok(!ids.has(fixture.id), `Duplicate oracle ID: ${fixture.id}`);
          ids.add(fixture.id);
          assert.ok(
            fixture.rationale.trim().length >= 12,
            `${fixture.id} needs an adjudication rationale`
          );
          assert.strictEqual(
            fixture.expected.count,
            fixture.expected.offsets.length,
            `${fixture.id} must specify one exact offset per expected finding`
          );
          for (const offset of fixture.expected.offsets) {
            expectedOffset(fixture.source, offset);
          }
        }
      }
    }
  });

  it("reports coverage and enforces Phase 1 floors plus graduated rules", () => {
    const enforced = getEnforcedRuleOracleMinimums();
    const policy = RULE_ORACLE_COVERAGE_POLICY;
    const graduatedRules = new Set<RuleOracleName>(policy.graduatedRules);
    let applicableCells = 0;
    let populatedCells = 0;
    let totalCases = 0;
    let targetReadyCells = 0;
    const bySyntax = new Map<RuleOracleSyntax, number>(
      RULE_ORACLE_SYNTAXES.map((syntax) => [syntax, 0])
    );
    const deficits: string[] = [];

    for (const rule of ruleNames) {
      for (const syntax of RULE_ORACLE_SYNTAXES) {
        const cell = RULE_ORACLE_MATRIX[rule][syntax];
        if (!cell.applicable) continue;
        applicableCells += 1;
        if (cell.cases.length > 0) populatedCells += 1;
        totalCases += cell.cases.length;
        bySyntax.set(syntax, (bySyntax.get(syntax) ?? 0) + cell.cases.length);
        const counts = caseCounts(cell.cases);
        const requiredKnownBad = graduatedRules.has(rule)
          ? Math.max(enforced.knownBad, policy.targets.knownBad)
          : enforced.knownBad;
        const requiredKnownGoodOrAmbiguous = graduatedRules.has(rule)
          ? Math.max(
              enforced.knownGoodOrAmbiguous,
              policy.targets.knownGoodOrAmbiguous
            )
          : enforced.knownGoodOrAmbiguous;
        if (
          counts.knownBad >= policy.targets.knownBad &&
          counts.knownGoodOrAmbiguous >= policy.targets.knownGoodOrAmbiguous
        ) {
          targetReadyCells += 1;
        }
        if (
          counts.knownBad < requiredKnownBad ||
          counts.knownGoodOrAmbiguous < requiredKnownGoodOrAmbiguous
        ) {
          deficits.push(
            `${rule}/${syntax}: bad=${counts.knownBad}, ` +
              `good-or-ambiguous=${counts.knownGoodOrAmbiguous}; ` +
              `required=${requiredKnownBad}/${requiredKnownGoodOrAmbiguous}`
          );
        }
      }
    }

    console.log(
      `[rule-oracle] ${totalCases} cases; ${populatedCells}/${applicableCells} ` +
        `applicable cells populated; ${targetReadyCells}/${applicableCells} meet ` +
        `the future ${policy.targets.knownBad}/${policy.targets.knownGoodOrAmbiguous} targets.`
    );
    console.log(
      `[rule-oracle] cases by syntax: ${RULE_ORACLE_SYNTAXES.map(
        (syntax) => `${syntax}=${bySyntax.get(syntax) ?? 0}`
      ).join(", ")}; enforced floors: ${enforced.knownBad}/` +
        `${enforced.knownGoodOrAmbiguous}; graduated rules: ` +
        `${policy.graduatedRules.join(", ") || "none"}.`
    );

    assert.deepStrictEqual(
      deficits,
      [],
      `Configured oracle minimums are not met:\n${deficits.join("\n")}`
    );
  });
});

describe("rule oracle cases", () => {
  for (const rule of ruleNames) {
    for (const syntax of RULE_ORACLE_SYNTAXES) {
      const cell = RULE_ORACLE_MATRIX[rule][syntax];
      if (!cell.applicable) continue;
      for (const fixture of cell.cases) {
        it(`${fixture.id}: ${fixture.title}`, async () => {
          const results = await adapters[syntax](fixture, rule);
          assert.strictEqual(
            results.length,
            fixture.expected.count,
            `${fixture.id} emitted unexpected ${rule} findings:\n${JSON.stringify(
              results,
              null,
              2
            )}`
          );
          assert.deepStrictEqual(
            results.map((result) => result.offset),
            fixture.expected.offsets.map((offset) =>
              expectedOffset(fixture.source, offset)
            ),
            `${fixture.id} emitted findings at unexpected offsets`
          );
          assert.deepStrictEqual(
            results.map(({ line, column }) => ({ line, column })),
            fixture.expected.offsets.map((offset) =>
              positionAt(fixture.source, expectedOffset(fixture.source, offset))
            ),
            `${fixture.id} emitted line/column positions inconsistent with its offsets`
          );
          assert.ok(
            results.every((result) => result.code === RULE_CODES[rule]),
            `${fixture.id} emitted a finding without the expected stable rule code`
          );
          if (fixture.expected.messageIncludes) {
            assert.ok(
              results.every((result) =>
                result.message.includes(fixture.expected.messageIncludes!)
              ),
              `${fixture.id} emitted an unexpected diagnostic message`
            );
          }
        });
      }
    }
  }
});
