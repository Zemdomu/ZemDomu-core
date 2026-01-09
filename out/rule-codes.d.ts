declare const RULE_CODES: {
    readonly requireSectionHeading: "ZMD001";
    readonly enforceHeadingOrder: "ZMD002";
    readonly singleH1: "ZMD003";
    readonly requireAltText: "ZMD004";
    readonly requireLabelForFormControls: "ZMD005";
    readonly enforceListNesting: "ZMD006";
    readonly requireLinkText: "ZMD007";
    readonly requireTableCaption: "ZMD008";
    readonly preventEmptyInlineTags: "ZMD009";
    readonly requireHrefOnAnchors: "ZMD010";
    readonly requireButtonText: "ZMD011";
    readonly requireIframeTitle: "ZMD012";
    readonly requireHtmlLang: "ZMD013";
    readonly requireImageInputAlt: "ZMD014";
    readonly requireNavLinks: "ZMD015";
    readonly uniqueIds: "ZMD016";
    readonly noTabindexGreaterThanZero: "ZMD017";
};
export declare function getRuleCode(rule: string): string | undefined;
export declare function applyRuleCode<T extends {
    rule: string;
    code?: string;
}>(result: T): T;
export { RULE_CODES };
