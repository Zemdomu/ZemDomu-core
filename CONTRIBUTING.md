# Contributing to ZemDomu Core

Report bugs, suggest improvements, or send a focused pull request. Search existing
issues first. Use [Meta discussions](https://github.com/Zemdomu/ZemDomu/discussions)
for questions or feedback spanning several ZemDomu products.

## Report a bug

Use the bug report form and include the affected version, syntax or framework,
a minimal reproduction, and expected and actual results. Include the rule ID,
source location, CLI command or library call, and relevant options. For
cross-component reports, include the smallest relevant component tree.

Reports and attachments are public. Remove tokens, credentials, private source,
customer data, and identifying paths from examples and logs. For a suspected
security vulnerability, follow [SECURITY.md](SECURITY.md).

## Suggest a change

Use the feature request form to explain the problem, who encounters it, the
proposed scope, and any workaround. Discuss broad changes before starting a large
implementation. A feature request is a proposal, not a release commitment.

## Work on a change

Use Node.js 22.17 or newer. From the root of this repository, install dependencies
and run the tests:

```sh
npm ci
npm test
```

Core compiles before testing. Its `posttest` script removes `out`, so run
`npm run build` again if you need compiled output after the tests.

The normal test suite also runs bounded property fuzzing with `fast-check`:
250 cases per property, a fixed default seed, and sources no longer than 2,048 UTF-16 code units.
Run just these properties, or increase the search budget locally:

```sh
npm run test:fuzz
ZEMDOMU_FUZZ_RUNS=1000 ZEMDOMU_FUZZ_SEED=12345 npm run test:fuzz
```

`ZEMDOMU_FUZZ_RUNS` accepts 1 through 10000; `ZEMDOMU_FUZZ_SEED` accepts a signed
32-bit integer. A failure reports its seed, shrink path, and counterexample.
Replay that property using its exact test title and the reported values:

```sh
ZEMDOMU_FUZZ_SEED=12345 ZEMDOMU_FUZZ_PATH='0:1:0' npm run test:fuzz -- --grep 'keeps malformed HTML trees finite and source positions bounded'
```

Keep replay paths scoped to the failing property. Preserve a minimized failing
input as a focused regression test before fixing the behavior. These properties
check crash handling, determinism, locations, and specific rule contracts; they
do not certify accessibility compliance.

Add a focused regression test under `tests/` for rule, parser, CLI, or diagnostic
changes. Include the relevant supported syntax and a nearby valid case when
changing a rule.
New functionality must include automated tests for its expected behavior and
important failure cases.

Follow the surrounding TypeScript naming, formatting, and module conventions.
Keep type checking enabled with the repository's checked-in `tsconfig.json`.
Fix compiler errors and confirmed security-analysis findings before merging;
document the evidence for any finding dismissed as a false positive. Do not
disable checks or weaken configuration to make a pull request pass.

Keep changes focused and include the commands and results in your pull request.
Explain any checks you could not run. For a user-facing change, add an entry under
`Unreleased` in `CHANGELOG.md`, grouped by category (for example, `Bugfix`,
`Feature`, or `Docs`).

Follow the [Code of Conduct](CODE_OF_CONDUCT.md) in issues, discussions, and reviews.

## Release security checks

Before publishing a production release, run `npm ci`, `npm test`,
`npm run audit:production`, and `npm run audit:all` on the release candidate.
The full test suite includes the generated-input property tests. Require a
successful CodeQL push run on public `main` for the exact source commit being
released, and review its findings. Fix confirmed exploitable vulnerabilities of
medium or higher severity before publishing; record evidence for false-positive
dismissals. Include the source commit and test, fuzz, audit, and CodeQL results
in the release pull request. Repeat these checks if the source changes.
