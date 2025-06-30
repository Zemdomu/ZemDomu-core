export interface SarifLog {
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri?: string;
        rules: Array<{ id: string; name: string; helpUri: string }>;
      };
    };
    results: Array<{
      ruleId: string;
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: { startLine: number; startColumn: number };
        };
      }>;
      level: string;
    }>;
  }>;
}

import { LintResult } from './linter';

const RULE_DOCS_BASE =
  'https://github.com/ZemDomu/docs/blob/main/rules/';

export function resultsToSarif(
  results: Map<string, LintResult[]>
): SarifLog {
  const sarifResults: SarifLog['runs'][0]['results'] = [];
  const ruleMeta = new Map<string, { helpUri: string }>();

  for (const [file, issues] of results.entries()) {
    for (const issue of issues) {
      const helpUri = `${RULE_DOCS_BASE}${issue.rule}.md`;
      sarifResults.push({
        ruleId: issue.rule,
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
      if (!ruleMeta.has(issue.rule)) {
        ruleMeta.set(issue.rule, { helpUri });
      }
    }
  }

  const rules = Array.from(ruleMeta.entries()).map(([id, meta]) => ({
    id,
    name: id,
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

export { RULE_DOCS_BASE };
