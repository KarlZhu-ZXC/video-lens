# Summary Presets And Panel Animation Design

Date: 2026-06-21

## Goal

Add a complete scale transition between the mascot launcher and the panel, make the
summary preset a global setting, add a single custom prompt, and introduce the
timeline preset adapted from the GreasyFork reference script.

The existing `src/prompts/defaultPrompts.ts` remains unchanged for later v1/v2
comparison. All built-in prompt wording changes belong in
`src/prompts/defaultPrompts.v2.ts`.

Reference:
https://greasyfork.org/en/scripts/574935-b%E7%AB%99%E7%9C%81%E6%B5%81%E5%8A%A9%E6%89%8B-%E5%AD%97%E5%B9%95ai%E6%91%98%E8%A6%81-pro/code

## Panel Transition

- Opening first scales and fades the mascot launcher out, then renders the panel
  with a short scale-and-fade entrance from the launcher side.
- Closing marks the panel as closing, waits for its scale-and-fade exit, then
  renders the launcher with a scale entrance.
- The transition lasts approximately 180-220 ms and ignores repeated clicks while
  it is active.
- Left and right panels use matching transform origins on their launcher-facing
  edge.
- `prefers-reduced-motion: reduce` disables staged delays and animations.
- Dragging the launcher continues to open the panel only for a click, not a drag.

## Preset Model

The v2 catalog exposes five selectable built-in summary presets:

- `summary_plain`
- `summary_detailed`
- `summary_critical`
- `summary_action`
- `summary_timeline`

Internal chunk, merge, and summary-chat prompts remain hidden from the settings
selector. A sixth `summary_custom` option represents one global user-authored
template. The custom template is stored as a deterministic custom preset and is
used verbatim for both output languages.

The General settings section contains:

1. Auto-run summary.
2. Preferred summary preset.
3. A custom prompt textarea, visible only when Custom is selected.

Saving Custom with empty text is rejected inline. Changing the selected preset or
custom text affects every video, just like the interface language setting. It does
not automatically regenerate an existing result.

## Prompt Improvements

Every v2 prompt will define evidence boundaries, output language, useful length,
Markdown hierarchy, and explicit rules for omitting unsupported sections.

- Plain: optimized for fast comprehension without unsupported value judgments.
- Detailed: separates outline, concepts, evidence, caveats, and transcript excerpts;
  excerpts are clearly identified as potentially containing subtitle/ASR errors.
- Critical: separates claims from supplied evidence and from facts requiring
  external verification. It must not invent opposing views or claim to fact-check
  from transcript-only evidence.
- Action: emits steps only when the source provides them; informational videos get
  grounded starting points instead of fabricated procedures or outcomes.
- Timeline: accepts only timestamp ranges already present in the formatted
  transcript and never guesses or rewrites timestamps.
- Chunk: produces an ordered, low-loss evidence ledger and preserves timestamp
  ranges when present.
- Merge: deduplicates chunk evidence, removes chunk markers, and applies the chosen
  target preset to the merged evidence.
- Summary chat: answers from supplied context, preserves timestamps when relevant,
  and states when evidence is absent.

## Summary Pipeline

For a short transcript, the selected v2 preset receives the source transcript
directly. For a long transcript:

1. The source is divided into ordered chunks.
2. The v2 chunk prompt creates compact evidence ledgers.
3. The v2 merge prompt receives the selected target prompt and all ledgers.
4. The final response follows the selected preset instead of a fixed generic
   structure.

When the timeline preset is selected, transcript lines are formatted as
`[MM:SS-MM:SS] text` before chunking. Other presets retain the existing plain-text
input.

The effective prompt content is hashed. The fingerprint participates in cache
lookup and is stored with each summary, preventing an edited custom prompt or a v2
prompt revision from reusing stale output with the same preset ID.

## Verification

- Unit tests cover selectable v2 presets, custom resolution, prompt fingerprints,
  timeline formatting, long-video target-preset propagation, and cache matching.
- Existing tests continue importing v1 where they specifically verify v1 stability;
  new runtime tests import v2.
- UI tests cover General-setting visibility and validation helpers.
- Animation helpers cover transition guards and reduced-motion timing.
- Harness checks opening, closing, both panel sides, reduced motion, built-in preset
  selection, custom prompt editing, and retained per-video subtitle selection.
- Final verification runs `pnpm test`, `pnpm build`, and `git diff --check`.

## Non-Goals

- No per-video preset picker in the summary view.
- No arbitrary create/delete/rename preset editor.
- No automatic translation of the custom prompt.
- No changes to `src/prompts/defaultPrompts.ts`.
