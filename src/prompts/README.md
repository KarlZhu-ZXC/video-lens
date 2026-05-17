# Prompt Map

All prompt templates and tool prompt schemas live in this folder.

- `defaultPrompts.ts`: user-facing prompt presets and built-in task templates.
- `toolPrompts.ts`: function/tool schemas and system prompt fragments used to force structured outputs.
- `renderPrompt.ts`: replaces `{{variable}}` placeholders with runtime video, transcript, summary, or question values.

## Call Sites

- AI Summary: `summary_plain`, `summary_detailed`, `summary_critical`, or `summary_action`.
  The selected template receives `title`, `upName`, `description`, `url`, and full `transcript`.
- Long-video chunking: `chunk_summary` per transcript chunk, then `merge_summary` over all chunk summaries.
- Video Insights: `video_insights_default`.
  It receives the current `title`, cached/generated `summary`, full `transcript`, and current `question`, then prepends trimmed chat history.
- One Image JSON: `one_page_json` plus `writeOnePageJsonTool()`.
  It receives `title`, `upName`, `url`, and existing summary content. Tool arguments are parsed as the JSON payload when the provider supports tools.
- Image background prompt: `image_prompt` plus `IMAGE_PROMPT_SYSTEM_PROMPT` and `writeImagePromptTool()`.
  It receives the validated one-image JSON as pretty-printed `summary`, then returns an English image prompt for the image model.
