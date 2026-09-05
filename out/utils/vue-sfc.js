"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractVueTemplate = extractVueTemplate;
exports.extractVueScripts = extractVueScripts;
exports.isHtmlVueTemplate = isHtmlVueTemplate;
function parseAttributes(input) {
    const attrs = {};
    input.replace(/([\w-:]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g, (_, name, value) => {
        if (value === undefined) {
            attrs[name.toLowerCase()] = true;
        }
        else {
            attrs[name.toLowerCase()] = value.replace(/^['"]|['"]$/g, "");
        }
        return "";
    });
    return attrs;
}
function isSelfClosingTag(tagText) {
    return /\/>\s*$/.test(tagText);
}
function findBlock(source, tagName) {
    var _a;
    const openRe = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
    const openMatch = openRe.exec(source);
    if (!openMatch)
        return null;
    const openStart = openMatch.index;
    const openTagText = openMatch[0];
    const openEnd = openStart + openTagText.length;
    const attrs = parseAttributes((_a = openMatch[1]) !== null && _a !== void 0 ? _a : "");
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
        if (!match)
            break;
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
    if (closeStart === -1)
        return null;
    const content = source.slice(openEnd, closeStart);
    return { content, start: openEnd, end: closeStart, attrs };
}
function extractVueTemplate(source) {
    return findBlock(source, "template");
}
function extractVueScripts(source) {
    var _a, _b;
    const blocks = [];
    const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRe.exec(source))) {
        const full = match[0];
        const attrsText = (_a = match[1]) !== null && _a !== void 0 ? _a : "";
        const content = (_b = match[2]) !== null && _b !== void 0 ? _b : "";
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
function isHtmlVueTemplate(block) {
    if (!block)
        return false;
    const lang = block.attrs.lang;
    if (lang === undefined || lang === true)
        return true;
    return String(lang).toLowerCase() === "html";
}
