import { createHash } from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { minimatch } from "minimatch";
import { ProjectLinter } from "../../src/project-linter";
import { RULE_CODES } from "../../src/rule-codes";
import type { LintResult } from "../../src/linter";
import type { RuleOracleName } from "../rule-oracle/schema";
import type {
  AccuracyCorpusCandidateBundle,
  AccuracyCorpusManifest,
  AccuracyCorpusRepositoryRun,
  CorpusAnalysisBoundary,
  CorpusRepositoryManifestEntry,
  FindingCandidate,
} from "./schema";

const defaultRuleCodes = RULE_CODES as Readonly<Record<string, string>>;

export interface AccuracyCorpusRunnerOptions {
  manifestPath: string;
  outputPath: string;
  packageVersion: string;
  repositoryIds?: readonly string[];
  workspaceRoot?: string;
  keepWorkspace?: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRepositoryPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function matchesAny(filePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    minimatch(filePath, pattern, { dot: true, nocase: false })
  );
}

export function selectCorpusPaths(
  paths: readonly string[],
  entry: CorpusRepositoryManifestEntry
): string[] {
  return Array.from(new Set(paths.map(normalizeRepositoryPath)))
    .filter(
      (filePath) =>
        matchesAny(filePath, entry.include) &&
        !matchesAny(filePath, entry.exclude)
    )
    .sort()
    .slice(0, entry.maxFiles);
}

function runGit(
  args: readonly string[],
  cwd: string,
  input?: string
): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  }).trim();
}

function materializeSelectedFiles(
  repositoryRoot: string,
  commit: string,
  selectedFiles: readonly string[]
): void {
  const batchSize = 40;
  for (let index = 0; index < selectedFiles.length; index += batchSize) {
    runGit(
      [
        "checkout",
        "--quiet",
        commit,
        "--",
        ...selectedFiles.slice(index, index + batchSize),
      ],
      repositoryRoot
    );
  }
}

export function preparePinnedRepository(
  entry: CorpusRepositoryManifestEntry,
  workspaceRoot: string
): { repositoryRoot: string; selectedFiles: string[] } {
  const repositoryRoot = path.join(workspaceRoot, entry.id);
  if (fs.existsSync(repositoryRoot)) {
    throw new Error(
      `Refusing to reuse existing corpus workspace directory: ${repositoryRoot}`
    );
  }
  fs.mkdirSync(repositoryRoot, { recursive: true });
  runGit(["init", "--quiet"], repositoryRoot);
  runGit(["remote", "add", "origin", entry.repository], repositoryRoot);
  runGit(
    [
      "fetch",
      "--quiet",
      "--depth=1",
      "origin",
      entry.commit,
    ],
    repositoryRoot
  );
  const fetchedCommit = runGit(["rev-parse", "FETCH_HEAD"], repositoryRoot);
  if (fetchedCommit !== entry.commit) {
    throw new Error(
      `${entry.id} resolved ${fetchedCommit}; expected pinned commit ${entry.commit}`
    );
  }

  const treePaths = runGit(
    ["ls-tree", "-r", "--name-only", entry.commit],
    repositoryRoot
  ).split(/\r?\n/).filter(Boolean);
  const selectedFiles = selectCorpusPaths(treePaths, entry);
  if (selectedFiles.length === 0) {
    throw new Error(`${entry.id} has no files matching its manifest selection`);
  }
  materializeSelectedFiles(repositoryRoot, entry.commit, selectedFiles);
  return { repositoryRoot, selectedFiles };
}

function sourceAnchor(
  repositoryRoot: string,
  filePath: string,
  result: LintResult
) {
  return {
    file: normalizeRepositoryPath(path.relative(repositoryRoot, filePath)),
    line: result.line,
    column: result.column,
  };
}

function findingId(
  entry: CorpusRepositoryManifestEntry,
  sourceFile: string,
  result: LintResult
): string {
  return `zd20-${sha256(
    [
      entry.id,
      entry.commit,
      sourceFile,
      result.rule,
      String(result.line),
      String(result.column),
      result.message,
    ].join("\0")
  ).slice(0, 24)}`;
}

function compareCandidates(a: FindingCandidate, b: FindingCandidate): number {
  return (
    a.source.file.localeCompare(b.source.file) ||
    a.source.line - b.source.line ||
    a.source.column - b.source.column ||
    a.code.localeCompare(b.code) ||
    a.message.localeCompare(b.message)
  );
}

