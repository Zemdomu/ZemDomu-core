import { Rule } from "../linter";
/**
 * Enforce heading order by detecting skipped levels when opening subsections.
 *
 * Flags:
 *  - Upward skip:   h2 -> h4 (new > last + 1)
 * First heading in a file never warns.
 * Returning to a lower rank closes subsections and is valid (for example h4 -> h2).
 */
export default function enforceHeadingOrder(): Rule;
