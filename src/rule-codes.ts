const RULE_CODES = {
  requireSectionHeading: "ZMD001",
  enforceHeadingOrder: "ZMD002",
  singleH1: "ZMD003",
  requireAltText: "ZMD004",
  requireLabelForFormControls: "ZMD005",
  enforceListNesting: "ZMD006",
  requireLinkText: "ZMD007",
  requireTableCaption: "ZMD008",
  preventEmptyInlineTags: "ZMD009",
  requireHrefOnAnchors: "ZMD010",
  requireButtonText: "ZMD011",
  requireIframeTitle: "ZMD012",
  requireHtmlLang: "ZMD013",
  requireImageInputAlt: "ZMD014",
  requireNavLinks: "ZMD015",
  uniqueIds: "ZMD016",
  noTabindexGreaterThanZero: "ZMD017",
  preventZemdomuPlaceholders: "ZMD018",
  requireDocumentTitle: "ZMD019",
  requireSingleMain: "ZMD020",
  ariaValidAttrValue: "ZMD021",
  requirePageH1: "ZMD022",
} as const;

export type RuleClassification = "conformance" | "advisory" | "house-style";

/** Rules that require SemanticPageDocument input and are not file-corpus rules. */
export const PAGE_ONLY_RULES = ["requirePageH1"] as const;

export const RULE_CLASSIFICATIONS: Partial<
  Record<keyof typeof RULE_CODES, RuleClassification>
> = {
  singleH1: "house-style",
  requireTableCaption: "advisory",
  requireSectionHeading: "advisory",
  requireNavLinks: "house-style",
  requirePageH1: "advisory",
};

export function getRuleCode(rule: string): string | undefined {
  return RULE_CODES[rule as keyof typeof RULE_CODES];
}

export function applyRuleCode<T extends { rule: string; code?: string }>(
  result: T
): T {
  if (result.code) return result;
  const code = getRuleCode(result.rule);
  if (!code) return result;
  return { ...result, code };
}

export { RULE_CODES };
