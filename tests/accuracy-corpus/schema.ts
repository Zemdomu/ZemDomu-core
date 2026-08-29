import type { RuleOracleName, RuleOracleSyntax } from "../rule-oracle/schema";

export type AccuracyCorpusSyntax = RuleOracleSyntax;
export type FindingVerdict =
  | "true-positive"
  | "false-positive"
  | "out-of-scope"
  | "unresolved";
export type RecallCategory =
  | "accessible-name"
  | "language"
  | "image-alt"
  | "other";
export type AxeComparisonStatus = "agreement" | "zemdomu-only" | "axe-only";

export interface SourceAnchor {
  file: string;
  line: number;
  column: number;
}

export interface FindingAdjudication {
  id: string;
  repositoryId: string;
  syntax: AccuracyCorpusSyntax;
  rule: RuleOracleName;
  source: SourceAnchor;
  verdict: FindingVerdict;
  rationale: string;
}

export interface SeededRecallCase {
  id: string;
  repositoryId: string;
  syntax: AccuracyCorpusSyntax;
  category: RecallCategory;
  expectedRule: RuleOracleName;
  source: SourceAnchor;
  detected: boolean;
  rationale: string;
}

export interface AxeComparison {
  id: string;
  repositoryId: string;
  status: AxeComparisonStatus;
  inScope: boolean;
  disposition?: string;
}

export interface AccuracyCorpusStudy {
  schemaVersion: 1;
  findings: readonly FindingAdjudication[];
  seeds: readonly SeededRecallCase[];
  axeComparisons: readonly AxeComparison[];
}

export interface CorpusRepositoryManifestEntry {
  id: string;
  repository: string;
  commit: string;
  syntax: AccuracyCorpusSyntax;
  include: readonly string[];
  exclude: readonly string[];
  maxFiles: number;
  selection: "lexicographic-path";
}

export interface AccuracyCorpusManifest {
  schemaVersion: 1;
  tranche: string;
  status: "candidate" | "adjudicating" | "final";
  repositories: readonly CorpusRepositoryManifestEntry[];
}
