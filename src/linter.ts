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
import preventZemdomuPlaceholders from "./rules/preventZemdomuPlaceholders";
import requireDocumentTitle from "./rules/requireDocumentTitle";
import requireSingleMain from "./rules/requireSingleMain";
import ariaValidAttrValue from "./rules/ariaValidAttrValue";
import requirePageH1 from "./rules/requirePageH1";
import { applyRuleCode } from "./rule-codes";
import type {
  SemanticComponentId,
  SemanticCompositionId,
  SemanticGraph,
} from "./semantic-graph";
import type { SemanticPageDocument } from "./page-model";

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
  preventZemdomuPlaceholders,
  requireDocumentTitle,
  requireSingleMain,
  ariaValidAttrValue,
  requirePageH1,
};
export type RuleSeverity = "error" | "warning" | "off";

export interface LinterOptions {
  rules?: Record<string, RuleSeverity>;
  customRules?: Rule[];
  /** Optional file path for better error messages */
  filePath?: string;
  /** Force HTML parsing instead of JSX/TSX parsing */
  forceHtml?: boolean;
  /** Optional performance recorder */
  perf?: PerformanceRecorder;
}

export interface LintResult {
  line: number;
  column: number;
  /** Zero-based absolute source offset for reliable editor actions. */
  offset?: number;
  message: string;
  rule: string;
  code?: string;
  severity?: RuleSeverity;
  filePath?: string;
  /** Internal page identity used by composed-page analysis. */
  pageId?: string;
  /** Internal resolved component instance used by composed-page analysis. */
  pageComponentPath?: SemanticComponentId[];
  pageCompositionPath?: SemanticCompositionId[];
  /** Internal marker: page analysis proved the matching file finding invalid. */
  pageSuppression?: boolean;
  /** False when editing the shared source cannot fix an instance-level conflict. */
  pageEditSafe?: boolean;
  related?: Array<{
    filePath: string;
    line: number;
    column: number;
    message?: string;
  }>;
}

export interface Rule {
  name: string;
  /** Called before traversal begins */
  init?: () => void;
  setHtmlContext?: (ctx: { content: string; lineIndex: number[] }) => void;
  enterHtml?: (node: Node) => LintResult[];
  exitHtml?: (node: Node) => LintResult[];
  enterJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
  exitJsx?: (path: NodePath<t.JSXElement>) => LintResult[];
  /** Called after traversal finishes */
  end?: () => LintResult[];
  /** Analyze one resolved composed page using the same registered rule. */
  analyzePage?: (context: PageRuleContext) => LintResult[];
  // Support simple custom rules
  test?: (node: Node | t.Node) => boolean;
  message?: string;
}

export interface PageRuleContext {
  page: SemanticPageDocument;
  graph: SemanticGraph;
  /** File-level results are available for conservative candidate refinement. */
  fileResults: ReadonlyMap<string, readonly LintResult[]>;
}

const defaultOptions: LinterOptions = {
  rules: {
    requireSectionHeading: "warning",
    enforceHeadingOrder: "error",
    singleH1: "warning",
    requireAltText: "error",
    requireLabelForFormControls: "error",
    enforceListNesting: "error",
    requireLinkText: "error",
    requireTableCaption: "warning",
    preventEmptyInlineTags: "warning",
    requireHrefOnAnchors: "error",
    requireButtonText: "error",
    requireIframeTitle: "error",
    requireHtmlLang: "error",
    requireImageInputAlt: "error",
    requireNavLinks: "warning",
    uniqueIds: "error",
    noTabindexGreaterThanZero: "warning",
    preventZemdomuPlaceholders: "warning",
    requireDocumentTitle: "error",
    requireSingleMain: "error",
    ariaValidAttrValue: "error",
    requirePageH1: "off",
  },
  customRules: [],
};

export function createActiveRules(
  options: LinterOptions = defaultOptions
): Array<{ rule: Rule; severity: RuleSeverity }> {
  const rules = { ...defaultOptions.rules, ...(options.rules ?? {}) };
  const active: Array<{ rule: Rule; severity: RuleSeverity }> = [];
  for (const name in rules) {
    const severity = rules[name];
    if (severity !== "off" && builtInRules[name]) {
      active.push({ rule: builtInRules[name](), severity });
    }
  }
  for (const rule of options.customRules ?? defaultOptions.customRules ?? []) {
    active.push({ rule, severity: "error" });
  }
  return active;
}

