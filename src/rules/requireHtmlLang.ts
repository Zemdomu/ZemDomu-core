import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Node } from '../simpleHtmlParser';
import { LintResult, Rule } from '../linter';
import { getJsxAttr, getJsxAttributeState } from './utils';

const HTML_LANG_ATTRS = ['lang', ':lang', 'v-bind:lang'];

function isAlpha(value: string): boolean {
  return /^[A-Za-z]+$/.test(value);
}

function isAlnum(value: string): boolean {
  return /^[A-Za-z0-9]+$/.test(value);
}

function isDigit(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function isVariant(subtag: string): boolean {
  if (!isAlnum(subtag)) return false;
  if (subtag.length >= 5 && subtag.length <= 8) return true;
  return subtag.length === 4 && /^[0-9]/.test(subtag);
}

function isExtensionSingleton(subtag: string): boolean {
  if (!isAlnum(subtag) || subtag.length !== 1) return false;
  return subtag.toLowerCase() !== 'x';
}

function isExtensionSubtag(subtag: string): boolean {
  return isAlnum(subtag) && subtag.length >= 2 && subtag.length <= 8;
}

function isPrivateUseSubtag(subtag: string): boolean {
  return isAlnum(subtag) && subtag.length >= 1 && subtag.length <= 8;
}

function isDynamicLangValue(value: string): boolean {
  return value.includes('{') || value.includes('}');
}

function isValidLangTag(lang: string): boolean {
  if (!lang) return false;
  if (lang.includes('_')) return false;
  const parts = lang.split('-');
  if (parts.some((p) => p.length === 0)) return false;

  let index = 0;
  const first = parts[0];
  if (!first) return false;

  if (first.toLowerCase() === 'x') {
    if (parts.length === 1) return false;
    return parts.slice(1).every(isPrivateUseSubtag);
  }

  if (!isAlpha(first) || (first.length !== 2 && first.length !== 3 && first.length !== 4)) {
    return false;
  }
  index++;

  let extLangCount = 0;
  while (
    index < parts.length &&
    parts[index].length === 3 &&
    isAlpha(parts[index]) &&
    extLangCount < 3
  ) {
    index++;
    extLangCount++;
  }

  if (index < parts.length && parts[index].length === 4 && isAlpha(parts[index])) {
    index++;
  }

  if (
    index < parts.length &&
    ((parts[index].length === 2 && isAlpha(parts[index])) ||
      (parts[index].length === 3 && isDigit(parts[index])))
  ) {
    index++;
  }

  while (index < parts.length && isVariant(parts[index])) {
    index++;
  }

  while (index < parts.length && isExtensionSingleton(parts[index])) {
    index++;
    if (index >= parts.length || !isExtensionSubtag(parts[index])) return false;
    while (index < parts.length && isExtensionSubtag(parts[index])) {
      index++;
    }
  }

  if (index < parts.length && parts[index].toLowerCase() === 'x') {
    index++;
    if (index >= parts.length) return false;
    while (index < parts.length && isPrivateUseSubtag(parts[index])) {
      index++;
    }
  }

  return index === parts.length;
}

function getHtmlLangAttr(attrs: Record<string, string>): { value: string; dynamic: boolean } | null {
  for (const name of HTML_LANG_ATTRS) {
    if (!Object.prototype.hasOwnProperty.call(attrs, name)) continue;
    const raw = attrs[name];
    return { value: raw ?? '', dynamic: name !== 'lang' };
  }
  return null;
}

export default function requireHtmlLang(): Rule {
  let seen = false;
  return {
    name: 'requireHtmlLang',
    enterHtml(node: Node): LintResult[] {
      if (!seen && node.type === 'element' && node.tagName === 'html') {
        seen = true;
        const langAttr = getHtmlLangAttr(node.attrs);
        if (!langAttr) {
          return [{ line: 0, column: 0, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
        }
        const trimmed = String(langAttr.value ?? '').trim();
        if (!trimmed) {
          return [{ line: 0, column: 0, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
        }
        if (!langAttr.dynamic && !isDynamicLangValue(trimmed) && !isValidLangTag(trimmed)) {
          return [{ line: 0, column: 0, message: '<html> lang attribute is invalid', rule: 'requireHtmlLang' }];
        }
      }
      return [];
    },
    enterJsx(path: NodePath<t.JSXElement>): LintResult[] {
      const opening = path.node.openingElement;
      const tag = t.isJSXIdentifier(opening.name) ? opening.name.name.toLowerCase() : '';
      if (!seen && tag === 'html') {
        seen = true;
        const langState = getJsxAttributeState(opening, 'lang', true);
        const line = (opening.loc?.start.line ?? 1) - 1;
        const column = opening.loc?.start.column ?? 0;
        if (langState === 'missing') {
          return [{ line, column, message: '<html> element missing lang attribute', rule: 'requireHtmlLang' }];
        }
        if (langState === 'empty') {
          return [{ line, column, message: '<html> lang attribute is empty', rule: 'requireHtmlLang' }];
        }
        if (langState === 'possiblyEmpty') {
          return [{ line, column, message: '<html> lang is possibly empty or undefined', rule: 'requireHtmlLang' }];
        }

        const lang = getJsxAttr(opening, 'lang');
        if (lang && !isValidLangTag(lang.trim())) {
          return [{ line, column, message: '<html> lang attribute is invalid', rule: 'requireHtmlLang' }];
        }
      }
      return [];
    },
  };
}
