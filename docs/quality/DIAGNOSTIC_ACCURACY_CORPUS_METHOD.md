# Diagnostic accuracy corpus method

Status: pilot infrastructure for ZD-20. No precision or recall claim is valid
until the completion gates below pass.

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

The pilot manifest contains one HTML, one TSX, and one Vue repository. It is a
workflow validation tranche, not the final 10-repository corpus. Repositories
must remain pinned even if their default branches advance.

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

## axe-core comparison

axe-core evaluates rendered DOM, while ZemDomu analyzes supported source. Only
comparisons with a defensible source-to-rendered anchor are in scope. Record
agreements, ZemDomu-only findings, and axe-only findings. Every in-scope
disagreement requires a disposition explaining a confirmed defect, a rule-scope
difference, an unsupported runtime composition, or a product bug. Pending
disagreements block publication.

## Publication and privacy

Publish the manifests, aggregate metrics, tool versions, rule configuration,
and enough source anchors to reproduce public-repository observations. Do not
copy third-party source into the results and do not publish reviewer identities
or private-repository paths. Raw private findings may inform fixes but cannot be
part of the reproducible public denominator.

The deterministic metric gate lives in
`tests/accuracy-corpus/metrics.ts`; its tests prevent a partial study from
claiming the ZD-20 thresholds.
