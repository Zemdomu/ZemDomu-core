import { ElementNode } from '../simpleHtmlParser';
import { LintResult } from '../linter';

export default function requireAltText(node: ElementNode): LintResult[] {
  const results: LintResult[] = [];
  if (
    node.tagName === 'img' &&
    (!('alt' in node.attrs) || !node.attrs.alt.trim())
  ) {
    results.push({
      line: 0, // line/column handling omitted for brevity
      column: 0,
      message: '<img> tag missing alt attribute',
      rule: 'requireAltText',
    });
  }
  return results;
}