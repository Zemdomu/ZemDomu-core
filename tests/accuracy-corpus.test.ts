import assert from "assert";
import fs from "fs";
import path from "path";
import { RULE_CODES } from "../src/rule-codes";
import {
  ACCURACY_CORPUS_THRESHOLDS,
  summarizeAccuracyCorpus,
} from "./accuracy-corpus/metrics";
import type {
  AccuracyCorpusManifest,
  AccuracyCorpusStudy,
  FindingAdjudication,
  SeededRecallCase,
} from "./accuracy-corpus/schema";
import type { RuleOracleName } from "./rule-oracle/schema";

const defaultRules = Object.keys(RULE_CODES) as RuleOracleName[];

function finding(
  index: number,
  rule: RuleOracleName,
  verdict: FindingAdjudication["verdict"] = "true-positive"
): FindingAdjudication {
  const syntaxes = ["html", "jsx", "tsx", "vue"] as const;
  return {
    id: `finding-${index}`,
    repositoryId: `repo-${index % 10}`,
    syntax: syntaxes[index % syntaxes.length],
    rule,
    source: { file: `src/fixture-${index}.html`, line: 1, column: 1 },
    verdict,
    rationale: "Independently reviewed against the rule's documented source scope.",
  };
}

function seed(
  index: number,
  category: SeededRecallCase["category"]
): SeededRecallCase {
  return {
    id: `seed-${category}-${index}`,
    repositoryId: `repo-${index % 10}`,
    syntax: index % 2 === 0 ? "html" : "tsx",
    category,
    expectedRule: "requireAltText",
    source: { file: `src/seed-${index}.html`, line: 1, column: 1 },
    detected: true,
    rationale: "Seed anchor and expected rule were recorded before the scan.",
  };
}

describe("diagnostic accuracy corpus metrics", () => {
  it("keeps incomplete studies from making an accuracy claim", () => {
    const summary = summarizeAccuracyCorpus(
      { schemaVersion: 1, findings: [], seeds: [], axeComparisons: [] },
      defaultRules
    );

    assert.strictEqual(summary.passes, false);
    assert.ok(summary.blockers.some((blocker) => blocker.includes("repositories")));
    assert.ok(summary.blockers.some((blocker) => blocker.includes("findings")));
    assert.ok(summary.blockers.some((blocker) => blocker.includes("seeded recall")));
  });

  it("accepts a complete study at or above every ZD-20 threshold", () => {
    const findings = Array.from(
      { length: ACCURACY_CORPUS_THRESHOLDS.adjudicatedFindings },
      (_, index) => finding(index, defaultRules[index % defaultRules.length])
    );
    const seeds = ["accessible-name", "language", "image-alt", "other"].flatMap(
      (category) =>
        Array.from({ length: 20 }, (_, index) =>
          seed(index, category as SeededRecallCase["category"])
        )
    );
    const study: AccuracyCorpusStudy = {
      schemaVersion: 1,
      findings,
      seeds,
      axeComparisons: [
        {
          id: "axe-1",
          repositoryId: "repo-0",
          status: "zemdomu-only",
          inScope: true,
          disposition: "Expected: axe-core evaluates rendered DOM, not this source-only rule.",
        },
      ],
    };

    const summary = summarizeAccuracyCorpus(study, defaultRules);
    assert.strictEqual(summary.passes, true, summary.blockers.join("\n"));
    assert.strictEqual(summary.repositoryCount, 10);
    assert.strictEqual(summary.precision.rate, 1);
    assert.strictEqual(summary.recall.rate, 1);
  });

  it("blocks unresolved findings and undispositioned axe-core disagreements", () => {
    const study: AccuracyCorpusStudy = {
      schemaVersion: 1,
      findings: [finding(1, defaultRules[0], "unresolved")],
      seeds: [],
      axeComparisons: [
        {
          id: "axe-pending",
          repositoryId: "repo-1",
          status: "axe-only",
          inScope: true,
        },
      ],
    };

    const summary = summarizeAccuracyCorpus(study, defaultRules);
    assert.strictEqual(summary.unresolvedFindingCount, 1);
    assert.strictEqual(summary.pendingAxeDisagreementCount, 1);
    assert.ok(summary.blockers.some((blocker) => blocker.includes("unresolved")));
    assert.ok(summary.blockers.some((blocker) => blocker.includes("axe-core")));
  });
});

describe("diagnostic accuracy corpus pilot manifest", () => {
  it("pins public repositories and deterministic sampling inputs", () => {
    const manifestPath = path.join(
      process.cwd(),
      "tests",
      "accuracy-corpus",
      "tranche-01.manifest.json"
    );
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8")
    ) as AccuracyCorpusManifest;

    assert.strictEqual(manifest.schemaVersion, 1);
    assert.strictEqual(manifest.status, "candidate");
    assert.deepStrictEqual(
      new Set(manifest.repositories.map((repository) => repository.syntax)),
      new Set(["html", "tsx", "vue"])
    );
    assert.strictEqual(
      new Set(manifest.repositories.map((repository) => repository.id)).size,
      manifest.repositories.length
    );
    for (const repository of manifest.repositories) {
      assert.match(repository.repository, /^https:\/\/github\.com\/.+\.git$/);
      assert.match(repository.commit, /^[a-f0-9]{40}$/);
      assert.ok(repository.include.length > 0);
      assert.ok(repository.maxFiles > 0);
      assert.strictEqual(repository.selection, "lexicographic-path");
    }
  });
});
