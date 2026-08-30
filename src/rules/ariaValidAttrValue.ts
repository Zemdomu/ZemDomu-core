import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Node } from "../simpleHtmlParser";
import { LintResult, Rule } from "../linter";

const BOOLEAN_ATTRS = new Set([
  "aria-hidden",
  "aria-expanded",
  "aria-selected",
  "aria-disabled",
  "aria-required",
  "aria-modal",
  "aria-multiline",
  "aria-multiselectable",
  "aria-readonly",
  "aria-busy",
  "aria-atomic",
]);

const TRISTATE_ATTRS = new Set(["aria-checked", "aria-pressed"]);
const NUMERIC_ATTRS = new Set([
  "aria-level",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuenow",
  "aria-colindex",
  "aria-rowindex",
  "aria-colcount",
  "aria-rowcount",
  "aria-setsize",
  "aria-posinset",
]);
const IDREF_LIST_ATTRS = new Set([
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
]);

const TOKEN_ATTRS: Record<string, Set<string>> = {
  "aria-current": new Set([
    "page",
    "step",
    "location",
    "date",
    "time",
    "true",
    "false",
  ]),
  "aria-live": new Set(["off", "polite", "assertive"]),
  "aria-sort": new Set(["none", "ascending", "descending", "other"]),
  "aria-orientation": new Set(["horizontal", "vertical"]),
  "aria-haspopup": new Set([
    "false",
    "true",
    "menu",
    "listbox",
    "tree",
    "grid",
    "dialog",
  ]),
  "aria-autocomplete": new Set(["inline", "list", "both", "none"]),
  "aria-invalid": new Set(["false", "true", "grammar", "spelling"]),
};

const MULTI_TOKEN_ATTRS: Record<string, Set<string>> = {
  "aria-relevant": new Set(["additions", "removals", "text", "all"]),
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isNumeric(value: string): boolean {
  if (!value.trim()) return false;
  return Number.isFinite(Number(value));
}

function isNonEmptyIdRefList(value: string): boolean {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0;
}

function isSupportedAriaAttr(attr: string): boolean {
  return (
    BOOLEAN_ATTRS.has(attr) ||
    TRISTATE_ATTRS.has(attr) ||
    NUMERIC_ATTRS.has(attr) ||
    IDREF_LIST_ATTRS.has(attr) ||
    Object.prototype.hasOwnProperty.call(TOKEN_ATTRS, attr) ||
    Object.prototype.hasOwnProperty.call(MULTI_TOKEN_ATTRS, attr)
  );
}

function isValidAriaValue(attr: string, rawValue: string): boolean {
  const value = normalize(rawValue);
  if (!isSupportedAriaAttr(attr)) return true;
  if (!value) return false;

  if (BOOLEAN_ATTRS.has(attr)) {
    return value === "true" || value === "false";
  }

  if (TRISTATE_ATTRS.has(attr)) {
    return (
      value === "true" ||
      value === "false" ||
      value === "mixed" ||
      value === "undefined"
    );
  }

  if (NUMERIC_ATTRS.has(attr)) {
    return isNumeric(value);
  }

  if (IDREF_LIST_ATTRS.has(attr)) {
    return isNonEmptyIdRefList(rawValue);
  }

  const tokenSet = TOKEN_ATTRS[attr];
  if (tokenSet) {
    return tokenSet.has(value);
  }

  const multiTokenSet = MULTI_TOKEN_ATTRS[attr];
  if (multiTokenSet) {
    const tokens = value.split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => multiTokenSet.has(token));
  }

  return true;
}

function jsxStaticAriaValue(
  attr: t.JSXAttribute
): { value: string; dynamic: boolean } {
  // JSX shorthand attributes evaluate to boolean true. React serializes valid
  // boolean-like ARIA values such as `aria-hidden` as "true".
  if (!attr.value) return { value: "true", dynamic: false };
  if (t.isStringLiteral(attr.value)) return { value: attr.value.value, dynamic: false };
  if (!t.isJSXExpressionContainer(attr.value)) return { value: "", dynamic: true };

  const expr = attr.value.expression;
  if (t.isStringLiteral(expr)) return { value: expr.value, dynamic: false };
  if (t.isBooleanLiteral(expr)) return { value: String(expr.value), dynamic: false };
  if (t.isNumericLiteral(expr)) return { value: String(expr.value), dynamic: false };
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    const staticValue = expr.quasis.map((q) => q.value.cooked ?? q.value.raw).join("");
    return { value: staticValue, dynamic: false };
  }
  return { value: "", dynamic: true };
}

function invalidValueResult(
  attr: string,
  rawValue: string,
  line: number,
  column: number
): LintResult {
  return {
    line,
    column,
    message: `ARIA attribute "${attr}" has invalid value "${rawValue}"`,
    rule: "ariaValidAttrValue",
  };
}

export default function ariaValidAttrValue(): Rule {
  return {
    name: "ariaValidAttrValue",

    enterHtml(node: Node): LintResult[] {
      if (node.type !== "element") return [];
      const results: LintResult[] = [];

      for (const [rawName, rawValue] of Object.entries(node.attrs)) {
        const name = rawName.toLowerCase();
        if (name.startsWith(":aria-") || name.startsWith("v-bind:aria-")) continue;
        if (!name.startsWith("aria-")) continue;
        if (!isSupportedAriaAttr(name)) continue;
        const value = String(rawValue ?? "");
        if (!isValidAriaValue(name, value)) {
          results.push(invalidValueResult(name, value, 0, 0));
        }
      }

      return results;
    },

    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const results: LintResult[] = [];
      const attrs = path.node.openingElement.attributes;

      for (const attr of attrs) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
        const name = attr.name.name.toLowerCase();
        if (!name.startsWith("aria-")) continue;
        if (!isSupportedAriaAttr(name)) continue;

        const { value, dynamic } = jsxStaticAriaValue(attr);
        if (dynamic) continue;
        if (!isValidAriaValue(name, value)) {
          const line = (attr.loc?.start.line ?? path.node.loc?.start.line ?? 1) - 1;
          const column = attr.loc?.start.column ?? path.node.loc?.start.column ?? 0;
          results.push(invalidValueResult(name, value, line, column));
        }
      }

      return results;
    },
  };
}