export async function scanMaterializedRepository(
  entry: CorpusRepositoryManifestEntry,
  repositoryRoot: string,
  selectedFiles: readonly string[]
): Promise<AccuracyCorpusRepositoryRun> {
  const absoluteFiles = selectedFiles.map((filePath) =>
    path.join(repositoryRoot, filePath)
  );
  const linter = new ProjectLinter({
    rootDir: repositoryRoot,
    crossComponentAnalysis: false,
  });
  const resultMap = await linter.lintFiles(absoluteFiles);
  const candidates: FindingCandidate[] = [];
  const analysisBoundaries: CorpusAnalysisBoundary[] = [];

  for (const [filePath, results] of resultMap.entries()) {
    for (const result of results) {
      const source = sourceAnchor(repositoryRoot, filePath, result);
      const code = defaultRuleCodes[result.rule];
      if (!code) {
        analysisBoundaries.push({
          repositoryId: entry.id,
          syntax: entry.syntax,
          kind: result.rule === "parseError"
            ? "parse-error"
            : "unsupported-diagnostic",
          message: result.message,
          source,
        });
        continue;
      }
      candidates.push({
        id: findingId(entry, source.file, result),
        repositoryId: entry.id,
        syntax: entry.syntax,
        rule: result.rule as RuleOracleName,
        code,
        severity: result.severity === "warning" ? "warning" : "error",
        message: result.message,
        source,
      });
    }
  }

  const uniqueCandidates = Array.from(
    new Map(candidates.map((candidate) => [candidate.id, candidate])).values()
  ).sort(compareCandidates);
  analysisBoundaries.sort(
    (a, b) =>
      a.source.file.localeCompare(b.source.file) ||
      a.source.line - b.source.line ||
      a.source.column - b.source.column ||
      a.message.localeCompare(b.message)
  );

  return {
    id: entry.id,
    repository: entry.repository,
    commit: entry.commit,
    syntax: entry.syntax,
    selectedFiles: [...selectedFiles],
    candidates: uniqueCandidates,
    analysisBoundaries,
  };
}

function summarizeRuns(
  repositories: readonly AccuracyCorpusRepositoryRun[]
): AccuracyCorpusCandidateBundle["summary"] {
  const candidatesByRule: Record<string, number> = {};
  const candidatesBySyntax = { html: 0, jsx: 0, tsx: 0, vue: 0 };
  for (const repository of repositories) {
    candidatesBySyntax[repository.syntax] += repository.candidates.length;
    for (const candidate of repository.candidates) {
      candidatesByRule[candidate.rule] =
        (candidatesByRule[candidate.rule] ?? 0) + 1;
    }
  }
  return {
    repositoryCount: repositories.length,
    selectedFileCount: repositories.reduce(
      (total, repository) => total + repository.selectedFiles.length,
      0
    ),
    candidateCount: repositories.reduce(
      (total, repository) => total + repository.candidates.length,
      0
    ),
    analysisBoundaryCount: repositories.reduce(
      (total, repository) => total + repository.analysisBoundaries.length,
      0
    ),
    candidatesByRule: Object.fromEntries(
      Object.entries(candidatesByRule).sort(([a], [b]) => a.localeCompare(b))
    ),
    candidatesBySyntax,
  };
}

export async function runAccuracyCorpusCandidateScan(
  options: AccuracyCorpusRunnerOptions
): Promise<AccuracyCorpusCandidateBundle> {
  const manifestSource = fs.readFileSync(options.manifestPath, "utf8");
  const manifest = JSON.parse(manifestSource) as AccuracyCorpusManifest;
  const requested = new Set(options.repositoryIds ?? []);
  const entries = requested.size === 0
    ? manifest.repositories
    : manifest.repositories.filter((entry) => requested.has(entry.id));
  if (requested.size > 0 && entries.length !== requested.size) {
    const found = new Set(entries.map((entry) => entry.id));
    const missing = [...requested].filter((id) => !found.has(id));
    throw new Error(`Unknown repository ids: ${missing.join(", ")}`);
  }

  const ownsWorkspace = options.workspaceRoot === undefined;
  const workspaceRoot = options.workspaceRoot ??
    fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-zd20-"));
  if (!ownsWorkspace) fs.mkdirSync(workspaceRoot, { recursive: true });

  try {
    const repositories: AccuracyCorpusRepositoryRun[] = [];
    for (const entry of entries) {
      process.stderr.write(`Preparing ${entry.id} at ${entry.commit}\n`);
      const prepared = preparePinnedRepository(entry, workspaceRoot);
      repositories.push(
        await scanMaterializedRepository(
          entry,
          prepared.repositoryRoot,
          prepared.selectedFiles
        )
      );
    }

    const bundle: AccuracyCorpusCandidateBundle = {
      schemaVersion: 1,
      tranche: manifest.tranche,
      manifestSha256: sha256(manifestSource),
      analyzer: {
        package: "zemdomu",
        version: options.packageVersion,
        ruleConfiguration: "defaults",
        crossComponentAnalysis: false,
      },
      repositories,
      summary: summarizeRuns(repositories),
    };
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
    return bundle;
  } finally {
    if (ownsWorkspace && !options.keepWorkspace) {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  }
}
