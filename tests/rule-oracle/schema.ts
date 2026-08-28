import type { RULE_CODES } from "../../src/rule-codes";

export type RuleOracleName = keyof typeof RULE_CODES;
export type RuleOracleSyntax = "html" | "jsx" | "tsx" | "vue";
export type RuleOracleCaseKind = "known-bad" | "known-good" | "ambiguous";

export const RULE_ORACLE_SYNTAXES: readonly RuleOracleSyntax[] = [
  "html",
  "jsx",
  "tsx",
  "vue",
];

export interface RuleOracleOffsetExpectation {
  needle: string;
  occurrence?: number;
  delta?: number;
}

export interface RuleOracleCase {
  id: string;
  title: string;
  kind: RuleOracleCaseKind;
  rationale: string;
  source: string;
  expected: {
    count: number;
    offsets: readonly RuleOracleOffsetExpectation[];
    messageIncludes?: string;
  };
}

export type RuleOracleCell =
  | { applicable: true; cases: readonly RuleOracleCase[] }
  | { applicable: false; rationale: string };

export type RuleOracleMatrix = Record<
  RuleOracleName,
  Record<RuleOracleSyntax, RuleOracleCell>
>;

export function applicable(...cases: RuleOracleCase[]): RuleOracleCell {
  return { applicable: true, cases };
}

export function notApplicable(rationale: string): RuleOracleCell {
  return { applicable: false, rationale };
}

export function defineRuleOracleMatrix(
  matrix: RuleOracleMatrix
): RuleOracleMatrix {
  return matrix;
}

export const RULE_ORACLE_COVERAGE_POLICY = {
  targets: {
    knownBad: 5,
    knownGoodOrAmbiguous: 10,
  },
  graduatedRules: ["requireAltText"] satisfies readonly RuleOracleName[],
  phase1Floors: {
    knownBad: 0,
    knownGoodOrAmbiguous: 0,
  },
} as const;

function configuredMinimum(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

export function getEnforcedRuleOracleMinimums() {
  return {
    knownBad: configuredMinimum(
      "ZEMDOMU_ORACLE_MIN_BAD",
      RULE_ORACLE_COVERAGE_POLICY.phase1Floors.knownBad
    ),
    knownGoodOrAmbiguous: configuredMinimum(
      "ZEMDOMU_ORACLE_MIN_GOOD_OR_AMBIGUOUS",
      RULE_ORACLE_COVERAGE_POLICY.phase1Floors.knownGoodOrAmbiguous
    ),
  };
}
