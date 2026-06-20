# Summary Chat UI Stability Design

## Goal

Make image-mode configuration unambiguous and keep the summary conversation visually stable while content streams. Empty, streaming, completed, and failed states must expose only actions that are valid in that state.

## Image Mode Forms

The image-generation selector owns two independent field groups:

- `API 生图` shows Base URL, API Key, and model only.
- `ChatGPT 网页生图` shows ChatGPT Project URL and its operational hint only.

Switching mode hides the inactive group without clearing its saved values. A general `[hidden]` rule inside the Shadow DOM must override field layout declarations so hidden groups cannot remain visible due to `.vs-field { display: grid; }`.

Validation and connectivity testing continue to use only the active mode. API and ChatGPT Project cache identities remain separate.

## Stable Streaming Rendering

The visible jump is caused by full panel replacement on every `streamchange`: the new scroll container starts at `scrollTop = 0`, then a later animation frame restores the bottom. Repeating that sequence for every token creates a top-to-bottom flash.

`statechange` remains the structural render event. During initial summary generation, `streamchange` updates only the existing `.vs-output-content` node with `updateSummaryOutput()`. The shell, conversation container, composer, and scroll container remain mounted.

When the user is already near the bottom, the existing scroll container is moved to its current `scrollHeight` immediately after the content patch and corrected once on the next animation frame. When the user has scrolled away from the bottom, the previous `scrollTop` is preserved. A stale scheduled correction must not override a newer user scroll intent.

Chat follow-up streaming may initially retain the structural render path, but it must use synchronous scroll restoration before paint so consecutive renders never expose the temporary top position. The implementation should avoid emitting duplicate structural and stream events for one terminal image result.

## Static Video Context

The video thumbnail card, model-configuration row, and subtitle selector are page context, not conversation messages. They are mounted above the conversation scroll container and remain visible while summary and chat content scrolls.

Their order is:

1. Video thumbnail card.
2. Model-configuration row.
3. Subtitle selector, when multiple subtitle sources are available.

This reverses the current card/configuration order. Only the summary response and follow-up conversation messages belong to the scroll container.

## Summary Toolbar

The summary toolbar is absent while there is no completed summary, while the summary is pending, and while summary content is streaming. It appears only when `state.summary` contains the completed result.

The toolbar has no special surface fill or separator border. Its background is transparent and its spacing visually belongs to the assistant message. Summary and message-level function buttons align to the left and use the same transparent treatment.

## Empty Summary Composer

When neither a cached nor current completed summary exists:

- The textarea is disabled.
- Its placeholder is `请先生成总结`.
- The action button is labelled `开始总结` and invokes `generateSummary()`.
- Pressing Enter cannot submit a question.

While summary generation is busy, the textarea and button remain disabled. After a completed summary is available, the textarea becomes editable, its normal question placeholder returns, and the action button becomes the normal send action.

## Image Failure Behavior

Image failures remain visible in the conversation as `生成图片失败：<reason>`. The same full message is also forced into the existing top toast so the failure remains visible even if the conversation is long or its scroll position changes.

The image branch must not swallow an exception without updating global status. A terminal image failure produces one assistant failure message, one top toast, and no duplicate user or assistant messages.

## GM Listener Compatibility

The userscript metadata continues to request `GM_addValueChangeListener`. If the API is unavailable at runtime but `GM_getValue` exists, the ChatGPT bridge runtime falls back to polling the watched key at a short fixed interval and invokes the same callback only when the serialized value changes. Removing the listener clears the polling timer.

If neither change listeners nor readable GM storage is available, the bridge reports a clear permission error through both the conversation and top toast. Polling is a compatibility fallback, not a second protocol.

## Testing

Automated coverage must prove:

- Only the active image-mode field group is visible.
- Saved inactive-mode values survive mode changes.
- Initial summary `streamchange` patches the existing output instead of rebuilding the panel.
- The video card precedes the configuration row and subtitle selector; all three remain outside the conversation scroll container.
- Bottom-stick and manual-scroll behavior operate on the same mounted scroll element.
- Rapid consecutive updates do not expose or preserve a temporary top position.
- The summary toolbar is absent before and during generation and appears after completion.
- Toolbar styling is transparent, borderless, and left-aligned.
- Empty-summary textarea and Enter behavior are disabled while the button starts summary generation.
- Completed-summary composer restores normal question sending.
- Image failures create a conversation message and top toast.
- Missing `GM_addValueChangeListener` uses polling and listener removal clears it.

The UI harness should verify `settings-chatgpt`, API settings, empty summary, streaming summary, completed summary, and image failure states. Required completion checks remain `pnpm test` and `pnpm build`.

## Out Of Scope

- Redesigning the overall panel, typography, color system, or navigation rail.
- Replacing the native DOM UI framework.
- Changing summary prompts, subtitle acquisition, or image-generation provider behavior.
- Adding a new notification system.
