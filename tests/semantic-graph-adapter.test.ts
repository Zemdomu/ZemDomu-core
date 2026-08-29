import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ProjectLinter,
  SemanticGraph,
  validateSemanticGraph,
} from "../src";

function fixtureRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, content: string): string {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function allUnknownReasons(graph: SemanticGraph): Set<string> {
  if (graph.boundary.completeness.state === "complete") return new Set();
  return new Set(
    graph.boundary.completeness.unknowns.map((entry) => entry.reason)
  );
}

describe("semantic graph adapter", () => {
  it("emits deterministic React imports, composition, source facts, and conservative unknowns", async () => {
    const root = fixtureRoot("zemdomu-graph-react-");
    write(
      root,
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@ui/*": ["src/ui/*"] },
        },
      })
    );
    const page = write(
      root,
      "src/Page.tsx",
      [
        "import Card from '@ui/Card';",
        "import Missing from './Missing';",
        "export default function Page({ show }: { show: boolean }) {",
        "  return <main id=\"page\"><h1>Page</h1>{show ? <Card /> : <Missing />}<RuntimeWidget /></main>;",
        "}",
      ].join("\n")
    );
    write(
      root,
      "src/ui/Card.tsx",
      [
        "import Page from '../Page';",
        "export default function Card() {",
        "  return <section><h2>Card</h2><Page /></section>;",
        "}",
      ].join("\n")
    );

    const linter = new ProjectLinter({ rootDir: root, crossComponentDepth: 4 });
    const first = await linter.buildSemanticGraph([page]);
    const second = await linter.buildSemanticGraph([page]);

    assert.deepStrictEqual(second, first);
    assert.deepStrictEqual(validateSemanticGraph(first), []);
    assert.strictEqual(first.files.length, 2);
    assert.strictEqual(first.components.length, 2);
    assert.ok(
      first.imports.some(
        (edge) => edge.specifier === "@ui/Card" && edge.target.state === "resolved"
      )
    );
    assert.ok(
      first.imports.some(
        (edge) => edge.specifier === "./Missing" && edge.target.state === "unknown"
      )
    );
    assert.ok(
      first.composition.some(
        (edge) =>
          edge.relation === "uses-component" &&
          edge.condition.kind === "branch" &&
          edge.condition.mutuallyExclusive
      )
    );
    assert.ok(
      first.composition.some(
        (edge) =>
          edge.traversal.state === "boundary" &&
          edge.traversal.reason === "cycle"
      )
    );
    assert.ok(
      first.composition.some(
        (edge) =>
          edge.to.state === "unknown" &&
          edge.to.reason === "runtime-composition"
      )
    );
    assert.ok(
      first.renderNodes.some(
        (node) =>
          node.kind === "native-element" &&
          node.tagName === "h1" &&
          node.provenance.range?.start.line === 3
      )
    );
    assert.ok(allUnknownReasons(first).has("unresolved-import"));
    assert.ok(allUnknownReasons(first).has("runtime-composition"));
    assert.ok(allUnknownReasons(first).has("cycle"));
  });

  it("normalizes Vue imports, branches, landmarks, and document ids", async () => {
    const root = fixtureRoot("zemdomu-graph-vue-");
    const app = write(
      root,
      "src/App.vue",
      [
        "<script setup lang=\"ts\">",
        "import Navigation from './Navigation.vue'",
        "const show = true",
        "</script>",
        "<template>",
        "  <main><Navigation v-if=\"show\" /></main>",
        "</template>",
      ].join("\n")
    );
    write(
      root,
      "src/Navigation.vue",
      [
        "<template>",
        "  <nav id=\"primary\"><a href=\"/\">Home</a></nav>",
        "</template>",
      ].join("\n")
    );

    const graph = await new ProjectLinter({ rootDir: root }).buildSemanticGraph([
      app,
    ]);

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    assert.strictEqual(graph.files.length, 2);
    assert.ok(graph.files.every((file) => file.framework === "vue"));
    assert.ok(
      graph.imports.some(
        (edge) =>
          edge.localName === "Navigation" && edge.target.state === "resolved"
      )
    );
    assert.ok(
      graph.composition.some(
        (edge) => edge.condition.kind === "branch" && edge.condition.branchId === "if"
      )
    );
    assert.ok(
      graph.renderNodes.some(
        (node) =>
          node.kind === "native-element" &&
          node.tagName === "nav" &&
          node.semantics.some((fact) => fact.kind === "landmark") &&
          node.semantics.some((fact) => fact.kind === "document-id")
      )
    );
  });

  it("represents a configured traversal depth as an explicit boundary", async () => {
    const root = fixtureRoot("zemdomu-graph-depth-");
    const entry = write(
      root,
      "A.tsx",
      "import B from './B'; export default function A(){ return <B />; }"
    );
    write(
      root,
      "B.tsx",
      "import C from './C'; export default function B(){ return <C />; }"
    );
    write(root, "C.tsx", "export default function C(){ return <h1>C</h1>; }");

    const graph = await new ProjectLinter({
      rootDir: root,
      crossComponentDepth: 1,
    }).buildSemanticGraph([entry]);

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    assert.strictEqual(graph.components.length, 2);
    assert.ok(
      graph.composition.some(
        (edge) =>
          edge.traversal.state === "boundary" &&
          edge.traversal.reason === "depth-limit" &&
          edge.traversal.depth === 2 &&
          edge.traversal.maxDepth === 1
      )
    );
    assert.ok(allUnknownReasons(graph).has("depth-limit"));
  });

  it("infers component output through certain native roots with source evidence", async () => {
    const root = fixtureRoot("zemdomu-graph-inference-");
    const page = write(
      root,
      "Page.tsx",
      [
        "import Header from './Header';",
        "import Forwarder from './Forwarder';",
        "export default function Page(){ return <main><Header /><Forwarder /></main>; }",
      ].join("\n")
    );
    write(
      root,
      "Header.tsx",
      [
        "import Navigation from './Navigation';",
        "import Button from './Button';",
        "export default function Header(){ return <header><Navigation /><Button /></header>; }",
      ].join("\n")
    );
    write(
      root,
      "Navigation.tsx",
      "export default function Navigation(){ return <nav>Primary</nav>; }"
    );
    write(
      root,
      "Button.tsx",
      "export default function Button(){ return <button type=\"button\">Save</button>; }"
    );
    write(
      root,
      "Forwarder.tsx",
      "import Navigation from './Navigation'; export default function Forwarder(){ return <Navigation />; }"
    );

    const graph = await new ProjectLinter({ rootDir: root }).buildSemanticGraph([
      page,
    ]);
    const byName = new Map(graph.components.map((component) => [component.name, component]));
    const expected = new Map([
      ["Page", "main"],
      ["Header", "header"],
      ["Navigation", "nav"],
      ["Button", "button"],
      ["Forwarder", "nav"],
    ]);

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    for (const [name, tagName] of expected) {
      const output = byName.get(name)?.semanticOutput;
      assert.ok(output && output.state === "known", `${name} should have known output`);
      assert.strictEqual(output.tagName, tagName);
      assert.strictEqual(output.confidence, "inferred");
      assert.strictEqual(output.provenance.kind, "inferred");
      assert.strictEqual(output.provenance.confidence, "inferred");
      assert.strictEqual(output.evidence.provenance.kind, "source");
      assert.strictEqual(output.evidence.provenance.confidence, "certain");
    }

    const forwarder = byName.get("Forwarder")!;
    const navigation = byName.get("Navigation")!;
    assert.ok(forwarder.semanticOutput.state === "known");
    assert.deepStrictEqual(forwarder.semanticOutput.evidence.componentPath, [
      forwarder.id,
      navigation.id,
    ]);
  });

  it("keeps conditional, fragment, children, and runtime wrapper output unknown", async () => {
    const root = fixtureRoot("zemdomu-graph-ambiguous-");
    const entry = write(
      root,
      "Entry.tsx",
      [
        "import Conditional from './Conditional';",
        "import Optional from './Optional';",
        "import Fragment from './Fragment';",
        "import Children from './Children';",
        "export default function Entry(){ return <main><Conditional mode /><Optional show /><Fragment /><Children>Text</Children></main>; }",
      ].join("\n")
    );
    write(
      root,
      "Conditional.tsx",
      "export default function Conditional({ mode }: { mode: boolean }){ return mode ? <header /> : <section />; }"
    );
    write(
      root,
      "Optional.tsx",
      "export default function Optional({ show }: { show: boolean }){ return show && <header />; }"
    );
    write(
      root,
      "Fragment.tsx",
      "export default function Fragment(){ return <><header /><main /></>; }"
    );
    write(
      root,
      "Children.tsx",
      "export default function Children({ children }: { children: unknown }){ return children; }"
    );

    const graph = await new ProjectLinter({ rootDir: root }).buildSemanticGraph([
      entry,
    ]);
    const byName = new Map(graph.components.map((component) => [component.name, component]));

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    const conditional = byName.get("Conditional")?.semanticOutput;
    const optional = byName.get("Optional")?.semanticOutput;
    const fragment = byName.get("Fragment")?.semanticOutput;
    const children = byName.get("Children")?.semanticOutput;
    assert.ok(conditional && conditional.state === "unknown");
    assert.ok(optional && optional.state === "unknown");
    assert.ok(fragment && fragment.state === "unknown");
    assert.ok(children && children.state === "unknown");
    assert.strictEqual(conditional.reason, "conditional-render");
    assert.strictEqual(optional.reason, "conditional-render");
    assert.strictEqual(fragment.reason, "fragment-boundary");
    assert.strictEqual(children.reason, "slot-or-children");
  });

  it("infers a single unconditional Vue native root but not conditional roots", async () => {
    const root = fixtureRoot("zemdomu-graph-vue-inference-");
    const app = write(
      root,
      "App.vue",
      [
        "<script setup>",
        "import Navigation from './Navigation.vue'",
        "import Conditional from './Conditional.vue'",
        "</script>",
        "<template><main><Navigation /><Conditional /></main></template>",
      ].join("\n")
    );
    write(root, "Navigation.vue", "<template><nav>Primary</nav></template>");
    write(
      root,
      "Conditional.vue",
      "<template><header v-if=\"show\" /><main v-else /></template>"
    );

    const graph = await new ProjectLinter({ rootDir: root }).buildSemanticGraph([
      app,
    ]);
    const byName = new Map(graph.components.map((component) => [component.name, component]));

    assert.deepStrictEqual(validateSemanticGraph(graph), []);
    const navigation = byName.get("Navigation")?.semanticOutput;
    assert.ok(navigation && navigation.state === "known");
    assert.strictEqual(navigation.tagName, "nav");
    const conditional = byName.get("Conditional")?.semanticOutput;
    assert.ok(conditional && conditional.state === "unknown");
    assert.strictEqual(conditional.reason, "conditional-render");
  });
});
