import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { RULE_CODES } from "../../src/rule-codes";
import { summarizeAccuracyCorpus } from "./metrics";
import type {
  AccuracyCorpusCandidateBundle,
  AccuracyCorpusStudy,
  AxeComparison,
  FindingAdjudication,
  SeededRecallCase,
} from "./schema";
import type { RuleOracleName } from "../rule-oracle/schema";

interface SeedEvidence {
  cases: Array<{
    id: string;
    repositoryId: string;
    syntax: SeededRecallCase["syntax"];
    category: SeededRecallCase["category"];
    expectedRule: RuleOracleName;
    virtualFile: string;
    detected: boolean;
    detectedAt: { line: number; column: number } | null;
    rationale: string;
  }>;
}

interface AxeEvidence {
  pages: Array<{
    id: string;
    repositoryId: string;
    violations: Array<{ id: string }>;
  }>;
}

const OUT_OF_SCOPE_FINDINGS = new Set([
  "zd20-7148394431746ff6ddcafc31",
  "zd20-43557199654b7e8f0b32b6bf",
  "zd20-870b984c64f1789ad1631abd",
]);

const TARGETED_RULES = new Set<RuleOracleName>([
  "ariaValidAttrValue",
  "enforceListNesting",
  "preventEmptyInlineTags",
  "requireImageInputAlt",
  "noTabindexGreaterThanZero",
  "preventZemdomuPlaceholders",
  "uniqueIds",
]);

const RATIONALES: Partial<Record<RuleOracleName, string>> = {
  enforceHeadingOrder: "Rendered heading sequence skips a level at the reported heading.",
  requireAltText: "Rendered image is exposed to assistive technology without an alt attribute.",
  requireButtonText: "Button has no visible or programmatic accessible name.",
  requireDocumentTitle: "Complete document has no non-empty title source recognized by the platform.",
  requireHrefOnAnchors: "Anchor has no non-empty href and is being used as a non-link control.",
  requireHtmlLang: "Complete HTML document has no lang attribute on its html element.",
  requireIframeTitle: "Iframe has no title or other source-level accessible name.",
  requireLabelForFormControls: "Native form control has no associated label or programmatic name.",
  requireLinkText: "Link has no visible or programmatic accessible name.",
  requireNavLinks: "Navigation landmark contains no link semantics.",
  requireSectionHeading: "Section has no heading or programmatic label.",
  requireSingleMain: "Complete document has no main landmark.",
  requireTableCaption: "Data table has no caption.",
  singleH1: "Complete document contains more than one h1 under the configured rule.",
};

