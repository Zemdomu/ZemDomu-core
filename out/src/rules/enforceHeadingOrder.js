"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = enforceHeadingOrder;
const utils_1 = require("./utils");
/**
 * Enforce heading order with symmetric skip detection.
 *
 * Flags:
 *  - Upward skip:   h2 -> h4 (new > last + 1)
 *  - Downward skip: h6 -> h4 (last > new + 1)
 *  - Reset to h1:   any h1 after a non-h1 (e.g. h6 -> h1)
 *
 * First heading in a file never warns.
 * Does not auto-reset on <section>/<article> yet; add if you want outline semantics.
 */
function enforceHeadingOrder() {
    let last = 0; // 0 means “no heading seen yet”
    return {
        name: "enforceHeadingOrder",
        init() {
            last = 0;
        },
        enterHtml(node) {
            if (!(node.type === "element" && /^h[1-6]$/.test(node.tagName)))
                return [];
            const lvl = parseInt(node.tagName[1], 10);
            const msg = computeMessage(lvl, last, node.tagName);
            last = lvl;
            if (!msg)
                return [];
            // simpleHtmlParser nodes don’t carry source positions here; anchor at (0,0)
            return [
                {
                    line: 0,
                    column: 0,
                    message: msg,
                    rule: "enforceHeadingOrder",
                },
            ];
        },
        enterJsx(path) {
            var _a, _b, _c, _d;
            const tag = (0, utils_1.getTag)(path);
            if (!/^h[1-6]$/.test(tag))
                return [];
            const lvl = parseInt(tag[1], 10);
            const msg = computeMessage(lvl, last, tag);
            last = lvl;
            if (!msg)
                return [];
            const line = ((_b = (_a = path.node.loc) === null || _a === void 0 ? void 0 : _a.start.line) !== null && _b !== void 0 ? _b : 1) - 1; // VS Code is 0-based
            const column = (_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start.column) !== null && _d !== void 0 ? _d : 0;
            return [
                {
                    line,
                    column,
                    message: msg,
                    rule: "enforceHeadingOrder",
                },
            ];
        },
    };
}
/**
 * Return a human-readable message if the new level violates order, else null.
 */
function computeMessage(newLvl, lastLvl, newTag) {
    if (lastLvl === 0)
        return null; // first heading seen
    // Any h1 after a non-h1 is considered a reset-skip
    if (newLvl === 1 && lastLvl !== 1) {
        return `Heading level skipped: <${newTag}> after <h${lastLvl}>`;
    }
    // Upward skip (e.g. h2 -> h4)
    if (newLvl > lastLvl + 1) {
        return `Heading level skipped: <${newTag}> after <h${lastLvl}>`;
    }
    // Downward skip (e.g. h6 -> h4)
    if (lastLvl > newLvl + 1) {
        return `Heading level skipped: <${newTag}> after <h${lastLvl}>`;
    }
    return null;
}
