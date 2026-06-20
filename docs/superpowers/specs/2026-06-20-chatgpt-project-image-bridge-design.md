# ChatGPT Project Image Bridge Design

## Goal

Use a configured ChatGPT Project as the browser-based image-generation backend. Every video image request creates a new chat inside that Project, returns the generated image to `video-summary`, and leaves the Project root ready for the next request.

API image generation remains a separate user-selectable mode. There is no automatic fallback between API and ChatGPT Web modes.

## Configuration

- Rename the ChatGPT Web setting to `ChatGPT Project URL`.
- Accept only canonical URLs shaped like `https://chatgpt.com/g/g-p-<project-id>/project`.
- Store the canonical Project root URL without query parameters or fragments.
- Existing `/c/<conversation-id>` values are invalid for Project mode and must produce an actionable validation message.
- Cache identity includes the selected image mode and canonical Project URL, keeping API and Project results isolated.

## Runtime Flow

### Ready State

The userscript runs on all `chatgpt.com` pages but publishes a receiver heartbeat only while the current page is the configured Project root. The video page uses that heartbeat to target the active receiver. If no matching receiver is alive, it opens the configured Project root in a background tab and writes an untargeted job.

### Job Submission

1. The receiver accepts a job only on the configured Project root.
2. It records the existing user-message IDs and image sources.
3. It fills the Project composer and sends the final image prompt.
4. Submission succeeds when a new user-message ID appears and its normalized text starts with the submitted prompt. Message count is not used because ChatGPT virtualizes old turns.
5. ChatGPT creates a new chat inside the Project. The receiver binds the job only after the new route can be verified as belonging to the configured Project, using the Project ID in the route or the rendered Project context. Unrelated navigation fails the job.

Each job starts from the Project root, so every generation creates an independent Project chat and cannot inherit context from a previous video.

### Image Detection And Return

The receiver observes assistant turns in the newly created chat and selects a complete image that was not present before the job. It attempts to download the image and return it as chunked Base64 data. If conversion fails but the generated asset has an HTTPS URL, it returns that URL as a fallback. Failures are published with the matching job ID and are never silently redirected to API generation.

The video-side client accepts only results for its own job, reconstructs chunked data, cleans temporary keys, caches the result under the Project-specific cache identity, and displays the image in the summary conversation.

### Reset

After publishing a terminal `succeeded` or `failed` result, the receiver waits briefly for cross-tab storage propagation, then navigates the same ChatGPT tab back to the configured Project root. Reloading creates a fresh receiver and heartbeat. The job key is already cleared by the video-side client after it consumes the terminal result, so the completed job cannot run again.

If the Project chat is manually navigated elsewhere during generation, the receiver fails the active job instead of accepting an image from an unrelated chat.

## Protocol Changes

- Job and result correlation remains based on `jobId`.
- Heartbeats identify the canonical Project root and receiver ID.
- A receiver may transition from the Project root to one job-bound child chat.
- Project-root reset happens only after a terminal result is published.
- Existing expiry, timeout, chunk-size, and maximum-image-size limits remain unchanged.

## UI Behavior

- The mode remains `ChatGPT Web` alongside `API`.
- Settings explain that each request creates a new chat inside the configured Project.
- Connectivity testing only verifies a live receiver on the exact Project root and does not submit a prompt.
- Errors distinguish invalid Project URLs, offline Project receivers, submission failures, generation timeouts, download failures, and unexpected navigation.

## Testing

Automated tests cover:

- Project URL canonicalization and rejection of ordinary conversation URLs.
- Exact Project-root heartbeat matching.
- Offline behavior opening the Project root.
- Submission confirmation when old messages are virtualized and the message count stays constant.
- Root-to-child route binding for one active job.
- Rejection of unrelated route changes.
- Image detection, chunk reconstruction, cleanup, and HTTPS fallback.
- Terminal reset scheduling.
- Two consecutive jobs producing two independent Project chats.
- API mode and Bilibili behavior remaining unchanged.

The completion gate is a real installed-userscript test in the user's Chrome session:

1. Start from the configured `生图` Project root.
2. Trigger image generation from a Bilibili summary.
3. Verify a new chat appears inside `生图` and contains the final image prompt.
4. Verify ChatGPT generates an image.
5. Verify the image appears in the Bilibili summary UI and can be downloaded.
6. Verify the ChatGPT tab returns to the `生图` Project root.
7. Trigger a second generation and verify it creates a different Project chat and also returns successfully.

## Out Of Scope

- Reusing one Project chat for multiple videos.
- Selecting a Project by display name instead of URL.
- Creating or editing ChatGPT Projects.
- API fallback when ChatGPT Web generation fails.
- Supporting non-ChatGPT browser image services in this bridge.
