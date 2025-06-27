import { parse as parseHtmlDom, ElementNode, Node } from "./simpleHtmlParser";
import { parse as parseJs } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { PerformanceRecorder } from "./performance-diagnostics";
import requireAltText from "./rules/requireAltText";
import requireSectionHeading from "./rules/requireSectionHeading";
import enforceHeadingOrder from "./rules/enforceHeadingOrder";
import singleH1 from "./rules/singleH1";
import requireLabelForFormControls from "./rules/requireLabelForFormControls";
import enforceListNesting from "./rules/enforceListNesting";
import requireLinkText from "./rules/requireLinkText";
import requireTableCaption from "./rules/requireTableCaption";
import preventEmptyInlineTags from "./rules/preventEmptyInlineTags";
import requireHrefOnAnchors from "./rules/requireHrefOnAnchors";
import requireButtonText from "./rules/requireButtonText";
import requireIframeTitle from "./rules/requireIframeTitle";
import requireHtmlLang from "./rules/requireHtmlLang";
import requireImageInputAlt from "./rules/requireImageInputAlt";
import requireNavLinks from "./rules/requireNavLinks";
import uniqueIds from "./rules/uniqueIds";
import noTabindexGreaterThanZero from "./rules/noTabindexGreaterThanZero";

const builtInRules: Record<string, () => Rule> = {
  requireSectionHeading,
  enforceHeadingOrder,
  singleH1,
  requireAltText,
  requireLabelForFormControls,
  enforceListNesting,
  requireLinkText,
  requireTableCaption,
  preventEmptyInlineTags,
  requireHrefOnAnchors,
  requireButtonText,
  requireIframeTitle,
  requireHtmlLang,
  requireImageInputAlt,
  requireNavLinks,
  uniqueIds,
  noTabindexGreaterThanZero,
};
export type RuleSeverity = "error" | "warning" | "off";

export interface LinterOptions {
  rules?: Record<string, RuleSeverity>;
  customRules?: Rule[];
  /** Optional file path for better error messages */
  filePath?: string;
  /** Optional performance recorder */
  perf?: PerformanceRecorder;
}

export interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
  severity?: RuleSeverity;
  filePath?: string;
}

export interface Rule {
  name: string;
  /** Called before traversal begins */
  init?: () => void;
  enterHtml?: (node: Node) => LintResult[];
  exitHtml?: (node: Node) => LintResult[];
  enterJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
  exitJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
  /** Called after traversal finishes */
  end?: () => LintResult[];
  // Support simple custom rules
  test?: (node: Node | t.Node) => boolean;
  message?: string;
}

const defaultOptions: LinterOptions = {
  rules: {
    requireSectionHeading: "error",
    enforceHeadingOrder: "error",
    singleH1: "error",
    requireAltText: "error",
    requireLabelForFormControls: "error",
    enforceListNesting: "error",
    requireLinkText: "error",
    requireTableCaption: "error",
    preventEmptyInlineTags: "warning",
    requireHrefOnAnchors: "error",
    requireButtonText: "error",
    requireIframeTitle: "error",
    requireHtmlLang: "error",
    requireImageInputAlt: "error",
    requireNavLinks: "warning",
    uniqueIds: "error",
    noTabindexGreaterThanZero: "warning",
  },
  customRules: [],
};
/**
 * Lint HTML/JSX/TSX content.
 */
