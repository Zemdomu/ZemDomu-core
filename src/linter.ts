import { parse as parseHtmlDom, ElementNode, Node } from './simpleHtmlParser';
import { parse as parseJs } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import requireAltText from './rules/requireAltText';
import requireSectionHeading from './rules/requireSectionHeading';
import enforceHeadingOrder from './rules/enforceHeadingOrder';
import singleH1 from './rules/singleH1';
import requireLabelForFormControls from './rules/requireLabelForFormControls';
import enforceListNesting from './rules/enforceListNesting';
import requireLinkText from './rules/requireLinkText';
import requireTableCaption from './rules/requireTableCaption';
import preventEmptyInlineTags from './rules/preventEmptyInlineTags';
import requireHrefOnAnchors from './rules/requireHrefOnAnchors';
import requireButtonText from './rules/requireButtonText';
import requireIframeTitle from './rules/requireIframeTitle';
import requireHtmlLang from './rules/requireHtmlLang';
import requireImageInputAlt from './rules/requireImageInputAlt';
import requireNavLinks from './rules/requireNavLinks';
import uniqueIds from './rules/uniqueIds';
import noTabindexGreaterThanZero from './rules/noTabindexGreaterThanZero';

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

export interface LintResult {
  line: number;
  column: number;
  message: string;
  rule: string;
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
}

export interface LinterOptions {
  rules?: Record<string, boolean>;
  customRules?: Rule[];
  /** Optional file path for better error messages */
  filePath?: string;
}

const defaultOptions: LinterOptions = {
  rules: {
    requireSectionHeading: true,
    enforceHeadingOrder: true,
    singleH1: true,
    requireAltText: true,
    requireLabelForFormControls: true,
    enforceListNesting: true,
    requireLinkText: true,
    requireTableCaption: true,
    preventEmptyInlineTags: true,
    requireHrefOnAnchors: true,
    requireButtonText: true,
    requireIframeTitle: true,
    requireHtmlLang: true,
    requireImageInputAlt: true,
    requireNavLinks: true,
    uniqueIds: true,
    noTabindexGreaterThanZero: true,
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
  };

  const results: LintResult[] = [];

  const activeRules: Rule[] = [];
  for (const name in opts.rules) {
    const enabled = opts.rules[name];
    if (enabled && builtInRules[name]) {
      activeRules.push(builtInRules[name]());
    }
  }
  if (opts.customRules) activeRules.push(...opts.customRules);

  activeRules.forEach(r => r.init && r.init());

  let ast: t.File | null = null;
  try {
    ast = parseJs(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    ast = null;
  }

  if (ast) {
    traverse(ast, {
      JSXElement: {
        enter(path) {
          for (const rule of activeRules) {
            if (rule.enterJsx) {
              try {
                results.push(...rule.enterJsx(path));
              } catch (e) {
                console.error(
                  `[ZemDomu] Error in rule ${rule.name} (${opts.filePath ?? 'unknown'}):`,
                  e
                );
              }
            }
          }
        },
        exit(path) {
          for (const rule of activeRules) {
            if (rule.exitJsx) {
              try {
                results.push(...rule.exitJsx(path));
              } catch (e) {
                console.error(
                  `[ZemDomu] Error in rule ${rule.name} (${opts.filePath ?? 'unknown'}):`,
                  e
                );
              }
            }
          }
        },
      },
    });
    activeRules.forEach(r => r.end && results.push(...r.end()));
    return results;
  }

  const root = parseHtmlDom(content);
  const walk = (node: Node) => {
    for (const rule of activeRules) {
      if (rule.enterHtml) {
        try {
          results.push(...rule.enterHtml(node));
        } catch (e) {
          console.error(
            `[ZemDomu] Error in rule ${rule.name} (${opts.filePath ?? 'unknown'}):`,
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
    for (const rule of activeRules) {
      if (rule.exitHtml) {
        try {
          results.push(...rule.exitHtml(node));
        } catch (e) {
          console.error(
            `[ZemDomu] Error in rule ${rule.name} (${opts.filePath ?? 'unknown'}):`,
            e
          );
        }
      }
    }
  };
  walk(root);
  activeRules.forEach(r => r.end && results.push(...r.end()));

  return results;
}
