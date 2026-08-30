import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import axe from "axe-core";

interface AxePageManifest {
  schemaVersion: 1;
  pages: Array<{
    id: string;
    repositoryId: string;
    sourceFile: string;
  }>;
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  targets: string[];
}

function option(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function injectAxe(source: string): string {
  const instrumentation = `
<script src="./axe.min.js"></script>
<script>
window.addEventListener("load", async () => {
  const result = await axe.run(document, { resultTypes: ["violations"] });
  const payload = {
    violations: result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.flatMap((node) => node.target.map(String))
    }))
  };
  const marker = document.createElement("script");
  marker.id = "zd20-axe-results";
  marker.type = "application/json";
  marker.textContent = JSON.stringify(payload).replaceAll("<", "\\u003c");
  document.body.append(marker);
});
</script>`;
  return /<\/body\s*>/i.test(source)
    ? source.replace(/<\/body\s*>/i, `${instrumentation}</body>`)
    : `${source}${instrumentation}`;
}

function runPage(
  chromePath: string,
  workspace: string,
  page: AxePageManifest["pages"][number]
) {
  const sourcePath = path.join(workspace, page.repositoryId, page.sourceFile);
  const source = fs.readFileSync(sourcePath, "utf8");
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-zd20-axe-"));
  try {
    const pagePath = path.join(temporaryDirectory, "page.html");
    fs.writeFileSync(pagePath, injectAxe(source), "utf8");
    fs.writeFileSync(path.join(temporaryDirectory, "axe.min.js"), axe.source, "utf8");
    const run = spawnSync(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--virtual-time-budget=5000",
        "--dump-dom",
        `file:///${pagePath.replace(/\\/g, "/")}`,
      ],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
    );
    if (run.status !== 0) {
      throw new Error(`Chrome failed for ${page.id}: ${run.stderr || run.stdout}`);
    }
    const match = /<script id="zd20-axe-results" type="application\/json">([\s\S]*?)<\/script>/.exec(
      run.stdout
    );
    if (!match) throw new Error(`axe-core result marker missing for ${page.id}`);
    const parsed = JSON.parse(match[1]) as { violations: AxeViolation[] };
    return {
      ...page,
      violations: parsed.violations,
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const packageRoot = process.cwd();
  const manifestPath = path.resolve(
    option(args, "--manifest") ??
      path.join(packageRoot, "tests", "accuracy-corpus", "axe-pages.json")
  );
  const workspace = path.resolve(option(args, "--workspace") ?? "");
  const chromePath = path.resolve(
    option(args, "--chrome") ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  );
  const outputPath = path.resolve(
    option(args, "--output") ??
      path.join(packageRoot, "tests", "accuracy-corpus", "tranche-01.axe.json")
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AxePageManifest;
  const pages = manifest.pages.map((page) => runPage(chromePath, workspace, page));
  const output = {
    schemaVersion: 1,
    axeVersion: axe.version,
    browser: "Google Chrome headless",
    pages,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