export function lint(
  content: string,
  options: LinterOptions = defaultOptions
): LintResult[] {
  const opts: LinterOptions = {
    rules: { ...defaultOptions.rules, ...(options.rules || {}) },
    customRules: options.customRules ?? defaultOptions.customRules,
    perf: options.perf,
  };

  const results: LintResult[] = [];
  const timings: Record<string, number> = {};
  const ruleTimes: Record<string, number> = {};
  const totalStart = Date.now();

  // Pair each rule with its severity
  const activeRules: { rule: Rule; severity: RuleSeverity }[] = [];
  for (const name in opts.rules) {
    const severity = opts.rules[name];
    if (severity !== "off" && builtInRules[name]) {
      activeRules.push({ rule: builtInRules[name](), severity });
    }
  }
  if (opts.customRules) {
    for (const rule of opts.customRules) {
      activeRules.push({ rule, severity: "error" }); // default custom to error
    }
  }

  activeRules.forEach(({ rule }) => rule.init && rule.init());

  let ast: t.File | null = null;
  let parseErrors: any[] = [];
  let t0 = Date.now();
  try {
    ast = parseJs(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    }) as t.File & { errors?: any[] };
    if (Array.isArray((ast as any).errors)) {
      parseErrors = (ast as any).errors;
    }
  } catch (e) {
    ast = null;
    parseErrors = [e];
  }
  timings.parse = Date.now() - t0;

  if (ast) {
    traverse(ast, {
      JSXElement: {
        enter(path) {
          for (const { rule, severity } of activeRules) {
            if (rule.enterJsx) {
              try {
                const s = Date.now();
                results.push(
                  ...rule.enterJsx(path).map((r) => ({ ...r, severity }))
                );
                ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
              } catch (e) {
                console.error(
                  `[ZemDomu] Error in rule ${rule.name} (${
                    opts.filePath ?? "unknown"
                  }):`,
                  e
                );
              }
            }
            // Handle simple custom rules with test/message for JSX
            if (rule.test && rule.message) {
              try {
                const ts = Date.now();
                if (rule.test(path.node)) {
                  results.push({
                    line: 0,
                    column: 0,
                    message: rule.message,
                    rule: rule.name,
                    severity,
                  });
                }
                ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - ts);
              } catch (e) {
                console.error(
                  `[ZemDomu] Error in custom rule ${rule.name} (${
                    opts.filePath ?? "unknown"
                  }):`,
                  e
                );
              }
            }
          }
        },
        exit(path) {
          for (const { rule, severity } of activeRules) {
            if (rule.exitJsx) {
              try {
                const s = Date.now();
                results.push(
                  ...rule.exitJsx(path).map((r) => ({ ...r, severity }))
                );
                ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
              } catch (e) {
                console.error(
                  `[ZemDomu] Error in rule ${rule.name} (${
                    opts.filePath ?? "unknown"
                  }):`,
                  e
                );
              }
            }
          }
        },
      },
    });
    activeRules.forEach(({ rule, severity }) => {
      if (rule.end) {
        const s = Date.now();
        results.push(...rule.end().map((r) => ({ ...r, severity })));
        ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
      }
    });
    for (const [r, tms] of Object.entries(ruleTimes)) {
      timings[`rule:${r}`] = tms;
    }
    for (const err of parseErrors) {
      const loc = err.loc ? { line: err.loc.line - 1, column: err.loc.column } : { line: 0, column: 0 };
      results.push({
        ...loc,
        message: `Parse error: ${err.message}`,
        rule: "parseError",
      });
    }
    timings.total = Date.now() - totalStart;
    if (opts.perf && opts.filePath) opts.perf.record(opts.filePath, timings);
    return results;
  }

  const root = parseHtmlDom(content);
  const walk = (node: Node) => {
    for (const { rule, severity } of activeRules) {
      if (rule.enterHtml) {
        try {
          const s = Date.now();
          results.push(
            ...rule.enterHtml(node).map((r) => ({ ...r, severity }))
          );
          ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
        } catch (e) {
          console.error(
            `[ZemDomu] Error in rule ${rule.name} (${
              opts.filePath ?? "unknown"
            }):`,
            e
          );
        }
      }
      // Handle simple custom rules with test/message
      if (rule.test && rule.message) {
        try {
          const ts = Date.now();
          if (rule.test(node)) {
            results.push({
              line: 0,
              column: 0,
              message: rule.message,
              rule: rule.name,
              severity,
            });
          }
          ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - ts);
        } catch (e) {
          console.error(
            `[ZemDomu] Error in custom rule ${rule.name} (${
              opts.filePath ?? "unknown"
            }):`,
            e
          );
        }
      }
    }
    if ((node as ElementNode).children) {
      for (const child of (node as ElementNode).children) {
        walk(child);
      }
    }
    for (const { rule, severity } of activeRules) {
      if (rule.exitHtml) {
        try {
          const s = Date.now();
          results.push(...rule.exitHtml(node).map((r) => ({ ...r, severity })));
          ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
        } catch (e) {
          console.error(
            `[ZemDomu] Error in rule ${rule.name} (${
              opts.filePath ?? "unknown"
            }):`,
            e
          );
        }
      }
    }
  };
  walk(root);
  activeRules.forEach(({ rule, severity }) => {
    if (rule.end) {
      const s = Date.now();
      results.push(...rule.end().map((r) => ({ ...r, severity })));
      ruleTimes[rule.name] = (ruleTimes[rule.name] || 0) + (Date.now() - s);
    }
  });

  for (const [r, tms] of Object.entries(ruleTimes)) {
    timings[`rule:${r}`] = tms;
  }
  for (const err of parseErrors) {
    const loc = err.loc ? { line: err.loc.line - 1, column: err.loc.column } : { line: 0, column: 0 };
    results.push({
      ...loc,
      message: `Parse error: ${err.message}`,
      rule: "parseError",
    });
  }
  timings.total = Date.now() - totalStart;
  if (opts.perf && opts.filePath) opts.perf.record(opts.filePath, timings);
  return results;
}
