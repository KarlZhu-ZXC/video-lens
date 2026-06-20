# Summary Concurrency And Video Stats Design

## Scope

Improve summary loading alignment and configuration density, make multi-chunk summaries complete and faster through bounded concurrency, add available video engagement statistics, and remove the fixed-intent heading. Preserve existing provider-specific subtitle behavior.

## Empty And Pending Alignment

- The initial assistant summary message must occupy the full conversation width.
- Both the empty-summary state and the pending state (`请求已发出 / 正在等待模型返回第一段内容`) must center their contents horizontally and vertically within the available summary output area.
- Reasoning-only streaming remains governed by the existing expanded `Thinking` disclosure and must not show either empty or pending copy.

## Configuration Chips

- Reduce all three configuration chips from approximately 30 px to 26 px minimum height.
- Reduce vertical padding and icon size proportionally while preserving the current colors and pill shape.
- Give the subtitle select chip a 130 px target width, wider than the first compact pass but still substantially narrower than the old 210 px chip.
- Truncate the selected subtitle label in the closed chip when necessary; the native select menu continues to expose complete option labels.
- Render all configuration-chip text, including the current subtitle select value, in white. Keep the existing purple, green, and neutral icon accent colors.

## Bounded Chunk Concurrency

- Transcript chunks are independent and run with a concurrency limit of two.
- Store each result by its original chunk index so merge input remains in subtitle order regardless of completion order.
- Report completed progress as `已完成 x/y 段字幕摘要`.
- Do not publish chunk summary text through the summary `onDelta` channel. Chunk processing updates status only, so intermediate chunks never enter the final summary DOM.
- A chunk result must contain non-whitespace summary content.
- Retry an empty chunk result once. A second empty result fails the task with `第 x/y 段未返回摘要内容`.
- A thrown request error fails the task normally; do not silently convert it into a partial successful summary.
- Respect the existing abort signal before scheduling more chunk work and pass it into every request.
- Start the merge only after all chunks have completed successfully.

## Merge Rendering And Completeness

- During merge streaming, publish only actual merged content and reasoning. Do not substitute the concatenated chunk summaries while waiting for the first merged-content token.
- Treat a merge result as incomplete when it is empty, equivalent to one individual chunk summary, or visibly identifies itself as only one chunk such as `第 1/3 段` / `Chunk 1/3` while multiple chunks exist.
- Retry an incomplete merge once with the same complete ordered chunk input.
- If the second merge is still incomplete, fail with an explicit overall-merge error. Do not render chunk summaries as a fallback or present them as the final summary.
- Preserve `chunkSummaries` on the completed result for diagnostics and future rendering changes.

## Video Statistics

- Add an optional `stats` object to `VideoInfo` with `views`, `danmaku`, `comments`, `likes`, `coins`, and `favorites` numeric fields.
- Bilibili reads all available values from `videoData.stat` or `x/web-interface/view.data.stat`.
- YouTube page/player metadata supplies views when exposed. When the official API path is used, request `statistics` and map available view, like, and comment counts.
- Render only finite non-negative values. Missing values are omitted rather than displayed as zero.
- Format compact counts for the current UI language, including Chinese `万`/`亿` units where applicable.
- Add outline icons semantically close to Bilibili controls: play triangle, danmaku rectangle, comment bubble, thumbs-up, coin, and star. Use the same color, 15 px size, stroke width, and alignment as existing creator/time metadata icons.
- Keep creator and upload time first, followed by available statistics in the order: views, danmaku, comments, likes, coins, favorites.
- Render creator, upload time, and all available statistics in one Description-style equal-width grid rather than a wrapping inline row.
- With all Bilibili fields available, use four columns and two rows: creator, upload time, views, danmaku; then comments, likes, coins, favorites.
- Left-align content inside each equal-width cell, truncate long creator/time values, and expose the complete value through the existing title tooltip.
- Omit unavailable fields and let remaining items fill the grid in the same order. At very narrow panel widths, reduce to two columns to preserve readability.

## Fixed Intent Presentation

- Keep the three existing fixed intent buttons and dispatch behavior.
- Remove the visible `意图识别` heading and the now-unneeded label spacing.
- Render all fixed-intent button text in white while preserving the existing subtle border and background treatment.
- Retain an accessible region label for assistive technology.

## Verification

- Unit tests cover concurrency never exceeding two, original-order merge input, completed-count progress without chunk-body deltas, empty-result retry, terminal empty failure, merge retry, and terminal incomplete-merge failure.
- Provider parsing tests cover Bilibili initial-state/API statistics and YouTube available statistics.
- Formatting tests cover compact counts and missing-value omission.
- Style tests cover full-width assistant empty/pending states, reduced chip height, the 130 px subtitle chip, white configuration/intent text, and removal of the visible intent label.
- Harness fixtures include populated Bilibili statistics in the 4×2 Description grid and centered empty/pending scenarios at normal and narrow widths.
- Run `pnpm test`, `pnpm build`, JSON parsing, `git diff --check`, and local harness visual inspection before completion.

## Out Of Scope

- Fetching additional YouTube statistics without an already configured official API path.
- Displaying unavailable metrics as zero.
- Unbounded parallel requests or a user-configurable concurrency setting.
- Changes to subtitle discovery, ranking, or translation.
