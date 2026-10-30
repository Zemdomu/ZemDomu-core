import { strict as assert } from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import fc from "fast-check";
import { lint, parseHtml, ProjectLinter } from "../src";
import type { LinterOptions, LintResult, Node } from "../src";

const MAX_SOURCE_LENGTH = 2_048;

function integerSetting(name: string, fallback: number, min: number, max: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^-?(0|[1-9]\d*)$/.test(value)) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

const settings = {
  numRuns: integerSetting("ZEMDOMU_FUZZ_RUNS", 250, 1, 10_000),
  seed: integerSetting("ZEMDOMU_FUZZ_SEED", 20_261_030, -2_147_483_648, 2_147_483_647),
  ...(process.env.ZEMDOMU_FUZZ_PATH === undefined ? {} : { path: process.env.ZEMDOMU_FUZZ_PATH }),
};

// Include lone surrogates and control characters, not just valid Unicode scalar values.
const unicodeText = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 64 })
  .map(units => String.fromCharCode(...units));
const fragment = fc.array(fc.oneof(unicodeText, fc.constantFrom(
  "<", ">", "<!--", "-->", "<img>", "<a href=", "<div id='x'>", "</div>",
  "<input id='x'>", "<label for='x'>", "<script>", "</template>", "{", "}",
  "\"", "'", "\n", "\r\n", "\u2028", "\u2029", "😀", "\ud800", "\0",
)), { maxLength: 32 }).map(parts => parts.join("").slice(0, 1_792));
const visibleText = fc.array(fc.constantFrom("a", "é", "界", "😀", "e\u0301", " ", "\t", "\u2028", "\u2029"), { maxLength: 32 })
  .map(parts => parts.join(""));
const identifier = fc.array(fc.constantFrom("a", "z", "0", "9", "_", "-"), { minLength: 1, maxLength: 24 })
  .map(parts => parts.join(""));

type Format = "html" | "jsx" | "tsx" | "vue";
let fixtureRoot: string;

async function diagnose(format: Format, body: string, options: LinterOptions = {}) {
  const source = format === "vue" ? `<template>${body}</template>`
    : format === "html" ? body
      : `export default function View() { return (<>${body}</>); }`;
  assert.ok(source.length <= MAX_SOURCE_LENGTH, "Generated sources must remain bounded");
  const filePath = path.join(fixtureRoot, `Input.${format}`);
  // ProjectLinter also builds Vue component facts from disk, so exercise the
  // real file-backed API rather than accepting diagnostics after an ENOENT.
  if (format === "vue") fs.writeFileSync(filePath, source);
  const results = format === "vue"
    ? (await new ProjectLinter(options).lintFile(filePath, source)).get(filePath) ?? []
    : lint(source, { ...options, filePath, forceHtml: format === "html" });
  return { source, results };
}

function assertDiagnosticShape(results: LintResult[], source: string) {
  for (const result of results) {
    assert.equal(typeof result.rule, "string");
    assert.ok(result.rule.length > 0);
    assert.equal(typeof result.message, "string");
    assert.ok(Number.isInteger(result.line) && result.line >= 0);
    assert.ok(Number.isInteger(result.column) && result.column >= 0);
    if (result.offset !== undefined) {
      assert.ok(Number.isInteger(result.offset) && result.offset >= 0 && result.offset <= source.length);
    }
  }
}

