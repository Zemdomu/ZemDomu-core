import fs from "fs";
import path from "path";
import { runAccuracyCorpusCandidateScan } from "./runner";

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const packageRoot = process.cwd();
  const manifestPath = path.resolve(
    option(args, "--manifest") ??
      path.join(packageRoot, "tests", "accuracy-corpus", "tranche-01.manifest.json")
  );
  const outputPath = path.resolve(
    option(args, "--output") ??
      path.join(packageRoot, "tests", "accuracy-corpus", "tranche-01.candidates.json")
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
  ) as { version: string };
  const repositoryIds = args
    .filter((arg) => arg.startsWith("--repository="))
    .map((arg) => arg.slice("--repository=".length));

  const bundle = await runAccuracyCorpusCandidateScan({
    manifestPath,
    outputPath,
    packageVersion: packageJson.version,
    repositoryIds,
    keepWorkspace: args.includes("--keep-workspace"),
  });
  process.stdout.write(
    `${JSON.stringify({ output: outputPath, summary: bundle.summary }, null, 2)}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
