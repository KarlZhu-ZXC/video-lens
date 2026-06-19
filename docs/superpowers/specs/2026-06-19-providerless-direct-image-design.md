# Providerless Configuration And Direct Image Design

## Goal

Simplify AI configuration and generation flows:

- Text AI and image AI each use only `Base URL`, `API Key`, and `model`.
- Remove the text model provider concept from configuration and UI.
- Start text summarization as soon as the user clicks the floating launcher, while reusing a matching cached summary when available.
- Replace the structured one-image pipeline with direct image generation from a fixed local prompt plus the text summary.

## Configuration

The settings page keeps two independent sections:

1. Text model: `Base URL`, `API Key`, `model`, and connectivity test.
2. Image model: `Base URL`, `API Key`, `model`, and connectivity test.

Provider selectors, provider-specific model lists, provider labels, and provider defaults are removed. Both clients continue to use OpenAI-compatible request shapes and the existing automatic `fetch` to GM XHR fallback where applicable.

Legacy saved configuration is normalized on load. Existing text and image URL, key, and model values are retained; obsolete provider and mode fields are ignored. Saving writes the simplified shape.

## Launcher And Summary Flow

Clicking the floating launcher expands the panel on the summary tab and immediately starts the existing summary flow.

The summary flow retains its current cache key boundaries, including platform, video id, prompt, text model, language, and subtitle source. If a matching cached summary exists, it is displayed without an API request. Otherwise the controller reads the selected transcript and calls the text model. Repeated clicks while work is already running must not start duplicate requests.

Manual regeneration remains available and bypasses cache as it does today.

## Direct One-Image Flow

One-image generation requires an existing summary. It performs these steps:

1. Build an image prompt locally by replacing `{summary}` in this fixed template:

   ```text
   根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：

   {summary}
   ```

2. Call the configured image model directly.
3. Extract the returned image URL or Base64 data.
4. Cache and preview the generated image.
5. Allow the user to download the generated image.

There is no intermediate text-model call for prompt generation.

The following concepts are removed from the runtime and settings UI:

- One-image structured JSON generation and schema validation.
- Tool calls used to force one-image JSON.
- Browser HTML/CSS card composition and card templates.
- Text-card-only, AI-background, AI-image-only, and other one-image modes.
- One-image template and width settings that only served DOM card composition.

The image cache key includes the video identity, summary content, image model, image Base URL, and fixed prompt version so configuration or prompt changes cannot reuse an incompatible image.

## UI And Errors

The one-image tab shows a generated image preview rather than a composed DOM card. Its progress states are reduced to prompt preparation, image generation, completion, and failure. Regeneration bypasses the image cache.

Missing configuration errors identify the exact missing field in the relevant text or image section. Invalid or empty image responses produce a readable generation error and do not overwrite a previously valid cached image.

The image connectivity test remains a real lightweight request using the image model configuration. Text connectivity testing remains independent of image configuration.

## Compatibility Boundaries

- Bilibili and YouTube metadata and subtitle providers are unchanged.
- Bilibili `upName` compatibility remains unchanged, although direct image generation no longer consumes one-image JSON source fields.
- Summary, insights, subtitle selection, language behavior, and summary cache behavior remain unchanged except for launcher-triggered automatic execution.
- Existing cached structured one-image JSON and composed-card cache entries are no longer read. They may be removed by the existing clear-cache action.

## Verification

Tests cover:

- Legacy configuration migration and provider-free saving.
- Settings rendering and validation with only the two configuration triplets.
- Launcher click expanding the summary tab and starting summary generation once.
- Launcher-triggered cache reuse without a text API request.
- Exact fixed image prompt interpolation.
- Direct image client invocation, cache reuse, and forced regeneration.
- Removal of structured JSON and mode-dependent progress behavior.

Required completion checks:

```bash
pnpm test
pnpm build
```

The settings, summary, and one-image harness scenarios should also be inspected after the UI changes.
