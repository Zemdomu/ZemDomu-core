import type { RuleOracleName } from "../rule-oracle/schema";
import type {
  AccuracyCorpusStudy,
  FindingAdjudication,
  RecallCategory,
  SeededRecallCase,
} from "./schema";

export const ACCURACY_CORPUS_THRESHOLDS = {
  repositories: 10,
  adjudicatedFindings: 300,
  overallPrecision: 0.95,
  perRulePrecision: 0.9,
  overallRecall: 0.9,
  categoryRecall: 0.95,
  requiredRecallCategories: [
    "accessible-name",
    "language",
    "image-alt",
  ] satisfies readonly RecallCategory[],
} as const;

export interface RateMetric {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export interface AccuracyCorpusSummary {
  repositoryCount: number;
  syntaxCounts: Record<"html" | "jsx" | "tsx" | "vue", number>;
  adjudicatedFindingCount: number;
  excludedFindingCount: number;
  unresolvedFindingCount: number;
  precision: RateMetric;
  precisionByRule: Record<string, RateMetric>;
  recall: RateMetric;
  recallByCategory: Record<RecallCategory, RateMetric>;
  pendingAxeDisagreementCount: number;
  blockers: string[];
  passes: boolean;
}

function rate(numerator: number, denominator: number): RateMetric {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

function finalizedFindings(findings: readonly FindingAdjudication[]) {
  return findings.filter(
    (finding) =>
      finding.verdict === "true-positive" ||
      finding.verdict === "false-positive"
  );
}

function precisionMetric(findings: readonly FindingAdjudication[]): RateMetric {
  const final = finalizedFindings(findings);
  return rate(
    final.filter((finding) => finding.verdict === "true-positive").length,
    final.length
  );
}

function recallMetric(seeds: readonly SeededRecallCase[]): RateMetric {
  return rate(
    seeds.filter((seed) => seed.detected).length,
    seeds.length
  );
}

function requireRate(
  blockers: string[],
  label: string,
  metric: RateMetric,
  minimum: number
) {
  if (metric.rate === null) {
    blockers.push(`${label} has no eligible observations`);
  } else if (metric.rate < minimum) {
    blockers.push(
      `${label} is ${(metric.rate * 100).toFixed(2)}%; requires ${(minimum * 100).toFixed(0)}%`
    );
  }
}

export function summarizeAccuracyCorpus(
  study: AccuracyCorpusStudy,
  defaultRules: readonly RuleOracleName[]
): AccuracyCorpusSummary {
  const blockers: string[] = [];
  const finalFindings = finalizedFindings(study.findings);
  const repositoryIds = new Set(study.repositoryIds);
  const syntaxCounts = { html: 0, jsx: 0, tsx: 0, vue: 0 };
  for (const finding of finalFindings) syntaxCounts[finding.syntax] += 1;

  if (repositoryIds.size < ACCURACY_CORPUS_THRESHOLDS.repositories) {
    blockers.push(
      `only ${repositoryIds.size} repositories have adjudicated findings; requires ${ACCURACY_CORPUS_THRESHOLDS.repositories}`
    );
  }
  if (finalFindings.length < ACCURACY_CORPUS_THRESHOLDS.adjudicatedFindings) {
    blockers.push(
      `only ${finalFindings.length} findings are adjudicated; requires ${ACCURACY_CORPUS_THRESHOLDS.adjudicatedFindings}`
    );
  }
  if (syntaxCounts.html === 0) blockers.push("HTML has no adjudicated findings");
  if (syntaxCounts.jsx + syntaxCounts.tsx === 0) {
    blockers.push("React JSX/TSX has no adjudicated findings");
  }
  if (syntaxCounts.vue === 0) blockers.push("Vue has no adjudicated findings");

  const precision = precisionMetric(study.findings);
  requireRate(
    blockers,
    "overall precision",
    precision,
    ACCURACY_CORPUS_THRESHOLDS.overallPrecision
  );

  const precisionByRule: Record<string, RateMetric> = {};
  for (const rule of defaultRules) {
    const metric = precisionMetric(
      study.findings.filter((finding) => finding.rule === rule)
    );
    precisionByRule[rule] = metric;
    requireRate(
      blockers,
      `${rule} precision`,
      metric,
      ACCURACY_CORPUS_THRESHOLDS.perRulePrecision
    );
  }

  const recall = recallMetric(study.seeds);
  requireRate(
    blockers,
    "overall seeded recall",
    recall,
    ACCURACY_CORPUS_THRESHOLDS.overallRecall
  );

  const recallByCategory = {} as Record<RecallCategory, RateMetric>;
  for (const category of [
    "accessible-name",
    "language",
    "image-alt",
    "other",
  ] as const) {
    recallByCategory[category] = recallMetric(
      study.seeds.filter((seed) => seed.category === category)
    );
  }
  for (const category of ACCURACY_CORPUS_THRESHOLDS.requiredRecallCategories) {
    requireRate(
      blockers,
      `${category} seeded recall`,
      recallByCategory[category],
      ACCURACY_CORPUS_THRESHOLDS.categoryRecall
    );
  }

  const unresolvedFindingCount = study.findings.filter(
    (finding) => finding.verdict === "unresolved"
  ).length;
  if (unresolvedFindingCount > 0) {
    blockers.push(`${unresolvedFindingCount} findings remain unresolved`);
  }

  const pendingAxeDisagreementCount = study.axeComparisons.filter(
    (comparison) =>
      comparison.inScope &&
      comparison.status !== "agreement" &&
      !comparison.disposition?.trim()
  ).length;
  if (pendingAxeDisagreementCount > 0) {
    blockers.push(
      `${pendingAxeDisagreementCount} in-scope axe-core disagreements lack a disposition`
    );
  }

  return {
    repositoryCount: repositoryIds.size,
    syntaxCounts,
    adjudicatedFindingCount: finalFindings.length,
    excludedFindingCount: study.findings.filter(
      (finding) => finding.verdict === "out-of-scope"
    ).length,
    unresolvedFindingCount,
    precision,
    precisionByRule,
    recall,
    recallByCategory,
    pendingAxeDisagreementCount,
    blockers,
    passes: blockers.length === 0,
  };
}
