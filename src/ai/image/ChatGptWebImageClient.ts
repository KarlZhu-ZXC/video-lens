import type { LocalConfig } from '../../store/types';
import type { ImageAiClient } from './ImageAiClient';
import type { GeneratedImage, ImageGenerationRequest } from './types';
import {
  CHATGPT_IMAGE_ACK_KEY,
  CHATGPT_IMAGE_HEARTBEAT_KEY,
  CHATGPT_IMAGE_HEARTBEAT_MAX_AGE_MS,
  CHATGPT_IMAGE_JOB_KEY,
  CHATGPT_IMAGE_JOB_TIMEOUT_MS,
  CHATGPT_IMAGE_RESULT_KEY,
  assembleImageChunks,
  chatGptImageChunkKey,
  createChatGptImageJob,
  normalizeChatGptProjectUrl,
  type ChatGptImageHeartbeat,
  type ChatGptImageResult,
} from './chatgptBridgeProtocol';
import { gmChatGptBridgeRuntime, type ChatGptBridgeRuntime } from './chatgptBridgeRuntime';

export class ChatGptWebImageClient implements ImageAiClient {
  constructor(
    private readonly config: LocalConfig['imageAi'],
    private readonly runtime: ChatGptBridgeRuntime = gmChatGptBridgeRuntime,
    private readonly createId: () => string = defaultJobId,
    private readonly chunkWaitMs = 10_000,
  ) {}

  async generateImage(request: ImageGenerationRequest, options?: { signal?: AbortSignal }): Promise<GeneratedImage> {
    const projectUrl = normalizeChatGptProjectUrl(this.config.chatgptConversationUrl);
    const heartbeat = getLiveChatGptImageReceiver(projectUrl, this.runtime);
    const job = createChatGptImageJob({
      id: this.createId(),
      prompt: request.prompt,
      source: request.context?.source ?? 'video',
      sourceId: request.context?.sourceId ?? '',
      targetReceiverId: heartbeat?.receiverId,
      now: this.runtime.now(),
      timeoutMs: CHATGPT_IMAGE_JOB_TIMEOUT_MS,
    });

    return new Promise<GeneratedImage>((resolve, reject) => {
      let settled = false;
      let readingImage = false;
      let listenerId = 0;
      const timeout = globalThis.setTimeout(
        () => finish(() => reject(new Error('ChatGPT 网页生图超时，请检查专用会话页面'))),
        CHATGPT_IMAGE_JOB_TIMEOUT_MS,
      );
      const onAbort = () => finish(() => reject(new DOMException('用户已取消生图', 'AbortError')));
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeout);
        if (listenerId) this.runtime.removeValueChangeListener(listenerId);
        options?.signal?.removeEventListener('abort', onAbort);
        this.runtime.deleteValue(CHATGPT_IMAGE_JOB_KEY);
        action();
      };
      const handleResult = (raw: unknown) => {
        const result = raw as ChatGptImageResult | undefined;
        if (!result || result.version !== 1 || result.jobId !== job.id) return;
        if (result.status === 'failed') {
          finish(() => reject(new Error(result.error || 'ChatGPT 网页生图失败')));
          return;
        }
        if (result.status !== 'succeeded' || !result.image) return;
        if (readingImage) return;
        readingImage = true;
        void waitForImageChunks(
          this.runtime,
          job.id,
          result.image.chunkCount ?? 0,
          this.chunkWaitMs,
        ).then((chunks) => {
          if (settled) return;
          const dataUrl = chunks.length
            ? assembleImageChunks(result.image?.mimeType ?? 'image/png', chunks)
            : undefined;
          chunks.forEach((_chunk, index) => this.runtime.deleteValue(chatGptImageChunkKey(job.id, index)));
          this.runtime.setValue(CHATGPT_IMAGE_ACK_KEY, {
            version: 1,
            jobId: job.id,
            status: 'consumed',
            updatedAt: this.runtime.now(),
          });
          finish(() => resolve({
            dataUrl,
            url: result.image?.url,
            mimeType: result.image?.mimeType,
            raw: result,
          }));
        }).catch((error) => {
          for (let index = 0; index < (result.image?.chunkCount ?? 0); index += 1) {
            this.runtime.deleteValue(chatGptImageChunkKey(job.id, index));
          }
          finish(() => reject(error));
        });
      };

      listenerId = this.runtime.addValueChangeListener(CHATGPT_IMAGE_RESULT_KEY, handleResult);
      options?.signal?.addEventListener('abort', onAbort, { once: true });
      if (options?.signal?.aborted) {
        onAbort();
        return;
      }
      if (!heartbeat) this.runtime.openTab(projectUrl);
      this.runtime.setValue(CHATGPT_IMAGE_JOB_KEY, job);
      handleResult(this.runtime.getValue<ChatGptImageResult | undefined>(CHATGPT_IMAGE_RESULT_KEY, undefined));
    });
  }

}

async function waitForImageChunks(
  runtime: ChatGptBridgeRuntime,
  jobId: string,
  chunkCount: number,
  waitMs: number,
): Promise<string[]> {
  if (!chunkCount) return [];
  const intervalMs = 50;
  const attempts = Math.max(1, Math.ceil(waitMs / intervalMs) + 1);
  let missingIndex = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const chunks = Array.from({ length: chunkCount }, (_, index) =>
      runtime.getValue(chatGptImageChunkKey(jobId, index), ''),
    );
    missingIndex = chunks.findIndex((chunk) => !chunk);
    if (missingIndex < 0) return chunks;
    if (attempt < attempts - 1) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`ChatGPT 图片分块缺失：${missingIndex + 1}/${chunkCount}`);
}

export function getLiveChatGptImageReceiver(
  projectUrl: string,
  runtime: ChatGptBridgeRuntime = gmChatGptBridgeRuntime,
): ChatGptImageHeartbeat | undefined {
  const heartbeat = runtime.getValue<ChatGptImageHeartbeat | undefined>(CHATGPT_IMAGE_HEARTBEAT_KEY, undefined);
  if (!heartbeat || heartbeat.version !== 1 || !heartbeat.receiverId || !heartbeat.updatedAt) return undefined;
  const age = runtime.now() - heartbeat.updatedAt;
  if (age < 0 || age > CHATGPT_IMAGE_HEARTBEAT_MAX_AGE_MS) return undefined;
  try {
    return normalizeChatGptProjectUrl(heartbeat.url) === normalizeChatGptProjectUrl(projectUrl)
      ? heartbeat
      : undefined;
  } catch {
    return undefined;
  }
}

function defaultJobId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `chatgpt_${uuid}` : `chatgpt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