function buildLineIndex(content: string): number[] {
  const lines = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") lines.push(i + 1);
  }
  return lines;
}

function locationAt(lineIndex: number[], offset: number): { line: number; column: number } {
  const safeOffset = Math.max(0, offset);
  let low = 0;
  let high = lineIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] <= safeOffset) low = mid + 1;
    else high = mid - 1;
  }
  const line = Math.max(0, high);
  return { line, column: safeOffset - lineIndex[line] };
}

function attributeNameForResult(result: LintResult): string | undefined {
  if (result.rule === "noTabindexGreaterThanZero") return "tabindex";
  if (result.rule === "uniqueIds") return "id";
  const quotedAria = /ARIA attribute "([^"]+)"/.exec(result.message)?.[1];
  if (quotedAria) return quotedAria;
  const namedAttribute = /\b(alt|href|lang|title) attribute (?:is empty|is invalid)/i.exec(
    result.message
  )?.[1];
  return namedAttribute?.toLowerCase();
}

function attributeOffset(content: string, node: ElementNode, name: string): number | undefined {
  const tagEnd = content.indexOf(">", node.startIndex);
  if (tagEnd === -1) return undefined;
  const openingTag = content.slice(node.startIndex, tagEnd + 1);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)(${escaped})(?=\\s|=|/?>)`, "i").exec(openingTag);
  if (!match || match.index === undefined) return undefined;
  return node.startIndex + match.index + match[0].indexOf(match[1]);
}

function withHtmlLocation(
  result: LintResult,
  node: Node,
  content: string,
  lineIndex: number[]
): LintResult {
  let offset = result.offset;
  if (offset === undefined && (result.line !== 0 || result.column !== 0)) {
    offset = (lineIndex[result.line] ?? 0) + result.column;
  }
  if (offset === undefined && node.type === "element") {
    const attribute = attributeNameForResult(result);
    offset = attribute ? attributeOffset(content, node, attribute) : undefined;
  }
  if (offset === undefined) offset = node.startIndex;
  return { ...result, ...locationAt(lineIndex, offset), offset };
}

function withJsxOffset(
  result: LintResult,
  path: NodePath<t.JSXElement>,
  lineIndex: number[]
): LintResult {
  const attributeName = attributeNameForResult(result);
  const attributeOffset = attributeName
    ? path.node.openingElement.attributes.find(
        (attribute): attribute is t.JSXAttribute =>
          t.isJSXAttribute(attribute) &&
          t.isJSXIdentifier(attribute.name) &&
          attribute.name.name.toLowerCase() === attributeName.toLowerCase()
      )?.start
    : undefined;
  const openingLoc = path.node.openingElement.loc?.start;
  const hasExplicitLocation =
    result.line !== 0 ||
    result.column !== 0 ||
    (openingLoc?.line === 1 && openingLoc.column === 0);
  const locationOffset = hasExplicitLocation
    ? (lineIndex[result.line] ?? 0) + result.column
    : undefined;
  const offset =
    result.offset ??
    attributeOffset ??
    locationOffset ??
    path.node.openingElement.start ??
    path.node.start;
  return offset === null || offset === undefined
    ? result
    : { ...result, ...locationAt(lineIndex, offset), offset };
}

type InlineDirective = {
  action: "disable" | "enable" | "disable-next";
  rules: Set<string> | null;
  offset: number;
  endOffset: number;
  line: number;
  targetLine?: number;
};

type SourceComment = { text: string; start: number; end: number };

function getJsxComments(content: string): SourceComment[] | null {
  try {
    const ast = parseJs(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    }) as t.File & { comments?: Array<{ value: string; start?: number | null; end?: number | null }> };
    return (ast.comments ?? []).flatMap((comment) => {
      const start = comment.start;
      const end = comment.end;
      if (start === null || start === undefined || end === null || end === undefined) {
        return [];
      }
      if (content[start - 1] !== "{" || content[end] !== "}") return [];
      return [{ text: comment.value, start: start - 1, end: end + 1 }];
    });
  } catch {
    return null;
  }
}

function getHtmlComments(content: string): SourceComment[] {
  const comments: SourceComment[] = [];
  const root = parseHtmlDom(content);
  const visit = (node: Node, excluded: boolean) => {
    if (node.type === "comment") {
      if (!excluded) {
        comments.push({
          text: node.text,
          start: node.startIndex,
          end: node.startIndex + 7 + node.text.length,
        });
      }
      return;
    }
    if (node.type !== "element") return;
    const childExcluded =
      excluded || node.tagName === "script" || node.tagName === "style";
    for (const child of node.children) visit(child, childExcluded);
  };
  visit(root, false);
  return comments;
}

function getSourceComments(content: string): SourceComment[] {
  return getJsxComments(content) ?? getHtmlComments(content);
}

function parseInlineDirectives(content: string, lineIndex: number[]): InlineDirective[] {
  const directives: InlineDirective[] = [];
  const comments = getSourceComments(content);
  const directivePattern = /^\s*zemdomu-(disable-next|disable|enable)\b([\s\S]*?)\s*$/i;
  const masked = content.split("");
  for (const comment of comments) {
    for (let index = comment.start; index < comment.end; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
  }
  const maskedLines = masked.join("").split(/\r?\n/);

  for (const comment of comments) {
    const match = directivePattern.exec(comment.text);
    if (!match) continue;
    const action = match[1].toLowerCase() as InlineDirective["action"];
    const rawRules = match[2].trim();
    const rules = rawRules
      ? new Set(rawRules.split(/[\s,]+/).filter(Boolean))
      : null;
    const line = locationAt(lineIndex, comment.start).line;
    let targetLine: number | undefined;
    if (action === "disable-next") {
      const endColumn = locationAt(lineIndex, comment.end).column;
      const restOfLine = maskedLines[line]?.slice(endColumn) ?? "";
      if (restOfLine.trim()) targetLine = line;
      else {
        targetLine = line + 1;
        while (
          targetLine < maskedLines.length &&
          !maskedLines[targetLine].trim()
        ) {
          targetLine += 1;
        }
      }
    }
    directives.push({
      action,
      rules,
      offset: comment.start,
      endOffset: comment.end,
      line,
      targetLine,
    });
  }
  return directives;
}

function ruleMatches(rules: Set<string> | null, rule: string): boolean {
  return rules === null || rules.has(rule) || rules.has("*");
}

export function applyInlineDisableDirectives(
  content: string,
  results: LintResult[]
): LintResult[] {
  if (!content.includes("zemdomu-disable") && !content.includes("zemdomu-enable")) {
    return results;
  }
  const lineIndex = buildLineIndex(content);
  const directives = parseInlineDirectives(content, lineIndex);
  if (!directives.length) return results;

  return results.filter((result) => {
    const offset = result.offset ?? (lineIndex[result.line] ?? 0) + result.column;
    const disabled = new Set<string>();
    const enabledWhileAllDisabled = new Set<string>();
    let disableAll = false;
    for (const directive of directives) {
      if (directive.action === "disable-next") {
        const afterDirective =
          result.line !== directive.line || offset >= directive.endOffset;
        if (
          directive.targetLine === result.line &&
          afterDirective &&
          ruleMatches(directive.rules, result.rule)
        ) {
          return false;
        }
        continue;
      }
      if (directive.offset > offset) break;
      if (directive.action === "disable") {
        if (directive.rules === null || directive.rules.has("*")) {
          disableAll = true;
          enabledWhileAllDisabled.clear();
        } else {
          for (const rule of directive.rules) {
            disabled.add(rule);
            enabledWhileAllDisabled.delete(rule);
          }
        }
      } else if (directive.rules === null || directive.rules.has("*")) {
        disableAll = false;
        disabled.clear();
        enabledWhileAllDisabled.clear();
      } else {
        for (const rule of directive.rules) {
          disabled.delete(rule);
          if (disableAll) enabledWhileAllDisabled.add(rule);
        }
      }
    }
    const isDisabledByAll = disableAll && !enabledWhileAllDisabled.has(result.rule);
    return !(isDisabledByAll || disabled.has(result.rule));
  });
}
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
    filePath: options.filePath,
    forceHtml: options.forceHtml,
    perf: options.perf,
  };

  const results: LintResult[] = [];
  const sourceLineIndex = buildLineIndex(content);
  const timings: Record<string, number> = {};
  const ruleTimes: Record<string, number> = {};
  const totalStart = Date.now();

  // Pair each rule with its severity
  const activeRules = createActiveRules(opts);

  activeRules.forEach(({ rule }) => rule.init && rule.init());

  let ast: t.File | null = null;
  let parseErrors: any[] = [];
  if (!opts.forceHtml) {
    const t0 = Date.now();
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
  }

  if (ast) {
    traverse(ast, {
      JSXElement: {
        enter(path) {
          for (const { rule, severity } of activeRules) {
            if (rule.enterJsx) {
              try {
                const s = Date.now();
                results.push(
                  ...rule
                    .enterJsx(path)
                    .map((r) =>
                      applyRuleCode(
                        withJsxOffset({ ...r, severity }, path, sourceLineIndex)
                      )
                    )
                );
                ruleTimes[rule.name] =
                  (ruleTimes[rule.name] || 0) + (Date.now() - s);
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
                  results.push(
                    withJsxOffset(
                      {
                        line: 0,
                        column: 0,
                        message: rule.message,
                        rule: rule.name,
                        severity,
                      },
                      path,
                      sourceLineIndex
                    )
                  );
                }
                ruleTimes[rule.name] =
                  (ruleTimes[rule.name] || 0) + (Date.now() - ts);
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
                  ...rule
                    .exitJsx(path)
                    .map((r) =>
                      applyRuleCode(
                        withJsxOffset({ ...r, severity }, path, sourceLineIndex)
                      )
                    )
                );
                ruleTimes[rule.name] =
                  (ruleTimes[rule.name] || 0) + (Date.now() - s);
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
        results.push(
          ...rule.end().map((r) => applyRuleCode({ ...r, severity }))
        );
        ruleTimes[rule.name] =
          (ruleTimes[rule.name] || 0) + (Date.now() - s);
      }
    });
    for (const [r, tms] of Object.entries(ruleTimes)) {
      timings[`rule:${r}`] = tms;
    }
    for (const err of parseErrors) {
      const loc = err.loc
        ? { line: err.loc.line - 1, column: err.loc.column }
        : { line: 0, column: 0 };
      results.push({
        ...loc,
        message: `Parse error: ${err.message}`,
        rule: "parseError",
      });
    }
    timings.total = Date.now() - totalStart;
    if (opts.perf && opts.filePath) opts.perf.record(opts.filePath, timings);
    return applyInlineDisableDirectives(content, results);
  }

  const root = parseHtmlDom(content);
  // If the source contained only comments or whitespace, ignore parse errors
  const onlyComments = root.children.every(
    (n) =>
      n.type === "comment" || (n.type === "text" && n.text.trim() === "")
  );
  if (onlyComments) {
    parseErrors = [];
  }
  const lineIndex = sourceLineIndex;
  activeRules.forEach(({ rule }) => {
    if (rule.setHtmlContext) {
      try {
        rule.setHtmlContext({ content, lineIndex });
      } catch (e) {
        console.error(
          `[ZemDomu] Error in rule ${rule.name} (${
            opts.filePath ?? "unknown"
          }):`,
          e
        );
      }
    }
  });
  const walk = (node: Node) => {
    for (const { rule, severity } of activeRules) {
      if (rule.enterHtml) {
        try {
          const s = Date.now();
          results.push(
            ...rule
              .enterHtml(node)
              .map((r) =>
                applyRuleCode(
                  withHtmlLocation({ ...r, severity }, node, content, lineIndex)
                )
              )
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
            results.push(
              withHtmlLocation(
                {
                  line: 0,
                  column: 0,
                  message: rule.message,
                  rule: rule.name,
                  severity,
                },
                node,
                content,
                lineIndex
              )
            );
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
          results.push(
            ...rule
              .exitHtml(node)
              .map((r) =>
                applyRuleCode(
                  withHtmlLocation({ ...r, severity }, node, content, lineIndex)
                )
              )
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
  };
  walk(root);
  activeRules.forEach(({ rule, severity }) => {
    if (rule.end) {
      const s = Date.now();
      results.push(
        ...rule.end().map((r) => {
          const located = r.offset === undefined
            ? { ...r, severity }
            : { ...r, ...locationAt(lineIndex, r.offset), severity };
          return applyRuleCode(located);
        })
      );
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
  return applyInlineDisableDirectives(content, results);
}
