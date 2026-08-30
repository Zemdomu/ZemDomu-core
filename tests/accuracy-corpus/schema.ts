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
  /** Zero-based line, matching the canonical ZemDomu diagnostic contract. */
  line: number;
  /** Zero-based column, matching the canonical ZemDomu diagnostic contract. */
  column: number;
}

export interface FindingCandidate {
  id: string;
  repositoryId: string;
  syntax: AccuracyCorpusSyntax;
  rule: RuleOracleName;
  code: string;
  severity: "error" | "warning";
  message: string;
  source: SourceAnchor;
}

export interface CorpusAnalysisBoundary {
  repositoryId: string;
  syntax: AccuracyCorpusSyntax;
  kind: "parse-error" | "unsupported-diagnostic";
  message: string;
  source: SourceAnchor;
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
  repositoryIds: readonly string[];
  evidence: {
    candidateBundleSha256: string;
    seedEvidenceSha256: string;
    axeEvidenceSha256: string;
  };
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

export interface AccuracyCorpusRepositoryRun {
  id: string;
  repository: string;
  commit: string;
  syntax: AccuracyCorpusSyntax;
  selectedFiles: readonly string[];
  candidates: readonly FindingCandidate[];
  analysisBoundaries: readonly CorpusAnalysisBoundary[];
}

export interface AccuracyCorpusCandidateBundle {
  schemaVersion: 1;
  tranche: string;
  manifestSha256: string;
  analyzer: {
    package: "zemdomu";
    version: string;
    ruleConfiguration: "defaults";
    crossComponentAnalysis: false;
  };
  repositories: readonly AccuracyCorpusRepositoryRun[];
  summary: {
    repositoryCount: number;
    selectedFileCount: number;
    candidateCount: number;
    analysisBoundaryCount: number;
    candidatesByRule: Readonly<Record<string, number>>;
    candidatesBySyntax: Readonly<
      Record<AccuracyCorpusSyntax, number>
    >;
  };
}
