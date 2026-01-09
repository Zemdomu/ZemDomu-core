"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_CODES = void 0;
exports.getRuleCode = getRuleCode;
exports.applyRuleCode = applyRuleCode;
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
};
exports.RULE_CODES = RULE_CODES;
function getRuleCode(rule) {
    return RULE_CODES[rule];
}
function applyRuleCode(result) {
    if (result.code)
        return result;
    const code = getRuleCode(result.rule);
    if (!code)
        return result;
    return { ...result, code };
}