describe("Core property fuzzing", function () {
  this.timeout(30_000);
  before(() => { fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zemdomu-property-input-")); });
  after(() => { fs.rmSync(fixtureRoot, { recursive: true, force: true }); });

  it("handles malformed Unicode HTML, JSX, TSX and Vue deterministically", async () => {
    await fc.assert(fc.asyncProperty(fragment, async body => {
      for (const format of ["html", "jsx", "tsx", "vue"] as const) {
        const first = await diagnose(format, body);
        const second = await diagnose(format, body);
        assertDiagnosticShape(first.results, first.source);
        assert.deepEqual(second.results, first.results, `${format} diagnostics changed for identical input`);
      }
    }), { ...settings, examples: [["<"], ["<!--"], ["<img><div></span>"], ["😀\ud800\0\r\n"]] });
  });

  it("keeps malformed HTML trees finite and source positions bounded", () => {
    fc.assert(fc.property(fragment, source => {
      const root = parseHtml(source);
      assert.deepEqual(parseHtml(source), root, "Parsing identical input must produce the same tree");
      const pending: Node[] = [root];
      const seen = new Set<Node>();
      while (pending.length) {
        const node = pending.pop()!;
        assert.ok(!seen.has(node), "A parse tree must not contain cycles or shared children");
        seen.add(node);
        assert.ok(Number.isInteger(node.startIndex) && node.startIndex >= 0 && node.startIndex <= source.length);
        if (node !== root) assert.ok(node.startIndex < source.length);
        if (node.type === "element") {
          if (node !== root) assert.equal(source[node.startIndex], "<");
          let previous = node.startIndex;
          for (const child of node.children) {
            assert.ok(child.startIndex >= previous, "Children must retain source order");
            previous = child.startIndex;
            pending.push(child);
          }
        }
      }
      assert.ok(seen.size <= source.length + 1, "Nodes must be backed by input characters");
    }), settings);
  });

  it("anchors generated HTML and Vue diagnostics through Unicode and LF or CRLF prefixes", async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({ text: visibleText, spaces: fc.integer({ min: 0, max: 8 }), eol: fc.constantFrom("\n", "\r\n") }), { minLength: 1, maxLength: 8 }),
      async rows => {
        const body = `<main>${rows.map(row => `<!--${row.text}-->${row.eol}${" ".repeat(row.spaces)}<img>`).join("")}</main>`;
        for (const format of ["html", "vue"] as const) {
          const { source, results } = await diagnose(format, body);
          const images = [...source.matchAll(/<img>/g)].map(match => match.index!);
          const findings = results.filter(result => result.rule === "requireAltText");
          assert.deepEqual(findings.map(result => result.offset), images, "Every generated missing-alt image must retain its exact source offset");
          for (const finding of findings) {
            const precedingLines = source.slice(0, finding.offset).split("\n");
            assert.deepEqual({ line: finding.line, column: finding.column }, {
              line: precedingLines.length - 1, column: precedingLines[precedingLines.length - 1].length,
            });
          }
        }
      },
    ), settings);
  });

  it("preserves matching labels under ID renaming and isolates disabled label checks", async () => {
    await fc.assert(fc.asyncProperty(identifier, visibleText, fc.constantFrom("\n", "\r\n"), async (id, text, eol) => {
      for (const format of ["html", "tsx"] as const) {
        const markup = (controlId: string, labelId: string) => `<main><label ${format === "tsx" ? "htmlFor" : "for"}="${labelId}">Field ${text}</label>${eol}<input id="${controlId}" type="text"${format === "tsx" ? " /" : ""}><img${format === "tsx" ? " /" : ""}></main>`;
        const matching = (await diagnose(format, markup(id, id))).results;
        const renamed = (await diagnose(format, markup(`renamed-${id}`, `renamed-${id}`))).results;
        assert.equal(matching.filter(result => result.rule === "requireLabelForFormControls").length, 0);
        assert.equal(renamed.filter(result => result.rule === "requireLabelForFormControls").length, 0);
        const brokenMarkup = markup(id, `${id}-different`);
        const broken = (await diagnose(format, brokenMarkup)).results;
        assert.equal(broken.filter(result => result.rule === "requireLabelForFormControls").length, 1);
        assert.equal(broken.filter(result => result.rule === "requireAltText").length, 1, "Keep an independent violation as a non-vacuous witness");
        const disabled = (await diagnose(format, brokenMarkup, { rules: { requireLabelForFormControls: "off" } })).results;
        assert.deepEqual(disabled, broken.filter(result => result.rule !== "requireLabelForFormControls"));
      }
    }), settings);
  });
});
