# Video Lens Brand And Video Stats Design

## Product Identity

- Use `片语` as the primary Chinese product and UI name.
- Use `Video Lens` in English prose and `video-lens` for the package, repository, code identifiers, metadata namespace, logs, DOM data attributes, and storage prefixes.
- Rename the GitHub repository from `video-summary` to `video-lens` after the implementation PR is merged, then update the local `origin` URL.
- Keep the local checkout directory and internal `.vs-*` Shadow DOM CSS classes unchanged. Neither is user-facing product identity, and renaming the CSS prefix would add broad UI regression risk without functional value.

## Backward-Compatible Storage Migration

- Define new configuration and cache keys under `video-lens:*`.
- When a new key is absent, read the corresponding legacy `video-summary:*` key, validate it with the existing parser, and write the value to the new key.
- Keep legacy values in place for rollback compatibility; new writes only target the new keys.
- Apply the same compatibility rule to Tampermonkey storage and localStorage fallbacks.
- Move ChatGPT bridge job/result/heartbeat/acknowledgement keys to the new prefix. Bridge pages running the updated script use only the new protocol keys; persisted user configuration is migrated before bridge initialization.
- Rename runtime globals, singleton claims, boot attributes, and log prefixes from Video Summary to Video Lens. Compatibility aliases are only retained where an already-loaded duplicate script could otherwise start twice.

## Creator Followers

- Add `creatorFollowers?: number` to platform-neutral `VideoInfo`; follower count is creator metadata, not a video engagement statistic.
- Extend Bilibili video parsing with owner `mid`.
- Prefer a follower count already present in Bilibili page state. If unavailable and `mid` exists, fetch Bilibili relation statistics and parse the non-negative follower count.
- Failure to fetch followers is non-fatal: the video card renders all other metadata and omits the follower item.
- YouTube only provides subscriber count when the configured official API response exposes it reliably; otherwise the item is omitted rather than guessed.

## Video Card Layout

- Render a 3×3 Description grid in this order: UP 主, 粉丝, 上传时间, 播放, 弹幕, 评论, 点赞, 投币, 收藏.
- Omit unavailable fields without inserting placeholders. The remaining fields preserve relative order and fill the grid naturally.
- Narrow layouts continue to use two columns.
- All icons use the current UP-owner icon's size, color, and alignment rules.

## Bilibili Icon Fidelity

- Inspect the current Bilibili video page as the primary reference for play, danmaku, comment, like, coin, and favorite shapes.
- Store equivalent inline SVG paths in the userscript so Shadow DOM rendering does not depend on Bilibili iconfont classes or host-page CSS.
- Use a Bilibili-style follower/person icon for the follower item and keep the existing owner/person icon for UP 主.
- Normalize every icon to one view box and visual bounding box so their baselines and optical sizes align.

## Verification And Delivery

- Add tests for Bilibili owner/follower parsing, non-fatal follower fetch failure, metadata order, compact follower formatting, and storage migration.
- Update harness fixtures for the complete 3×3 grid and inspect desktop and narrow layouts.
- Run strict TypeScript unused checks, `pnpm test`, `pnpm build`, JSON parsing, and `git diff --check`.
- Push a ready PR, merge after checks pass, rename the GitHub repository, update `origin`, and verify the merged commit through the new repository URL.
