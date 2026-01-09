"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_DOCS_BASE = void 0;
exports.resultsToSarif = resultsToSarif;
const rule_codes_1 = require("./rule-codes");
const RULE_DOCS_BASE = 'https://github.com/ZemDomu/docs/blob/main/rules/';
exports.RULE_DOCS_BASE = RULE_DOCS_BASE;
function resultsToSarif(results) {
    var _a;
    const sarifResults = [];
    const ruleMeta = new Map();
    for (const [file, issues] of results.entries()) {
        for (const issue of issues) {
            const code = (_a = issue.code) !== null && _a !== void 0 ? _a : (0, rule_codes_1.getRuleCode)(issue.rule);
            const ruleId = code !== null && code !== void 0 ? code : issue.rule;
            const helpUri = `${RULE_DOCS_BASE}${issue.rule}.md`;
            sarifResults.push({
                ruleId,
                message: { text: issue.message },
                level: issue.severity === 'error' ? 'error' : 'warning',
                locations: [
                    {
                        physicalLocation: {
                            artifactLocation: { uri: file },
                            region: {
                                startLine: issue.line + 1,
                                startColumn: issue.column + 1,
                            },
                        },
                    },
                ],
            });
            if (!ruleMeta.has(ruleId)) {
                ruleMeta.set(ruleId, { helpUri, name: issue.rule });
            }
        }
    }
    const rules = Array.from(ruleMeta.entries()).map(([id, meta]) => ({
        id,
        name: meta.name,
        helpUri: meta.helpUri,
    }));
    return {
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'ZemDomu',
                        informationUri: 'https://github.com/ZemDomu',
                        rules,
                    },
                },
                results: sarifResults,
            },
        ],
    };
}
