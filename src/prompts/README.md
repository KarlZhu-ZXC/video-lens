# Prompt Map

Text-model prompt templates live in this folder.

- `defaultPrompts.ts`: preserved v1 prompt catalog for comparison.
- `defaultPrompts.v2.ts`: active runtime catalog, including the timeline preset, prompt fingerprints, chunk/merge instructions, and summary chat.
- Runtime image-generation and connectivity-test prompt constants also live in `defaultPrompts.v2.ts`; call sites only render variables and send requests.
- `renderPrompt.ts`: replaces `{{variable}}` placeholders with runtime video, transcript, summary, or question values.

## Call Sites

- AI Summary: `summary_plain`, `summary_detailed`, `summary_critical`, `summary_action`, `summary_timeline`, or one global `summary_custom` preset.
  The selected template receives `title`, `upName`, `description`, `url`, and full `transcript`.
- Long-video chunking: `chunk_summary` creates ordered evidence per transcript chunk, then `merge_summary` applies the selected target preset over all chunk summaries.
- Unified summary chat: `video_insights_default`.
  It receives the current `title`, cached/generated `summary`, full `transcript`, and current `question`, then prepends trimmed chat history.
- Chat image generation does not call the text model. `src/summary/chatPipeline.ts` appends the current summary to a fixed local image prompt and calls the image client directly.
