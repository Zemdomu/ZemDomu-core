import { Rule } from "../linter";
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
export default function enforceHeadingOrder(): Rule;
