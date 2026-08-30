import fs from "fs";
import path from "path";
import { lint } from "../../src/linter";
import { ACCURACY_SEED_CASES } from "./seed-cases";

function option(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main() {
  const outputPath = path.resolve(
    option(process.argv.slice(2), "--output") ??
      path.join(process.cwd(), "tests", "accuracy-corpus", "tranche-01.seeds.json")
  );
  const cases = ACCURACY_SEED_CASES.map((seed) => {
    const diagnostics = lint(seed.sourceText, {
      forceHtml: seed.forceHtml,
      filePath: seed.virtualFile,
    });
    const detectedDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.rule === seed.expectedRule
    );
    return {
      ...seed,
      detected: Boolean(detectedDiagnostic),
      detectedAt: detectedDiagnostic
        ? { line: detectedDiagnostic.line, column: detectedDiagnostic.column }
        : null,
    };
  });
  const output = {
    schemaVersion: 1,
    cases,
    summary: {
      total: cases.length,
      detected: cases.filter((seed) => seed.detected).length,
      byCategory: Object.fromEntries(
        ["accessible-name", "language", "image-alt", "other"].map((category) => {
          const categoryCases = cases.filter((seed) => seed.category === category);
          return [category, {
            total: categoryCases.length,
            detected: categoryCases.filter((seed) => seed.detected).length,
          }];
        })
      ),
    },
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(output.summary, null, 2)}\n`);
  if (output.summary.detected !== output.summary.total) process.exitCode = 1;
}

main();
