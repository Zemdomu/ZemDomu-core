import assert from "assert";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { PAGE_ONLY_RULES, RULE_CODES } from "../src/rule-codes";
import {
  ACCURACY_CORPUS_THRESHOLDS,
  summarizeAccuracyCorpus,
} from "./accuracy-corpus/metrics";
import type {
  AccuracyCorpusManifest,
  AccuracyCorpusCandidateBundle,
  AccuracyCorpusStudy,
  FindingAdjudication,
  SeededRecallCase,
} from "./accuracy-corpus/schema";
import type { RuleOracleName } from "./rule-oracle/schema";
import {
  scanMaterializedRepository,
  selectCorpusPaths,
} from "./accuracy-corpus/runner";

const pageOnlyRules = new Set<string>(PAGE_ONLY_RULES);
const defaultRules = Object.keys(RULE_CODES).filter(
  (rule) => !pageOnlyRules.has(rule)
) as RuleOracleName[];
const emptyEvidence = {
  candidateBundleSha256: "a".repeat(64),
  seedEvidenceSha256: "b".repeat(64),
  axeEvidenceSha256: "c".repeat(64),
};

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
      {
        schemaVersion: 1,
        repositoryIds: [],
        evidence: emptyEvidence,
        findings: [],
        seeds: [],
        axeComparisons: [],
      },
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
      repositoryIds: Array.from({ length: 10 }, (_, index) => `repo-${index}`),
      evidence: emptyEvidence,
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
      repositoryIds: ["repo-1"],
      evidence: emptyEvidence,
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

describe("diagnostic accuracy corpus manifest", () => {
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
    assert.strictEqual(manifest.status, "final");
    assert.ok(manifest.repositories.length >= 10);
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

  it("keeps the generated candidate bundle pinned, reviewable, and unadjudicated", () => {
    const corpusDirectory = path.join(process.cwd(), "tests", "accuracy-corpus");
    const manifestSource = fs.readFileSync(
      path.join(corpusDirectory, "tranche-01.manifest.json"),
      "utf8"
    );
    const manifest = JSON.parse(manifestSource) as AccuracyCorpusManifest;
    const bundle = JSON.parse(
      fs.readFileSync(
        path.join(corpusDirectory, "tranche-01.candidates.json"),
        "utf8"
      )
    ) as AccuracyCorpusCandidateBundle;
    const expectedManifestHash = createHash("sha256")
      .update(manifestSource)
      .digest("hex");
    const manifestPins = new Map(
      manifest.repositories.map((repository) => [
        repository.id,
        repository.commit,
      ])
    );
    const ids = bundle.repositories.flatMap((repository) =>
      repository.candidates.map((candidate) => candidate.id)
    );

    assert.strictEqual(bundle.manifestSha256, expectedManifestHash);
    assert.strictEqual(bundle.summary.repositoryCount, manifest.repositories.length);
    assert.ok(bundle.summary.candidateCount >= 300);
    assert.ok(bundle.summary.candidatesBySyntax.html > 0);
    assert.ok(
      bundle.summary.candidatesBySyntax.jsx +
        bundle.summary.candidatesBySyntax.tsx >
        0
    );
    assert.ok(bundle.summary.candidatesBySyntax.vue > 0);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const repository of bundle.repositories) {
      assert.strictEqual(manifestPins.get(repository.id), repository.commit);
      for (const candidate of repository.candidates) {
        assert.ok(repository.selectedFiles.includes(candidate.source.file));
        assert.ok(
          !(candidate as unknown as Record<string, unknown>).verdict,
          `${candidate.id} must remain unadjudicated`
        );
      }
    }
  });

  it("publishes a final study whose evidence hashes and completion gates verify", () => {
    const corpusDirectory = path.join(process.cwd(), "tests", "accuracy-corpus");
    const study = JSON.parse(
      fs.readFileSync(path.join(corpusDirectory, "tranche-01.study.json"), "utf8")
    ) as AccuracyCorpusStudy;
    const publishedSummary = JSON.parse(
      fs.readFileSync(path.join(corpusDirectory, "tranche-01.summary.json"), "utf8")
    );
    const candidateBundle = JSON.parse(
      fs.readFileSync(path.join(corpusDirectory, "tranche-01.candidates.json"), "utf8")
    ) as AccuracyCorpusCandidateBundle;
    const evidenceFiles = {
      candidateBundleSha256: "tranche-01.candidates.json",
      seedEvidenceSha256: "tranche-01.seeds.json",
      axeEvidenceSha256: "tranche-01.axe.json",
    } as const;

    for (const [field, file] of Object.entries(evidenceFiles)) {
      const actual = createHash("sha256")
        .update(fs.readFileSync(path.join(corpusDirectory, file), "utf8"))
        .digest("hex");
      assert.strictEqual(study.evidence[field as keyof typeof evidenceFiles], actual);
    }

    assert.deepStrictEqual(
      [...study.repositoryIds].sort(),
      candidateBundle.repositories.map((repository) => repository.id).sort(),
      "Final study repository ids must exactly match the scanned candidate evidence"
    );

    const summary = summarizeAccuracyCorpus(study, defaultRules);
    assert.strictEqual(summary.passes, true, summary.blockers.join("\n"));
    assert.deepStrictEqual(summary, publishedSummary);
    assert.ok(summary.adjudicatedFindingCount >= 300);
    assert.strictEqual(summary.pendingAxeDisagreementCount, 0);
  });

  it("selects normalized paths deterministically and honors exclusions", () => {
    const entry: AccuracyCorpusManifest["repositories"][number] = {
      id: "fixture",
      repository: "https://github.com/example/fixture.git",
      commit: "a".repeat(40),
      syntax: "tsx",
      include: ["app/**/*.tsx"],
      exclude: ["**/*.test.tsx"],
      maxFiles: 2,
      selection: "lexicographic-path",
    };
    assert.deepStrictEqual(
      selectCorpusPaths(
        [
          "app\\z.tsx",
          "app/a.test.tsx",
          "app/b.tsx",
          "app/a.tsx",
          "src/ignored.tsx",
        ],
        entry
      ),
      ["app/a.tsx", "app/b.tsx"]
    );
  });

  it("emits unreviewed candidates with stable ids and relative anchors", async () => {
    const repositoryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "zemdomu-zd20-runner-")
    );
    const entry: AccuracyCorpusManifest["repositories"][number] = {
      id: "fixture",
      repository: "https://github.com/example/fixture.git",
      commit: "b".repeat(40),
      syntax: "html",
      include: ["**/*.html"],
      exclude: [],
      maxFiles: 1,
      selection: "lexicographic-path",
    };
    try {
      fs.writeFileSync(
        path.join(repositoryRoot, "index.html"),
        '<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><img src="fixture.png"></main></body></html>'
      );
      const first = await scanMaterializedRepository(
        entry,
        repositoryRoot,
        ["index.html"]
      );
      const second = await scanMaterializedRepository(
        entry,
        repositoryRoot,
        ["index.html"]
      );
      const altCandidate = first.candidates.find(
        (candidate) => candidate.rule === "requireAltText"
      );

      assert.ok(altCandidate);
      assert.strictEqual(altCandidate.source.file, "index.html");
      assert.match(altCandidate.id, /^zd20-[a-f0-9]{24}$/);
      assert.deepStrictEqual(first, second);
      assert.deepStrictEqual(first.analysisBoundaries, []);
      assert.ok(!(altCandidate as unknown as Record<string, unknown>).verdict);
    } finally {
      fs.rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});
