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
} as const;

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
