# Summary Interaction Consolidation Design

## Scope

Consolidate subtitle selection into the configuration row, expose streamed model reasoning in a collapsible timed section, simplify chat visuals, and add fixed follow-up intent shortcuts. Preserve Bilibili and YouTube provider behavior and do not add extra model requests.

## Subtitle Selection

- Remove the separate subtitle-source row from the summary context.
- Keep the captions chip as the single subtitle control.
- With two or more subtitle options, render the chip as a pill-shaped native select with a disclosure arrow and accessible label.
- With fewer than two options, render the existing non-interactive captions chip.
- Display the currently selected option label immediately. Fall back to the loaded transcript label when no matching option exists.
- Changing the select calls `updateSelectedSubtitle()` only. It must not fetch a transcript, clear the current summary, or trigger regeneration.
- The next explicit regeneration uses the selected subtitle through the existing controller flow.

## Reasoning Disclosure

- Apply the same reasoning UI to the initial summary and subsequent text answers.
- Record local reasoning timing independently of provider-specific metadata:
  - Start when the first non-empty reasoning delta arrives.
  - Stop when the first non-empty content delta arrives, or when the request completes if no content arrives earlier.
- While reasoning is streaming, render an expanded disclosure labeled `Thinking` with a downward chevron.
- Render reasoning as subdued Markdown below the label, followed by a subtle divider.
- When reasoning stops, collapse the disclosure automatically and label it `Thought for <duration>` with a right-pointing chevron.
- Users can expand a completed disclosure to review the reasoning.
- If no reasoning is returned, render no disclosure.
- While reasoning exists but content is still empty, render the disclosure instead of the empty-summary state.
- Store elapsed reasoning milliseconds on completed summary/chat result objects so cached summaries keep a stable label.

## Chat Visuals

- Remove the mascot avatar from the initial assistant summary and all subsequent assistant messages.
- Remove the corresponding avatar column/indent so assistant content uses the available width.
- Make user-message bubbles use the same background token as the chat composer/input region while retaining user-side alignment.

## Fixed Intent Shortcuts

- Define follow-up intents as data objects so model-provided suggestions can replace the local list later without changing rendering or dispatch.
- The first version contains exactly:
  - `提炼核心观点`
  - `列出行动建议`
  - `生成配图`
- Render the intent area below the toolbar of only the latest completed assistant response, including the initial completed summary.
- Do not render intents while a text/image request is running or on older assistant responses.
- Clicking an intent immediately hides that intent area and calls the same controller path as manually sending the identical text.
- The resulting user message must contain the option text unchanged.
- A newly completed assistant response receives a fresh intent area.

## State And Data Flow

- Extend summary and assistant-message data with optional reasoning timing fields.
- Controller streaming callbacks own timing because they observe both reasoning and content boundaries.
- UI rendering remains pure: it receives reasoning text, timing, and streaming state and decides disclosure presentation.
- Keep subtitle selection in existing `selectedSubtitleId`; no new provider state is introduced.
- Derive intent visibility from the latest completed assistant response and idle request state. Clicking an intent enters the existing outgoing-message flow synchronously, so no separate persisted "consumed" flag is needed.

## Verification

- Unit tests cover subtitle chip labels and change dispatch without regeneration.
- Unit tests cover reasoning-only streaming, automatic completion/collapse, duration formatting, and no-reasoning responses.
- Unit tests cover intent visibility on only the latest completed assistant response, exact prompt dispatch, and immediate removal after click.
- Style assertions cover composer-matched user bubbles, absent avatar layout, reasoning divider, and interactive captions chip.
- Update summary harness fixtures to include streaming and completed reasoning plus fixed intents.
- Inspect the relevant harness scenarios at desktop and narrow panel widths when practical.
- Run `pnpm test` and `pnpm build` before completion.

## Out Of Scope

- Model-generated follow-up questions.
- Automatic summary regeneration when a subtitle changes.
- Provider-specific reasoning duration metadata.
- Changes to subtitle discovery, translation, or ranking.
