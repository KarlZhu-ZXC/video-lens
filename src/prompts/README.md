# Prompt Map

Text-model prompt templates live in this folder.

- `defaultPrompts.ts`: user-facing prompt presets and built-in task templates.
- `renderPrompt.ts`: replaces `{{variable}}` placeholders with runtime video, transcript, summary, or question values.

## Call Sites

- AI Summary: `summary_plain`, `summary_detailed`, `summary_critical`, or `summary_action`.
  The selected template receives `title`, `upName`, `description`, `url`, and full `transcript`.
- Long-video chunking: `chunk_summary` per transcript chunk, then `merge_summary` over all chunk summaries.
- Unified summary chat: `video_insights_default`.
  It receives the current `title`, cached/generated `summary`, full `transcript`, and current `question`, then prepends trimmed chat history.
- Chat image generation does not call the text model. `src/summary/chatPipeline.ts` appends the current summary to a fixed local image prompt and calls the image client directly.
