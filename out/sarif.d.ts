export interface SarifLog {
    version: string;
    runs: Array<{
        tool: {
            driver: {
                name: string;
                informationUri?: string;
                rules: Array<{
                    id: string;
                    name: string;
                    helpUri: string;
                }>;
            };
        };
        results: Array<{
            ruleId: string;
            message: {
                text: string;
            };
            locations: Array<{
                physicalLocation: {
                    artifactLocation: {
                        uri: string;
                    };
                    region: {
                        startLine: number;
                        startColumn: number;
                    };
                };
            }>;
            level: string;
        }>;
    }>;
}
import { LintResult } from './linter';
declare const RULE_DOCS_BASE = "https://github.com/ZemDomu/docs/blob/main/rules/";
export declare function resultsToSarif(results: Map<string, LintResult[]>): SarifLog;
export { RULE_DOCS_BASE };
