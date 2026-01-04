export type VueSfcBlock = {
  content: string;
  start: number;
  end: number;
  attrs: Record<string, string | true>;
};

function parseAttributes(input: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  input.replace(
    /([\w-:]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g,
    (_, name: string, value: string) => {
      if (value === undefined) {
        attrs[name.toLowerCase()] = true;
      } else {
        attrs[name.toLowerCase()] = value.replace(/^['"]|['"]$/g, "");
      }
      return "";
    }
  );
  return attrs;
}

function isSelfClosingTag(tagText: string): boolean {
  return /\/>\s*$/.test(tagText);
}

function findBlock(source: string, tagName: string): VueSfcBlock | null {
  const openRe = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
  const openMatch = openRe.exec(source);
  if (!openMatch) return null;

  const openStart = openMatch.index;
  const openTagText = openMatch[0];
  const openEnd = openStart + openTagText.length;
  const attrs = parseAttributes(openMatch[1] ?? "");
  if (isSelfClosingTag(openTagText)) {
    return { content: "", start: openEnd, end: openEnd, attrs };
  }

  const tagRe = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "ig");
  tagRe.lastIndex = openEnd;
  let depth = 1;
  let closeStart = -1;
  let closeEnd = -1;

  while (true) {
    const match = tagRe.exec(source);
    if (!match) break;
    const tagText = match[0];
    const isClose = tagText.startsWith("</");
    const isSelfClosing = isSelfClosingTag(tagText);
    if (!isClose && isSelfClosing) {
      continue;
    }
    depth += isClose ? -1 : 1;
    if (depth === 0) {
      closeStart = match.index;
      closeEnd = closeStart + tagText.length;
      break;
    }
  }

  if (closeStart === -1) return null;

  const content = source.slice(openEnd, closeStart);
  return { content, start: openEnd, end: closeStart, attrs };
}

export function extractVueTemplate(source: string): VueSfcBlock | null {
  return findBlock(source, "template");
}

export function extractVueScripts(source: string): VueSfcBlock[] {
  const blocks: VueSfcBlock[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(source))) {
    const full = match[0];
    const attrsText = match[1] ?? "";
    const content = match[2] ?? "";
    const openTagEnd = full.indexOf(">") + 1;
    const start = match.index + openTagEnd;
    const end = start + content.length;
    blocks.push({
      content,
      start,
      end,
      attrs: parseAttributes(attrsText),
    });
  }
  return blocks;
}

export function isHtmlVueTemplate(block: VueSfcBlock | null): block is VueSfcBlock {
  if (!block) return false;
  const lang = block.attrs.lang;
  if (lang === undefined || lang === true) return true;
  return String(lang).toLowerCase() === "html";
}
