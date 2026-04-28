# WCAG Rule Backlog

This file tracks WCAG-backed rule ideas for ZemDomu Core. It is intentionally focused on rules that can become useful diagnostics for HTML, JSX/TSX, and Vue templates without requiring a full browser runtime.

Current implemented rules are `ZMD001` through `ZMD021`. New rule codes should continue after `ZMD021` when promoted from this backlog.

Sources used for this backlog:
- [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
- [W3C: What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

## Recommended Build Order

1. Add low-noise semantic rules first: `ariaValidAttrName`, `ariaRoleValidity`, `noAriaHiddenFocusable`, and `noNonInteractiveClickHandlers`.
2. Add form and structure rules next: `labelInName`, `identifyInputPurposeAutocomplete`, `metaViewportAllowsZoom`, and `tableHeadersAssociated`.
3. Add higher-context warning rules after that: `mediaRequiresCaptionsOrTranscript`, `statusMessageRole`, and `formErrorAssociation`.
4. Keep target size, focus-obscured, redundant-entry, and accessible-authentication checks as docs/manual audit guidance until ZemDomu has browser-based verification.

## Static Rule Candidates

| Priority | Candidate rule | WCAG fit | Why add it | First implementation shape | False-positive risk |
| --- | --- | --- | --- | --- | --- |
| P0 | `ariaValidAttrName` | 4.1.2 Name, Role, Value | ZemDomu validates some ARIA values, but misspelled attributes like `aria-labl` silently remove semantics. | Validate literal `aria-*` attributes against known ARIA attribute names in HTML, JSX, and Vue. Ignore spreads and dynamic attribute names. | Low |
| P0 | `ariaRoleValidity` | 4.1.2 Name, Role, Value | Invalid roles and missing required role states are common custom-widget failures. | Start with invalid role tokens, abstract roles, and a small required-prop set such as `role="checkbox"` requiring `aria-checked`. | Low to medium |
| P0 | `noAriaHiddenFocusable` | 4.1.2 Name, Role, Value; 2.1.1 Keyboard | Focusable content hidden from the accessibility tree creates silent keyboard stops. | Flag focusable elements with `aria-hidden="true"` and focusable descendants inside static `aria-hidden="true"` containers. Treat disabled, `hidden`, `inert`, and `tabindex="-1"` as safe. | Low |
| P0 | `noNestedInteractive` | 4.1.2 Name, Role, Value; 2.1.1 Keyboard | Nested links/buttons/controls produce broken names, focus behavior, and click targets. | Flag lowercase DOM interactive descendants inside links, buttons, inputs, selects, textareas, and elements with interactive roles. | Low |
| P1 | `noNonInteractiveClickHandlers` | 2.1.1 Keyboard; 4.1.2 Name, Role, Value | `<div onClick>` and similar patterns often block keyboard and assistive-tech users. | For lowercase DOM elements, warn on click handlers without native semantics, role, focusability, and keyboard handlers. Prefer suggesting native `<button>`. | Medium |
| P1 | `labelInName` | 2.5.3 Label in Name | Voice-control users need visible labels to match the accessible name. Current name checks do not catch visible text overridden by unrelated `aria-label`. | Compare literal visible text with literal `aria-label` on buttons, links, and form controls. Warn when visible label is not contained in the accessible name. | Medium |
| P1 | `identifyInputPurposeAutocomplete` | 1.3.5 Identify Input Purpose | Common personal-data fields should expose purpose for autofill and cognitive support. | Use strong signals from `type`, `name`, `id`, and associated label text; validate common tokens such as `email`, `name`, `tel`, `username`, `current-password`, `new-password`, and `one-time-code`. | Medium |
| P1 | `metaViewportAllowsZoom` | 1.4.4 Resize Text; 1.4.10 Reflow | `user-scalable=no` and restrictive `maximum-scale` block zoom and reflow workflows. | In full HTML documents, flag viewport meta content that disables scaling or caps zoom too tightly. | Low |
| P1 | `tableHeadersAssociated` | 1.3.1 Info and Relationships | Captions help, but data tables also need programmatic header relationships. | For tables with `<th>`, require simple `scope` patterns or valid `headers`/`id` mappings for complex tables. Avoid layout-table enforcement. | Medium |
| P1 | `mediaRequiresCaptionsOrTranscript` | 1.2.1 Audio-only and Video-only; 1.2.2 Captions; 1.2.3 Audio Description or Media Alternative; 1.2.5 Audio Description | Audio/video accessibility is high impact and currently uncovered. | Warn on obvious `<video controls>` without `<track kind="captions">`; warn on `<audio controls>` without a nearby transcript link or text alternative cue. | Medium to high |
| P2 | `requireVisibleFocusStyle` | 2.4.7 Focus Visible; 2.4.13 Focus Appearance | Design systems often remove default outlines and forget replacements. | Heuristic warning for `outline: none`, `outline: 0`, Tailwind `focus:outline-none`, or similar without nearby `focus-visible`, ring, border, underline, or shadow focus styling. | Medium to high |
| P2 | `requireStatusMessageRole` | 4.1.3 Status Messages | Toasts, save confirmations, async errors, and result counts need programmatic announcements. | Warn on status-like class/component names or explicit status copy without `role="status"`, `role="alert"`, or `aria-live`. Keep warning-level. | Medium to high |
| P2 | `formErrorAssociation` | 3.3.1 Error Identification; 3.3.3 Error Suggestion | Error text should be associated with the affected field. | When markup already declares `aria-invalid="true"` or static error text/class names near a field, require `aria-describedby` or `aria-errormessage` to point at the error. | Medium |
| P2 | `noColorOnlyState` | 1.4.1 Use of Color | Required, error, success, and selected states should not be communicated only through hue. | Warn when state-like classes/attributes use color styling without text, icon, `aria-invalid`, `aria-current`, `aria-selected`, or similar non-color cues. | Medium to high |
| P2 | `noLowContrastTokenPairs` | 1.4.3 Contrast Minimum; 1.4.11 Non-text Contrast | Static contrast checks can catch obvious unreadable inline styles and token pairs. | Start with inline hex/rgb pairs and known Tailwind palette pairs. Document that computed backgrounds are out of scope. | Medium to high |

## Manual Or Browser-Based Candidates

These should be tracked in documentation or future browser verification rather than normal Core AST rules.

| Candidate | WCAG fit | Why keep out of Core for now |
| --- | --- | --- |
| Keyboard operability of dialogs and custom widgets | 2.1.1 Keyboard; 2.1.2 No Keyboard Trap; 2.4.3 Focus Order | Requires runtime tab order, focus trap, Escape behavior, and focus return testing. |
| Focus not obscured | 2.4.11 Focus Not Obscured (Minimum) | Requires layout, scroll, sticky header, and viewport evidence. |
| Target size minimum | 2.5.8 Target Size (Minimum) | Requires rendered size and spacing. Static class checks can be advisory only. |
| Accessible authentication | 3.3.8 Accessible Authentication (Minimum) | Requires flow-level checks for cognitive-function tests, password manager support, paste behavior, and alternatives. |
| Redundant entry | 3.3.7 Redundant Entry | Requires multi-step process awareness and stored user-input context. |
| Consistent help/navigation/identification | 3.2.6 Consistent Help; 3.2.3 Consistent Navigation; 3.2.4 Consistent Identification | Requires cross-page product comparison, not isolated component linting. |
| Language of parts | 3.1.2 Language of Parts | Static language detection is unreliable. A future narrow rule could catch explicit contradictory language cues. |

## Notes For Promotion

Before promoting a candidate into `RULE_CODES`, define:
- Rule name and next `ZMD` code.
- HTML, JSX/TSX, and Vue fixtures.
- Good and bad examples for Hub docs.
- Quick-fix policy: safe automatic edit, placeholder edit, or no quick fix.
- Expected false-positive strategy: default severity, opt-out advice, and framework caveats.

