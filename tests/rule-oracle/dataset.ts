import {
  applicable,
  defineRuleOracleMatrix,
  notApplicable,
  RuleOracleCase,
  RuleOracleSyntax,
} from "./schema";

function allSyntaxes() {
  return {
    html: applicable(),
    jsx: applicable(),
    tsx: applicable(),
    vue: applicable(),
  };
}

function htmlDocumentRule() {
  return {
    html: applicable(),
    jsx: applicable(),
    tsx: applicable(),
    vue: notApplicable(
      "A Vue SFC template does not own the rendered page-level document root."
    ),
  };
}

function componentFixtureSource(
  syntax: "jsx" | "tsx",
  markup: string,
  setup = ""
): string {
  const returnType = syntax === "tsx" ? ": JSX.Element" : "";
  return `${setup}${setup ? "\n" : ""}export default function Fixture()${returnType} {
  return (${markup});
}`;
}

function jsxRequireAltTextCases(
  syntax: "jsx" | "tsx"
): readonly RuleOracleCase[] {
  const label = syntax.toUpperCase();
  const typedString = syntax === "tsx" ? ": string" : "";
  const fixture = (markup: string, setup = "") =>
    componentFixtureSource(syntax, markup, setup);

  return [
    {
      id: `require-alt-text-${syntax}-missing-img`,
      title: `reports a ${label} image without alt text`,
      kind: "known-bad",
      rationale: `${label} images need an alt attribute, including when their source is dynamic.`,
      source: fixture(`<img src="/avatar.png" />`),
      expected: {
        count: 1,
        offsets: [{ needle: "<img" }],
        messageIncludes: "missing alt",
      },
    },
    {
      id: `require-alt-text-${syntax}-role-img-svg-missing-name`,
      title: `reports a ${label} SVG image without an accessible name`,
      kind: "known-bad",
      rationale: "An SVG exposed with role=img needs a programmatically determinable name.",
      source: fixture(`<svg role="img"><path d="M0 0h10v10z" /></svg>`),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: `require-alt-text-${syntax}-icon-button-missing-name`,
      title: `reports an unlabeled ${label} icon-only button`,
      kind: "known-bad",
      rationale: "The icon-only button lacks an accessible name, so the rule reports its unnamed SVG content.",
      source: fixture(
        `<button><svg><path d="M0 0h10v10z" /></svg></button>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: `require-alt-text-${syntax}-icon-button-unresolved-parent-labelledby`,
      title: `reports a ${label} icon-only button with an unresolved parent label`,
      kind: "known-bad",
      rationale: "The button remains unnamed when its aria-labelledby reference does not resolve to accessible text.",
      source: fixture(
        `<button aria-labelledby="missing-label"><svg><path /></svg></button>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: `require-alt-text-${syntax}-svg-unresolved-labelledby`,
      title: `reports a ${label} SVG with an unresolved label reference`,
      kind: "known-bad",
      rationale: "aria-labelledby does not name an SVG when it references no element with text.",
      source: fixture(
        `<><span id="chart-label"></span><svg role="img" aria-labelledby="missing-label"><path /></svg></>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: `require-alt-text-${syntax}-svg-empty-title`,
      title: `reports a ${label} SVG whose title is empty`,
      kind: "known-bad",
      rationale: "An empty title element does not provide an accessible name for an SVG image.",
      source: fixture(
        `<svg role="img"><title>   </title><path d="M0 0h10v10z" /></svg>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: `require-alt-text-${syntax}-static-alt`,
      title: `accepts a ${label} image with static alt text`,
      kind: "known-good",
      rationale: "A non-empty alt attribute supplies the image text alternative.",
      source: fixture(`<img src="/avatar.png" alt="Profile" />`),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-decorative-empty-alt`,
      title: `accepts a decorative ${label} image with empty alt text`,
      kind: "known-good",
      rationale: "An explicit empty alt attribute removes a decorative image from the accessibility tree.",
      source: fixture(`<img src="/divider.png" alt="" />`),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-dynamic-alt`,
      title: `accepts an intentional dynamic ${label} alt value`,
      kind: "ambiguous",
      rationale: "A source linter can verify the dynamic alt source but cannot prove its runtime value.",
      source: fixture(
        `<img src="/avatar.png" alt={description} />`,
        `const description${typedString} = "Profile";`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-svg-aria-label`,
      title: `accepts a ${label} SVG named by aria-label`,
      kind: "known-good",
      rationale: "A non-empty aria-label provides an accessible name for an SVG image.",
      source: fixture(
        `<svg role="img" aria-label="Sales chart"><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-svg-title`,
      title: `accepts a ${label} SVG named by title`,
      kind: "known-good",
      rationale: "A non-empty title element provides the SVG image's accessible name.",
      source: fixture(
        `<svg role="img"><title>Sales chart</title><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-svg-labelledby`,
      title: `accepts a ${label} SVG named by aria-labelledby`,
      kind: "known-good",
      rationale: "aria-labelledby supplies a name when it references an element with accessible text.",
      source: fixture(
        `<><span id="chart-label">Sales chart</span><svg role="img" aria-labelledby="chart-label"><path /></svg></>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-hidden-svg`,
      title: `does not report an assistive-technology-hidden ${label} SVG`,
      kind: "ambiguous",
      rationale: "aria-hidden removes the SVG from the accessibility tree, but source analysis cannot prove that hiding it is appropriate.",
      source: fixture(
        `<svg role="img" aria-hidden="true"><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-standalone-svg`,
      title: `does not report a standalone unlabeled ${label} SVG`,
      kind: "ambiguous",
      rationale: "This rule deliberately limits SVG checks to role=img and icon-only controls; no warning is not an accessibility guarantee.",
      source: fixture(`<svg><path d="M0 0h10v10z" /></svg>`),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-icon-button-parent-label`,
      title: `accepts a ${label} icon-only button named on the parent`,
      kind: "known-good",
      rationale: "An explicit aria-label names the button, so its child SVG does not need a redundant name.",
      source: fixture(
        `<button aria-label="Save"><svg><path /></svg></button>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-icon-button-parent-labelledby`,
      title: `accepts a ${label} icon-only button named by parent aria-labelledby`,
      kind: "known-good",
      rationale: "A resolved aria-labelledby reference names the button, so its child SVG does not need a redundant name.",
      source: fixture(
        `<><span id="save-label">Save</span><button aria-labelledby="save-label"><svg><path /></svg></button></>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-icon-button-visible-text`,
      title: `accepts a ${label} SVG button with visible text`,
      kind: "known-good",
      rationale: "The SVG is not the button's sole content when visible text names the control.",
      source: fixture(
        `<button><svg><path /></svg><span>Save</span></button>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: `require-alt-text-${syntax}-svg-dynamic-aria-label`,
      title: `accepts an intentional dynamic ${label} SVG label`,
      kind: "ambiguous",
      rationale: "A dynamic aria-label is an intentional name source whose runtime value needs separate validation.",
      source: fixture(
        `<svg role="img" aria-label={label}><path /></svg>`,
        `const label${typedString} = "Sales chart";`
      ),
      expected: { count: 0, offsets: [] },
    },
  ];
}

function vueFixtureSource(template: string, setup = ""): string {
  return `${setup ? `<script setup lang="ts">\n${setup}\n</script>\n` : ""}<template>\n  ${template}\n</template>`;
}

const requireAltTextCases: Record<RuleOracleSyntax, readonly RuleOracleCase[]> = {
  html: [
    {
      id: "require-alt-text-html-missing",
      title: "reports each HTML image without alt text",
      kind: "known-bad",
      rationale: "Every informative HTML image needs a text alternative.",
      source: `<main>
  <img src="hero.png">
  <img src="portrait.png">
</main>`,
      expected: {
        count: 2,
        offsets: [
          { needle: "<img", occurrence: 0 },
          { needle: "<img", occurrence: 1 },
        ],
        messageIncludes: "missing alt",
      },
    },
    {
      id: "require-alt-text-html-role-img-svg-missing-name",
      title: "reports an HTML SVG image without an accessible name",
      kind: "known-bad",
      rationale: "An SVG exposed with role=img needs a programmatically determinable name.",
      source: `<svg role="img"><path d="M0 0h10v10z"></path></svg>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-html-icon-link-missing-name",
      title: "reports an unlabeled HTML icon-only link",
      kind: "known-bad",
      rationale: "The icon-only link lacks an accessible name, so the rule reports its unnamed SVG content.",
      source: `<a href="/reports"><svg><path></path></svg></a>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-html-icon-link-unresolved-parent-labelledby",
      title: "reports an HTML icon-only link with an unresolved parent label",
      kind: "known-bad",
      rationale: "The link remains unnamed when its aria-labelledby reference does not resolve to accessible text.",
      source: `<a href="/reports" aria-labelledby="missing-label"><svg><path></path></svg></a>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-html-svg-unresolved-labelledby",
      title: "reports an HTML SVG with an unresolved label reference",
      kind: "known-bad",
      rationale: "aria-labelledby does not name an SVG when it references no element with text.",
      source: `<span id="chart-label"></span><svg role="img" aria-labelledby="missing-label"><path></path></svg>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-html-svg-empty-title",
      title: "reports an HTML SVG whose title is empty",
      kind: "known-bad",
      rationale: "An empty title element does not provide an accessible name for an SVG image.",
      source: `<svg role="img"><title>   </title><path></path></svg>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-html-static-alt",
      title: "accepts an HTML image with alt text",
      kind: "known-good",
      rationale: "A non-empty alt attribute supplies the image text alternative.",
      source: `<img src="hero.png" alt="Mountain at sunrise">`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-decorative-empty-alt",
      title: "accepts a decorative HTML image with empty alt text",
      kind: "known-good",
      rationale: "An explicit empty alt attribute removes a decorative image from the accessibility tree.",
      source: `<img src="divider.png" alt="">`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-picture-fallback-alt",
      title: "accepts an HTML picture whose fallback image has alt text",
      kind: "known-good",
      rationale: "The img fallback remains the text-alternative owner inside a picture element.",
      source: `<picture><source srcset="hero.avif" type="image/avif"><img src="hero.png" alt="Mountain at sunrise"></picture>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-svg-aria-label",
      title: "accepts an HTML SVG named by aria-label",
      kind: "known-good",
      rationale: "A non-empty aria-label provides an accessible name for an SVG image.",
      source: `<svg role="img" aria-label="Sales chart"><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-svg-title",
      title: "accepts an HTML SVG named by title",
      kind: "known-good",
      rationale: "A non-empty title element provides the SVG image's accessible name.",
      source: `<svg role="img"><title>Sales chart</title><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-svg-labelledby",
      title: "accepts an HTML SVG named by aria-labelledby",
      kind: "known-good",
      rationale: "aria-labelledby supplies a name when it references an element with accessible text.",
      source: `<span id="chart-label">Sales chart</span><svg role="img" aria-labelledby="chart-label"><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-hidden-svg",
      title: "does not report an assistive-technology-hidden HTML SVG",
      kind: "ambiguous",
      rationale: "aria-hidden removes the SVG from the accessibility tree, but source analysis cannot prove that hiding it is appropriate.",
      source: `<svg role="img" aria-hidden="true"><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-standalone-svg",
      title: "does not report a standalone unlabeled HTML SVG",
      kind: "ambiguous",
      rationale: "This rule deliberately limits SVG checks to role=img and icon-only controls; no warning is not an accessibility guarantee.",
      source: `<svg><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-icon-link-visible-text",
      title: "accepts an HTML SVG link with visible text",
      kind: "known-good",
      rationale: "The SVG is not the link's sole content when visible text names the link.",
      source: `<a href="/reports"><svg><path></path></svg><span>Reports</span></a>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-icon-link-parent-label",
      title: "accepts an HTML icon-only link named on the parent",
      kind: "known-good",
      rationale: "An explicit aria-label names the link, so its child SVG does not need a redundant name.",
      source: `<a href="/reports" aria-label="Reports"><svg><path></path></svg></a>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-icon-link-parent-labelledby",
      title: "accepts an HTML icon-only link named by parent aria-labelledby",
      kind: "known-good",
      rationale: "A resolved aria-labelledby reference names the link, so its child SVG does not need a redundant name.",
      source: `<span id="reports-label">Reports</span><a href="/reports" aria-labelledby="reports-label"><svg><path></path></svg></a>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-html-svg-multiple-labelledby",
      title: "accepts an HTML SVG named by multiple references",
      kind: "known-good",
      rationale: "aria-labelledby can combine text from multiple existing label elements.",
      source: `<span id="chart-title">Sales</span><span id="chart-detail">by quarter</span><svg role="img" aria-labelledby="chart-title chart-detail"><path></path></svg>`,
      expected: { count: 0, offsets: [] },
    },
  ],
  jsx: jsxRequireAltTextCases("jsx"),
  tsx: jsxRequireAltTextCases("tsx"),
  vue: [
    {
      id: "require-alt-text-vue-missing",
      title: "reports a Vue template image without alt text",
      kind: "known-bad",
      rationale: "A bound image source does not provide a Vue image text alternative.",
      source: `<script setup lang="ts">
const source: string = "/avatar.png";
</script>
<template>
  <img :src="source">
</template>`,
      expected: {
        count: 1,
        offsets: [{ needle: "<img" }],
        messageIncludes: "missing alt",
      },
    },
    {
      id: "require-alt-text-vue-role-img-svg-missing-name",
      title: "reports a Vue SVG image without an accessible name",
      kind: "known-bad",
      rationale: "An SVG exposed with role=img needs a programmatically determinable name.",
      source: vueFixtureSource(`<svg role="img"><path /></svg>`),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-vue-icon-button-missing-name",
      title: "reports an unlabeled Vue icon-only button",
      kind: "known-bad",
      rationale: "The icon-only button lacks an accessible name, so the rule reports its unnamed SVG content.",
      source: vueFixtureSource(`<button><svg><path /></svg></button>`),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-vue-icon-button-unresolved-parent-labelledby",
      title: "reports a Vue icon-only button with an unresolved parent label",
      kind: "known-bad",
      rationale: "The button remains unnamed when its aria-labelledby reference does not resolve to accessible text.",
      source: vueFixtureSource(
        `<button aria-labelledby="missing-label"><svg><path /></svg></button>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-vue-svg-unresolved-labelledby",
      title: "reports a Vue SVG with an unresolved label reference",
      kind: "known-bad",
      rationale: "aria-labelledby does not name an SVG when it references no element with text.",
      source: vueFixtureSource(
        `<span id="chart-label"></span><svg role="img" aria-labelledby="missing-label"><path /></svg>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-vue-svg-empty-title",
      title: "reports a Vue SVG whose title is empty",
      kind: "known-bad",
      rationale: "An empty title element does not provide an accessible name for an SVG image.",
      source: vueFixtureSource(
        `<svg role="img"><title>   </title><path /></svg>`
      ),
      expected: {
        count: 1,
        offsets: [{ needle: "<svg" }],
        messageIncludes: "missing accessible name",
      },
    },
    {
      id: "require-alt-text-vue-static-alt",
      title: "accepts a Vue template image with alt text",
      kind: "known-good",
      rationale: "A Vue template alt attribute supplies the image text alternative.",
      source: `<script setup lang="ts">
const source: string = "/avatar.png";
</script>
<template>
  <img :src="source" alt="Profile">
</template>`,
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-decorative-empty-alt",
      title: "accepts a decorative Vue image with empty alt text",
      kind: "known-good",
      rationale: "An explicit empty alt attribute removes a decorative image from the accessibility tree.",
      source: vueFixtureSource(`<img src="/divider.png" alt="">`),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-bound-alt",
      title: "accepts an intentional bound Vue alt value",
      kind: "ambiguous",
      rationale: "A source linter can verify the bound alt source but cannot prove its runtime value.",
      source: vueFixtureSource(
        `<img :src="source" :alt="description">`,
        `const source: string = "/avatar.png";\nconst description: string = "Profile";`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-svg-aria-label",
      title: "accepts a Vue SVG named by aria-label",
      kind: "known-good",
      rationale: "A non-empty aria-label provides an accessible name for an SVG image.",
      source: vueFixtureSource(
        `<svg role="img" aria-label="Sales chart"><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-svg-title",
      title: "accepts a Vue SVG named by title",
      kind: "known-good",
      rationale: "A non-empty title element provides the SVG image's accessible name.",
      source: vueFixtureSource(
        `<svg role="img"><title>Sales chart</title><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-svg-labelledby",
      title: "accepts a Vue SVG named by aria-labelledby",
      kind: "known-good",
      rationale: "aria-labelledby supplies a name when it references an element with accessible text.",
      source: vueFixtureSource(
        `<span id="chart-label">Sales chart</span><svg role="img" aria-labelledby="chart-label"><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-hidden-svg",
      title: "does not report an assistive-technology-hidden Vue SVG",
      kind: "ambiguous",
      rationale: "aria-hidden removes the SVG from the accessibility tree, but source analysis cannot prove that hiding it is appropriate.",
      source: vueFixtureSource(
        `<svg role="img" aria-hidden="true"><path /></svg>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-standalone-svg",
      title: "does not report a standalone unlabeled Vue SVG",
      kind: "ambiguous",
      rationale: "This rule deliberately limits SVG checks to role=img and icon-only controls; no warning is not an accessibility guarantee.",
      source: vueFixtureSource(`<svg><path /></svg>`),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-icon-button-parent-label",
      title: "accepts a Vue icon-only button named on the parent",
      kind: "known-good",
      rationale: "An explicit aria-label names the button, so its child SVG does not need a redundant name.",
      source: vueFixtureSource(
        `<button aria-label="Save"><svg><path /></svg></button>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-icon-button-parent-labelledby",
      title: "accepts a Vue icon-only button named by parent aria-labelledby",
      kind: "known-good",
      rationale: "A resolved aria-labelledby reference names the button, so its child SVG does not need a redundant name.",
      source: vueFixtureSource(
        `<span id="save-label">Save</span><button aria-labelledby="save-label"><svg><path /></svg></button>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-icon-button-visible-text",
      title: "accepts a Vue SVG button with visible text",
      kind: "known-good",
      rationale: "The SVG is not the button's sole content when visible text names the control.",
      source: vueFixtureSource(
        `<button><svg><path /></svg><span>Save</span></button>`
      ),
      expected: { count: 0, offsets: [] },
    },
    {
      id: "require-alt-text-vue-svg-bound-aria-label",
      title: "accepts an intentional bound Vue SVG label",
      kind: "ambiguous",
      rationale: "A bound aria-label is an intentional name source whose runtime value needs separate validation.",
      source: vueFixtureSource(
        `<svg role="img" :aria-label="label"><path /></svg>`,
        `const label: string = "Sales chart";`
      ),
      expected: { count: 0, offsets: [] },
    },
  ],
};

export const RULE_ORACLE_MATRIX = defineRuleOracleMatrix({
  requireSectionHeading: allSyntaxes(),
  enforceHeadingOrder: allSyntaxes(),
  singleH1: allSyntaxes(),
  requireAltText: {
    html: applicable(...requireAltTextCases.html),
    jsx: applicable(...requireAltTextCases.jsx),
    tsx: applicable(...requireAltTextCases.tsx),
    vue: applicable(...requireAltTextCases.vue),
  },
  requireLabelForFormControls: allSyntaxes(),
  enforceListNesting: allSyntaxes(),
  requireLinkText: allSyntaxes(),
  requireTableCaption: allSyntaxes(),
  preventEmptyInlineTags: allSyntaxes(),
  requireHrefOnAnchors: allSyntaxes(),
  requireButtonText: allSyntaxes(),
  requireIframeTitle: allSyntaxes(),
  requireHtmlLang: htmlDocumentRule(),
  requireImageInputAlt: allSyntaxes(),
  requireNavLinks: allSyntaxes(),
  uniqueIds: allSyntaxes(),
  noTabindexGreaterThanZero: allSyntaxes(),
  preventZemdomuPlaceholders: allSyntaxes(),
  requireDocumentTitle: htmlDocumentRule(),
  requireSingleMain: htmlDocumentRule(),
  ariaValidAttrValue: allSyntaxes(),
});