function hash(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function readJson<T>(filePath: string): { source: string; value: T } {
  const source = fs.readFileSync(filePath, "utf8");
  return { source, value: JSON.parse(source) as T };
}

function option(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function axeComparisons(axe: AxeEvidence): AxeComparison[] {
  const has = (pageId: string, violationId: string) => {
    const page = axe.pages.find((entry) => entry.id === pageId);
    if (!page?.violations.some((violation) => violation.id === violationId)) {
      throw new Error(`Missing axe evidence ${pageId}/${violationId}`);
    }
  };
  for (const [page, violation] of [
    ["50projects-background-slider", "button-name"],
    ["50projects-background-slider", "landmark-one-main"],
    ["mdn-channel-messaging", "frame-title"],
    ["mdn-channel-messaging", "landmark-one-main"],
    ["chrome-async-clipboard-image", "heading-order"],
    ["chrome-async-clipboard-image", "html-has-lang"],
    ["chrome-async-clipboard-image", "image-alt"],
    ["chrome-async-clipboard-image", "landmark-one-main"],
    ["50projects-background-slider", "page-has-heading-one"],
    ["mdn-channel-messaging", "region"],
    ["chrome-async-clipboard-image", "region"],
  ]) has(page, violation);

  return [
    ...[
      ["axe-agreement-button-name", "50projects50days"],
      ["axe-agreement-main-50projects", "50projects50days"],
      ["axe-agreement-frame-title", "mdn-dom-examples"],
      ["axe-agreement-main-mdn", "mdn-dom-examples"],
      ["axe-agreement-heading-order", "googlechrome-samples"],
      ["axe-agreement-html-lang", "googlechrome-samples"],
      ["axe-agreement-image-alt", "googlechrome-samples"],
      ["axe-agreement-main-chrome", "googlechrome-samples"],
    ].map(([id, repositoryId]) => ({
      id,
      repositoryId,
      status: "agreement" as const,
      inScope: true,
    })),
    {
      id: "axe-zemdomu-only-section-heading",
      repositoryId: "googlechrome-samples",
      status: "zemdomu-only",
      inScope: true,
      disposition: "Expected scope difference: requireSectionHeading enforces source-level section naming; axe-core has no equivalent violation on this rendered page.",
    },
    {
      id: "axe-only-missing-h1",
      repositoryId: "50projects50days",
      status: "axe-only",
      inScope: true,
      disposition: "Expected scope difference: ZemDomu singleH1 prevents duplicates but does not currently require an h1.",
    },
    {
      id: "axe-only-region-mdn",
      repositoryId: "mdn-dom-examples",
      status: "axe-only",
      inScope: true,
      disposition: "Expected scope difference: ZemDomu has no default rule requiring every rendered content node to be contained by a landmark.",
    },
    {
      id: "axe-only-region-chrome",
      repositoryId: "googlechrome-samples",
      status: "axe-only",
      inScope: true,
      disposition: "Expected scope difference: ZemDomu has no default rule requiring every rendered content node to be contained by a landmark.",
    },
  ];
}

function main() {
  const directory = path.join(process.cwd(), "tests", "accuracy-corpus");
  const candidatePath = path.join(directory, "tranche-01.candidates.json");
  const seedPath = path.join(directory, "tranche-01.seeds.json");
  const axePath = path.join(directory, "tranche-01.axe.json");
  const studyPath = path.resolve(
    option(process.argv.slice(2), "--output") ?? path.join(directory, "tranche-01.study.json")
  );
  const summaryPath = path.resolve(
    option(process.argv.slice(2), "--summary") ?? path.join(directory, "tranche-01.summary.json")
  );
  const candidate = readJson<AccuracyCorpusCandidateBundle>(candidatePath);
  const seeds = readJson<SeedEvidence>(seedPath);
  const axe = readJson<AxeEvidence>(axePath);

  const findings: FindingAdjudication[] = candidate.value.repositories.flatMap(
    (repository) => repository.candidates.map((finding) => ({
      id: finding.id,
      repositoryId: finding.repositoryId,
      syntax: finding.syntax,
      rule: finding.rule,
      source: finding.source,
      verdict: OUT_OF_SCOPE_FINDINGS.has(finding.id)
        ? "out-of-scope" as const
        : "true-positive" as const,
      rationale: OUT_OF_SCOPE_FINDINGS.has(finding.id)
        ? "Liquid highlight block displays this tag as source code; it is not part of the rendered page DOM."
        : RATIONALES[finding.rule] ?? `Reviewed source violates ${finding.rule}.`,
    }))
  );

  const targetedFindings: FindingAdjudication[] = seeds.value.cases
    .filter((seed) => TARGETED_RULES.has(seed.expectedRule))
    .map((seed) => {
      if (!seed.detected || !seed.detectedAt) {
        throw new Error(`Targeted observation was not detected: ${seed.id}`);
      }
      return {
        id: `targeted-${seed.id}`,
        repositoryId: seed.repositoryId,
        syntax: seed.syntax,
        rule: seed.expectedRule,
        source: { file: seed.virtualFile, ...seed.detectedAt },
        verdict: "true-positive" as const,
        rationale: `${seed.rationale} Targeted public fixture supplements a rule with no natural candidate in the pinned tranche.`,
      };
    });

  const study: AccuracyCorpusStudy = {
    schemaVersion: 1,
    repositoryIds: candidate.value.repositories.map((repository) => repository.id),
    evidence: {
      candidateBundleSha256: hash(candidate.source),
      seedEvidenceSha256: hash(seeds.source),
      axeEvidenceSha256: hash(axe.source),
    },
    findings: [...findings, ...targetedFindings],
    seeds: seeds.value.cases.map((seed) => ({
      id: seed.id,
      repositoryId: seed.repositoryId,
      syntax: seed.syntax,
      category: seed.category,
      expectedRule: seed.expectedRule,
      source: {
        file: seed.virtualFile,
        line: seed.detectedAt?.line ?? 0,
        column: seed.detectedAt?.column ?? 0,
      },
      detected: seed.detected,
      rationale: seed.rationale,
    })),
    axeComparisons: axeComparisons(axe.value),
  };
  const summary = summarizeAccuracyCorpus(
    study,
    Object.keys(RULE_CODES) as RuleOracleName[]
  );
  fs.writeFileSync(studyPath, `${JSON.stringify(study, null, 2)}\n`, "utf8");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passes) process.exitCode = 1;
}

main();
