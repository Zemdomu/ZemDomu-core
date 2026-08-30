import type { RecallCategory } from "./schema";
import type { RuleOracleName, RuleOracleSyntax } from "../rule-oracle/schema";

export interface AccuracySeedDefinition {
  id: string;
  repositoryId: string;
  syntax: RuleOracleSyntax;
  category: RecallCategory;
  expectedRule: RuleOracleName;
  virtualFile: string;
  sourceText: string;
  forceHtml?: boolean;
  rationale: string;
}

const accessibleNameSeeds: AccuracySeedDefinition[] = [
  ["button-html", "50projects50days", "html", "requireButtonText", `<button><svg></svg></button>`],
  ["link-html", "mdn-dom-examples", "html", "requireLinkText", `<a href="/docs"><svg></svg></a>`],
  ["iframe-html", "googlechrome-samples", "html", "requireIframeTitle", `<iframe src="frame.html"></iframe>`],
  ["label-html", "50projects50days", "html", "requireLabelForFormControls", `<input type="text">`],
  ["button-tsx", "vercel-commerce", "tsx", "requireButtonText", `export default () => <button><svg /></button>;`],
  ["link-tsx", "bulletproof-react", "tsx", "requireLinkText", `export default () => <a href="/docs"><svg /></a>;`],
  ["iframe-tsx", "nextjs-postgres-auth-starter", "tsx", "requireIframeTitle", `export default () => <iframe src="/frame" />;`],
  ["label-tsx", "shadcn-taxonomy", "tsx", "requireLabelForFormControls", `export default () => <input type="text" />;`],
  ["button-vue", "vuejs-docs", "vue", "requireButtonText", `<template><button><svg></svg></button></template>`],
  ["link-vue", "nuxt-movies", "vue", "requireLinkText", `<template><a href="/docs"><svg></svg></a></template>`],
].map(([id, repositoryId, syntax, expectedRule, sourceText]) => ({
  id: `seed-accessible-name-${id}`,
  repositoryId,
  syntax: syntax as RuleOracleSyntax,
  category: "accessible-name" as const,
  expectedRule: expectedRule as RuleOracleName,
  virtualFile: `seeds/accessible-name-${id}.${syntax === "html" ? "html" : syntax}`,
  sourceText,
  forceHtml: syntax === "html" || syntax === "vue",
  rationale: "Reviewed mutation removes the control or link's accessible name.",
}));

const languageSeeds: AccuracySeedDefinition[] = Array.from({ length: 10 }, (_, index) => ({
  id: `seed-language-${String(index + 1).padStart(2, "0")}`,
  repositoryId: ["50projects50days", "mdn-dom-examples", "googlechrome-samples"][index % 3],
  syntax: "html",
  category: "language",
  expectedRule: "requireHtmlLang",
  virtualFile: `seeds/language-${String(index + 1).padStart(2, "0")}.html`,
  sourceText: `<!doctype html><html><head><title>Language seed ${index + 1}</title></head><body><main>Content</main></body></html>`,
  forceHtml: true,
  rationale: "Reviewed mutation removes the document language from a complete HTML document.",
}));

const imageAltSources: Array<[string, string, RuleOracleSyntax, RuleOracleName, string, boolean?]> = [
  ["html-img-1", "mdn-dom-examples", "html", "requireAltText", `<img src="one.png">`, true],
  ["html-img-2", "googlechrome-samples", "html", "requireAltText", `<picture><img src="two.png"></picture>`, true],
  ["html-img-3", "50projects50days", "html", "requireAltText", `<figure><img src="three.png"></figure>`, true],
  ["html-img-4", "mdn-dom-examples", "html", "requireAltText", `<a href="/"><img src="four.png"></a>`, true],
  ["tsx-img-1", "vercel-commerce", "tsx", "requireAltText", `export default () => <img src="one.png" />;`],
  ["tsx-img-2", "bulletproof-react", "tsx", "requireAltText", `export default () => <picture><img src="two.png" /></picture>;`],
  ["tsx-img-3", "shadcn-taxonomy", "tsx", "requireAltText", `export default () => <a href="/"><img src="three.png" /></a>;`],
  ["vue-img-1", "vuejs-docs", "vue", "requireAltText", `<template><img src="one.png"></template>`, true],
  ["vue-img-2", "nuxt-movies", "vue", "requireAltText", `<template><picture><img src="two.png"></picture></template>`, true],
  ["image-input", "antfu-vitesse", "vue", "requireImageInputAlt", `<template><input type="image" src="submit.png"></template>`, true],
];

const imageAltSeeds: AccuracySeedDefinition[] = imageAltSources.map(
  ([id, repositoryId, syntax, expectedRule, sourceText, forceHtml]) => ({
    id: `seed-image-alt-${id}`,
    repositoryId,
    syntax,
    category: "image-alt",
    expectedRule,
    virtualFile: `seeds/image-alt-${id}.${syntax === "html" ? "html" : syntax}`,
    sourceText,
    forceHtml,
    rationale: "Reviewed mutation removes the required text alternative.",
  })
);

const targetedSources: Array<[string, RuleOracleName, RuleOracleSyntax, string, boolean?]> = [
  ["aria-value", "ariaValidAttrValue", "html", `<div aria-hidden="maybe"></div>`, true],
  ["list-nesting", "enforceListNesting", "html", `<ul><div><li>Item</li></div></ul>`, true],
  ["empty-inline", "preventEmptyInlineTags", "html", `<p><em></em></p>`, true],
  ["image-input", "requireImageInputAlt", "tsx", `export default () => <input type="image" />;`],
  ["positive-tabindex", "noTabindexGreaterThanZero", "html", `<button tabindex="2">Save</button>`, true],
  ["placeholder", "preventZemdomuPlaceholders", "html", `<div aria-label="TODO-ZMD"></div>`, true],
  ["duplicate-id", "uniqueIds", "html", `<div id="duplicate"></div><span id="duplicate"></span>`, true],
];

const targetedSeeds: AccuracySeedDefinition[] = targetedSources.map(
  ([id, expectedRule, syntax, sourceText, forceHtml]) => ({
    id: `seed-other-${id}`,
    repositoryId: "zemdomu-targeted-fixtures",
    syntax,
    category: "other",
    expectedRule,
    virtualFile: `seeds/other-${id}.${syntax === "html" ? "html" : syntax}`,
    sourceText,
    forceHtml,
    rationale: `Reviewed targeted mutation violates ${expectedRule}.`,
  })
);

export const ACCURACY_SEED_CASES: readonly AccuracySeedDefinition[] = [
  ...accessibleNameSeeds,
  ...languageSeeds,
  ...imageAltSeeds,
  ...targetedSeeds,
];
