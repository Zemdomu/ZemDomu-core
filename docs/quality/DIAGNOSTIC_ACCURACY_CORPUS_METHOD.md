# Diagnostic accuracy corpus method

Status: final ZD-20 tranche. The checked-in study and aggregate summary pass
the completion gates below for ZemDomu 1.3.19 plus the Unreleased accuracy fixes.

## Purpose

Measure ZemDomu's source-diagnostic accuracy on pinned public repositories
without publishing third-party source or private review material. The existing
rule oracle remains the synthetic regression suite; this corpus adds manually
reviewed real-world findings, seeded recall, and explicit axe-core disagreement
dispositions.

## Reproducible sampling

Each tranche manifest records a public Git repository, a full 40-character
commit, syntax, include and exclude globs, maximum file count, and selection
algorithm. Candidate files are repository-relative paths sorted by Unicode code
point; the first `maxFiles` matching paths are selected. Generated files,
dependencies, and build output are excluded.

The candidate manifest contains 10 public repositories: three HTML sources,
four React/TSX sources, and three Vue sources. Repositories remain pinned even
if their default branches advance. The manifest deliberately samples source
files and excludes generated output, dependencies, and build directories.

Run `npm run accuracy-corpus:prepare` from `packages/ZemDomu-Core` to fetch the
pinned commits, select files, lint them with the default rules, and write
`tests/accuracy-corpus/tranche-01.candidates.json`. Use `--output <path>` to
write elsewhere or repeat `--repository=<id>` to run a subset. The candidate
bundle contains deterministic IDs, repository-relative source anchors, rule
codes, and analysis boundaries. It does not assign adjudication verdicts.

Run `npm run accuracy-corpus:seed` to reproduce the reviewed mutation results.
Run `npm run accuracy-corpus:axe -- --workspace <prepared-workspace> --chrome
<chrome-path>` to reproduce the rendered comparison, then run
`npm run accuracy-corpus:study` to verify evidence hashes and regenerate the
study summary. Chrome and axe-core versions are recorded in the evidence.

## Finding adjudication

1. Run ZemDomu with its documented default rule configuration and preserve the
   machine-readable diagnostic identity and source anchor.
2. Review each unique finding as `true-positive`, `false-positive`,
   `out-of-scope`, or `unresolved`. Record a concrete rationale against the
   documented rule behavior and supported source semantics.
3. Count only true and false positives in precision. Report out-of-scope counts
   separately. An unresolved finding blocks publication rather than silently
   leaving the denominator.
4. Use a second reviewer for false positives, ambiguous source composition,
   and any finding that changes a rule's threshold outcome. Resolve differences
   before finalizing the tranche.

Candidate bundle lines and columns are zero-based, matching the canonical
diagnostic contract. Convert a candidate into a `FindingAdjudication` only
after a reviewer supplies a verdict and rationale; never infer a verdict from
the fact that ZemDomu emitted the candidate.

For the final tranche, threshold-affecting false-positive fixes received a
separate code-review pass with focused regression tests. The three excluded
Liquid-highlight observations were rechecked against their rendered-template
semantics; no finding remains unresolved.

## Final tranche result

The final candidate run contains 402 diagnostics from 538 selected files
across 10 pinned repositories: 383 HTML, 6 React/TSX, and 13 Vue findings. It
records no parse or unsupported-diagnostic boundaries. All repositories remain
part of the scanned denominator even when accuracy fixes leave a repository
with no emitted diagnostic.

The study finalizes 399 natural-corpus findings as true positives and excludes
three Google Chrome sample tags rendered inside Liquid `highlight` blocks as
source-code examples rather than page DOM. Eight reviewed targeted mutation
observations cover default rules with no eligible natural candidate, producing
407 precision observations across all 21 default rules. Targeted observations
are identified by the `zemdomu-targeted-fixtures` repository ID; several
per-rule denominators are intentionally small and must not be generalized
beyond this tranche.

Measured precision is 407/407 (100%), with every default rule at or above the
90% gate. This is a bounded, reproducible post-fix result, not a claim that all
future repositories or unsupported template languages have perfect precision.

Precision is `true positives / (true positives + false positives)`. The final
study needs at least 300 adjudicated findings across at least 10 repositories,
HTML, React JSX/TSX, and Vue representation, at least 95% overall precision, and at least
90% precision for every default rule. A default rule with no eligible finding
does not pass.

## Seeded recall

Seeds are reviewed defects inserted at recorded source anchors before the scan.
Each seed records one expected default rule and exactly one category:
`accessible-name`, `language`, `image-alt`, or `other`. A seed is detected only
when the expected rule reports the recorded defect; nearby unrelated findings
do not count.

Recall is `detected seeds / all seeds`. The final study needs at least 90%
overall seeded recall and at least 95% recall in each of accessible-name,
language, and image-alt. Missing category observations block publication.

The final run detects 37/37 reviewed seeds: 10/10 accessible-name, 10/10
language, 10/10 image-alt, and 7/7 other targeted mutations.

## axe-core comparison

axe-core evaluates rendered DOM, while ZemDomu analyzes supported source. Only
comparisons with a defensible source-to-rendered anchor are in scope. Record
agreements, ZemDomu-only findings, and axe-only findings. Every in-scope
disagreement requires a disposition explaining a confirmed defect, a rule-scope
difference, an unsupported runtime composition, or a product bug. Pending
disagreements block publication.

axe-core 4.13.0 was run in installed headless Google Chrome against three
pinned static pages. Eight mapped results agree on button names, iframe names,
image alternatives, document language, heading order, and main landmarks. One
ZemDomu-only section-heading result and three axe-only missing-H1/region results
are recorded with explicit rule-scope dispositions; none remain pending.

## Publication and privacy

Publish the manifests, aggregate metrics, tool versions, rule configuration,
and enough source anchors to reproduce public-repository observations. Do not
copy third-party source into the results and do not publish reviewer identities
or private-repository paths. Raw private findings may inform fixes but cannot be
part of the reproducible public denominator.

The deterministic metric gate lives in
`tests/accuracy-corpus/metrics.ts`; its tests prevent a partial study from
claiming the ZD-20 thresholds.
