export const CHATGPT_IMAGE_JOB_KEY = 'video_lens_chatgpt_image_job_v1';
export const CHATGPT_IMAGE_RESULT_KEY = 'video_lens_chatgpt_image_result_v1';
export const CHATGPT_IMAGE_ACK_KEY = 'video_lens_chatgpt_image_ack_v1';
export const CHATGPT_IMAGE_HEARTBEAT_KEY = 'video_lens_chatgpt_image_heartbeat_v1';
export const CHATGPT_IMAGE_CHUNK_PREFIX = 'video_lens_chatgpt_image_chunk_';
export const CHATGPT_IMAGE_CHUNK_SIZE = 512 * 1024;
export const CHATGPT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const CHATGPT_IMAGE_JOB_TIMEOUT_MS = 5 * 60 * 1000;
export const CHATGPT_IMAGE_HEARTBEAT_MAX_AGE_MS = 30 * 1000;

export interface ChatGptImageJob {
  version: 1;
  id: string;
  prompt: string;
  source: string;
  sourceId: string;
  targetReceiverId?: string;
  createdAt: number;
  expiresAt: number;
}

export type ChatGptImageResultStatus = 'accepted' | 'submitting' | 'generating' | 'succeeded' | 'failed';

export interface ChatGptImageResult {
  version: 1;
  jobId: string;
  receiverId: string;
  status: ChatGptImageResultStatus;
  updatedAt: number;
  error?: string;
  image?: {
    mimeType?: string;
    chunkCount?: number;
    url?: string;
  };
}

export interface ChatGptImageHeartbeat {
  version: 1;
  receiverId: string;
  url: string;
  updatedAt: number;
}

export interface ChatGptImageAcknowledgement {
  version: 1;
  jobId: string;
  status: 'consumed';
  updatedAt: number;
}

export interface ChatGptProjectLocation {
  projectId: string;
  rootUrl: string;
}

export function parseChatGptProjectUrl(value: string): ChatGptProjectLocation {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('请填写有效的 ChatGPT Project URL');
  }
  const match = /^\/g\/(g-p-[^/]+)\/project\/?$/.exec(parsed.pathname);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'chatgpt.com' || !match) {
    throw new Error('请填写有效的 ChatGPT Project URL');
  }
  return {
    projectId: match[1],
    rootUrl: `${parsed.origin}/g/${match[1]}/project`,
  };
}

export function normalizeChatGptProjectUrl(value: string): string {
  return parseChatGptProjectUrl(value).rootUrl;
}

export function createChatGptImageJob(input: {
  id: string;
  prompt: string;
  source: string;
  sourceId: string;
  targetReceiverId?: string;
  now?: number;
  timeoutMs?: number;
}): ChatGptImageJob {
  const now = input.now ?? Date.now();
  return {
    version: 1,
    id: input.id,
    prompt: input.prompt,
    source: input.source,
    sourceId: input.sourceId,
    targetReceiverId: input.targetReceiverId,
    createdAt: now,
    expiresAt: now + (input.timeoutMs ?? CHATGPT_IMAGE_JOB_TIMEOUT_MS),
  };
}

export function isChatGptImageJobExpired(job: ChatGptImageJob, now = Date.now()): boolean {
  return now > job.expiresAt;
}

export function chatGptImageChunkKey(jobId: string, index: number): string {
  return `${CHATGPT_IMAGE_CHUNK_PREFIX}${jobId}_${index}`;
}

export function splitImageDataUrl(dataUrl: string): { mimeType: string; chunks: string[] } {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new Error('ChatGPT 图片不是有效的 Base64 data URL');
  const chunks: string[] = [];
  for (let offset = 0; offset < match[2].length; offset += CHATGPT_IMAGE_CHUNK_SIZE) {
    chunks.push(match[2].slice(offset, offset + CHATGPT_IMAGE_CHUNK_SIZE));
  }
  return { mimeType: match[1], chunks };
}

export function assembleImageChunks(mimeType: string, chunks: string[]): string {
  if (!chunks.length) throw new Error('ChatGPT 图片分块为空');
  return `data:${mimeType};base64,${chunks.join('')}`;
}
