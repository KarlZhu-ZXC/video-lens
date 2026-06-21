import { describe, expect, it, vi } from 'vitest';
import { ChatGptWebImageClient, getLiveChatGptImageReceiver } from '../src/ai/image/ChatGptWebImageClient';
import { createImageAiClient } from '../src/ai/image/createClient';
import {
  CHATGPT_IMAGE_HEARTBEAT_KEY,
  CHATGPT_IMAGE_JOB_KEY,
  CHATGPT_IMAGE_RESULT_KEY,
  CHATGPT_IMAGE_CHUNK_SIZE,
  CHATGPT_IMAGE_ACK_KEY,
  assembleImageChunks,
  chatGptImageChunkKey,
  createChatGptImageJob,
  isChatGptImageJobExpired,
  normalizeChatGptProjectUrl,
  parseChatGptProjectUrl,
  splitImageDataUrl,
} from '../src/ai/image/chatgptBridgeProtocol';
import {
  gmChatGptBridgeRuntime,
  parseBridgeValue,
  type ChatGptBridgeRuntime,
} from '../src/ai/image/chatgptBridgeRuntime';
import {
  CHATGPT_COMPOSER_SELECTORS,
  CHATGPT_ASSISTANT_MESSAGE_SELECTOR,
  CHATGPT_SEND_BUTTON_SELECTORS,
  CHATGPT_USER_MESSAGE_SELECTOR,
  isGeneratedImageCandidate,
  fetchBlobWithTimeout,
  isConfiguredProjectRoot,
  isProjectChildRoute,
  scheduleProjectReset,
  waitForJobAcknowledgement,
  selectSubmittedUserMessage,
  selectJobGeneratedImage,
  selectNewGeneratedImage,
  shouldAcceptChatGptImageJob,
} from '../src/ai/image/chatgptReceiver';
import { DirectOpenAIImageClient } from '../src/ai/image/DirectOpenAIImageClient';
import { DEFAULT_CONFIG, mergeConfigForTest } from '../src/store/configStore';
import { applyImageModeFieldVisibility, connectivityTestTooltip, settingsActionsDisabled, validateImageSettings } from '../src/ui/settingsModal';
import { imageConfigurationLabel } from '../src/ui/summaryView';
import { imageGenerationCacheIdentity } from '../src/app/AppController';
import { claimVideoSummaryDocumentRuntime, claimVideoSummaryRuntime } from '../src/runtime/singleton';
import { shouldPreserveDirtySettingsView } from '../src/ui/panel';
import { PANEL_STYLES } from '../src/ui/styles';

describe('ChatGPT image bridge configuration', () => {
  it('claims one runtime instance per page and rejects duplicate injection', () => {
    const target: Record<string, unknown> = {};
    expect(claimVideoSummaryRuntime(target)).toBe(true);
    expect(claimVideoSummaryRuntime(target)).toBe(false);
    const attributes = new Set<string>();
    const documentLike = {
      documentElement: {
        hasAttribute: (name: string) => attributes.has(name),
        setAttribute: (name: string) => { attributes.add(name); },
      },
    };
    expect(claimVideoSummaryDocumentRuntime(documentLike)).toBe(true);
    expect(claimVideoSummaryDocumentRuntime(documentLike)).toBe(false);
  });

  it('migrates legacy image settings to API mode without losing API values', () => {
    const config = mergeConfigForTest({
      imageAi: {
        ...DEFAULT_CONFIG.imageAi,
        apiUrl: 'https://images.example/v1/generations',
        apiKey: 'saved-key',
        model: 'saved-model',
      },
    });

    expect(config.imageAi.mode).toBe('api');
    expect(config.imageAi.apiUrl).toBe('https://images.example/v1/generations');
    expect(config.imageAi.apiKey).toBe('saved-key');
    expect(config.imageAi.model).toBe('saved-model');
    expect(config.imageAi.chatgptConversationUrl).toBe('');
  });

  it('creates the image client selected by the saved mode', () => {
    expect(createImageAiClient({ ...DEFAULT_CONFIG.imageAi, mode: 'api' })).toBeInstanceOf(DirectOpenAIImageClient);
    expect(
      createImageAiClient({
        ...DEFAULT_CONFIG.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
      }),
    ).toBeInstanceOf(ChatGptWebImageClient);
  });

  it('validates only fields used by the selected image mode', () => {
    expect(validateImageSettings({
      ...DEFAULT_CONFIG.imageAi,
      mode: 'chatgpt_web',
      apiUrl: '',
      apiKey: '',
      model: '',
      chatgptConversationUrl: 'https://chatgpt.com/g/g-p-abc/project',
    })).toBe('');
    expect(validateImageSettings({
      ...DEFAULT_CONFIG.imageAi,
      mode: 'chatgpt_web',
      chatgptConversationUrl: 'https://chatgpt.com/',
    })).toContain('ChatGPT Project');
    expect(validateImageSettings({ ...DEFAULT_CONFIG.imageAi, mode: 'api', apiKey: '' })).toBe('请填写生图模型 API Key');
  });

  it('recognizes only a fresh heartbeat for the configured conversation', () => {
    const runtime = createFakeBridgeRuntime();
    runtime.values.set(CHATGPT_IMAGE_HEARTBEAT_KEY, {
      version: 1,
      receiverId: 'receiver-live',
      url: 'https://chatgpt.com/g/g-p-abc/project',
      updatedAt: 9_000,
    });
    expect(getLiveChatGptImageReceiver('https://chatgpt.com/g/g-p-abc/project', runtime)?.receiverId).toBe('receiver-live');
    expect(getLiveChatGptImageReceiver('https://chatgpt.com/g/g-p-other/project', runtime)).toBeUndefined();
    runtime.values.set(CHATGPT_IMAGE_HEARTBEAT_KEY, {
      version: 1,
      receiverId: 'receiver-stale',
      url: 'https://chatgpt.com/g/g-p-abc/project',
      updatedAt: -30_001,
    });
    expect(getLiveChatGptImageReceiver('https://chatgpt.com/g/g-p-abc/project', runtime)).toBeUndefined();
  });

  it('keeps API and ChatGPT web cache identities separate and labels the selected mode', () => {
    const api = { ...DEFAULT_CONFIG.imageAi, mode: 'api' as const };
    const web = {
      ...DEFAULT_CONFIG.imageAi,
      mode: 'chatgpt_web' as const,
      chatgptConversationUrl: 'https://chatgpt.com/g/g-p-abc/project',
    };
    expect(imageGenerationCacheIdentity(api)).not.toBe(imageGenerationCacheIdentity(web));
    expect(imageConfigurationLabel(web, 'Unset')).toBe('ChatGPT Web');
    expect(imageConfigurationLabel(api, 'Unset')).toBe(api.model);
  });

  it('keeps an edited settings form stable and savable while a summary runs', () => {
    expect(settingsActionsDisabled(true)).toBe(false);
    expect(shouldPreserveDirtySettingsView('settings', true, false, true)).toBe(true);
    expect(shouldPreserveDirtySettingsView('settings', true, true, true)).toBe(false);
    expect(shouldPreserveDirtySettingsView('summary', true, false, true)).toBe(false);
  });

  it('explains that ChatGPT web connectivity checks do not generate an image', () => {
    expect(connectivityTestTooltip('chatgpt_web')).toContain('不会发送生图请求');
    expect(connectivityTestTooltip('chatgpt_web')).toContain('Project');
    expect(connectivityTestTooltip('chatgpt_web')).not.toContain('调用费用');
    expect(connectivityTestTooltip('api')).toContain('调用费用');
  });

  it('shows only the fields used by the selected image mode', () => {
    const apiFields = [{ hidden: false }, { hidden: false }];
    const webFields = [{ hidden: false }];

    applyImageModeFieldVisibility('chatgpt_web', apiFields, webFields);
    expect(apiFields.every((field) => field.hidden)).toBe(true);
    expect(webFields.every((field) => !field.hidden)).toBe(true);

    applyImageModeFieldVisibility('api', apiFields, webFields);
    expect(apiFields.every((field) => !field.hidden)).toBe(true);
    expect(webFields.every((field) => field.hidden)).toBe(true);
    expect(PANEL_STYLES).toContain('[hidden]');
  });
});

describe('ChatGPT image bridge protocol', () => {
  it('canonicalizes only a ChatGPT Project root URL', () => {
    expect(normalizeChatGptProjectUrl('https://chatgpt.com/g/g-p-abc123/project/?model=auto#top')).toBe(
      'https://chatgpt.com/g/g-p-abc123/project',
    );
    expect(parseChatGptProjectUrl('https://chatgpt.com/g/g-p-abc123/project').projectId).toBe('g-p-abc123');
    expect(() => normalizeChatGptProjectUrl('https://chatgpt.com/c/abc')).toThrow('ChatGPT Project');
  });

  it('creates a versioned expiring job addressed to the live receiver', () => {
    const job = createChatGptImageJob({
      id: 'job-1',
      prompt: 'draw a summary image',
      source: 'youtube',
      sourceId: 'video-1',
      targetReceiverId: 'receiver-1',
      now: 1_000,
      timeoutMs: 300_000,
    });

    expect(job).toEqual({
      version: 1,
      id: 'job-1',
      prompt: 'draw a summary image',
      source: 'youtube',
      sourceId: 'video-1',
      targetReceiverId: 'receiver-1',
      createdAt: 1_000,
      expiresAt: 301_000,
    });
    expect(isChatGptImageJobExpired(job, 301_001)).toBe(true);
    expect(isChatGptImageJobExpired(job, 301_000)).toBe(false);
  });

  it('splits and reconstructs image data without changing its bytes', () => {
    const payload = `data:image/png;base64,${'a'.repeat(CHATGPT_IMAGE_CHUNK_SIZE * 2 + 17)}`;
    const split = splitImageDataUrl(payload);

    expect(split.mimeType).toBe('image/png');
    expect(split.chunks).toHaveLength(3);
    expect(assembleImageChunks(split.mimeType, split.chunks)).toBe(payload);
  });
});

describe('ChatGPT bridge GM compatibility', () => {
  it('preserves raw Base64 chunk strings returned by GM storage', () => {
    expect(parseBridgeValue('iVBORw0KGgoAAAANSUhEUg==', '')).toBe('iVBORw0KGgoAAAANSUhEUg==');
  });

  it('polls GM storage when value-change listeners are unavailable and stops after removal', async () => {
    vi.useFakeTimers();
    try {
      let stored: unknown = { status: 'pending' };
      Object.defineProperty(globalThis, 'GM_addValueChangeListener', { configurable: true, value: undefined });
      Object.defineProperty(globalThis, 'GM_removeValueChangeListener', { configurable: true, value: undefined });
      Object.defineProperty(globalThis, 'GM_getValue', {
        configurable: true,
        value: (_key: string, fallback: unknown) => stored ?? fallback,
      });
      const callback = vi.fn();

      const listenerId = gmChatGptBridgeRuntime.addValueChangeListener('bridge-key', callback);
      await vi.advanceTimersByTimeAsync(500);
      expect(callback).not.toHaveBeenCalled();

      stored = { status: 'succeeded' };
      await vi.advanceTimersByTimeAsync(500);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ status: 'succeeded' });

      gmChatGptBridgeRuntime.removeValueChangeListener(listenerId);
      stored = { status: 'failed' };
      await vi.advanceTimersByTimeAsync(1_000);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ChatGPT web image client', () => {
  it('targets the live dedicated receiver and reconstructs its returned chunks', async () => {
    const runtime = createFakeBridgeRuntime();
    runtime.values.set(CHATGPT_IMAGE_HEARTBEAT_KEY, {
      version: 1,
      receiverId: 'receiver-live',
      url: 'https://chatgpt.com/g/g-p-test/project',
      updatedAt: runtime.now(),
    });
    runtime.onSet = (key, value) => {
      if (key !== CHATGPT_IMAGE_JOB_KEY) return;
      expect(value.targetReceiverId).toBe('receiver-live');
      runtime.setValue(chatGptImageChunkKey(value.id, 0), 'YWJj');
      runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
        version: 1,
        jobId: value.id,
        receiverId: 'receiver-live',
        status: 'succeeded',
        updatedAt: runtime.now(),
        image: { mimeType: 'image/png', chunkCount: 1, url: 'https://cdn.example/fallback.png' },
      });
    };
    const client = new ChatGptWebImageClient(
      {
        ...DEFAULT_CONFIG.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project?model=auto',
      },
      runtime,
      () => 'job-live',
    );

    await expect(client.generateImage({ model: '', prompt: 'draw this' })).resolves.toMatchObject({
      dataUrl: 'data:image/png;base64,YWJj',
      url: 'https://cdn.example/fallback.png',
      mimeType: 'image/png',
    });
    expect(runtime.openedUrls).toEqual([]);
    expect(runtime.values.has(chatGptImageChunkKey('job-live', 0))).toBe(false);
    expect(runtime.values.get(CHATGPT_IMAGE_ACK_KEY)).toMatchObject({
      version: 1,
      jobId: 'job-live',
      status: 'consumed',
    });
  });

  it('waits for image chunks that propagate after the success result', async () => {
    vi.useFakeTimers();
    try {
      const runtime = createFakeBridgeRuntime();
      runtime.onSet = (key, value) => {
        if (key !== CHATGPT_IMAGE_JOB_KEY) return;
        runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
          version: 1,
          jobId: value.id,
          receiverId: 'receiver-delayed',
          status: 'succeeded',
          updatedAt: runtime.now(),
          image: { mimeType: 'image/png', chunkCount: 2 },
        });
        setTimeout(() => runtime.setValue(chatGptImageChunkKey(value.id, 0), 'YW'), 50);
        setTimeout(() => runtime.setValue(chatGptImageChunkKey(value.id, 1), 'Jj'), 100);
      };
      const client = new ChatGptWebImageClient(
        {
          ...DEFAULT_CONFIG.imageAi,
          mode: 'chatgpt_web',
          chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
        },
        runtime,
        () => 'job-delayed',
      );

      const generated = client.generateImage({ model: '', prompt: 'draw this' });
      const assertion = expect(generated).resolves.toMatchObject({
        dataUrl: 'data:image/png;base64,YWJj',
        mimeType: 'image/png',
      });
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the dedicated conversation when no matching receiver is alive', async () => {
    const runtime = createFakeBridgeRuntime();
    runtime.onSet = (key, value) => {
      if (key !== CHATGPT_IMAGE_JOB_KEY) return;
      expect(value.targetReceiverId).toBeUndefined();
      runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
        version: 1,
        jobId: value.id,
        receiverId: 'receiver-new',
        status: 'succeeded',
        updatedAt: runtime.now(),
        image: { url: 'https://cdn.example/generated.png' },
      });
    };
    const client = new ChatGptWebImageClient(
      {
        ...DEFAULT_CONFIG.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
      },
      runtime,
      () => 'job-open',
    );

    await expect(client.generateImage({ model: '', prompt: 'draw this' })).resolves.toEqual({
      dataUrl: undefined,
      url: 'https://cdn.example/generated.png',
      mimeType: undefined,
      raw: expect.objectContaining({ jobId: 'job-open' }),
    });
    expect(runtime.openedUrls).toEqual(['https://chatgpt.com/g/g-p-test/project']);
  });

  it('ignores another job result and surfaces the matching receiver failure', async () => {
    const runtime = createFakeBridgeRuntime();
    runtime.onSet = (key, value) => {
      if (key !== CHATGPT_IMAGE_JOB_KEY) return;
      runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
        version: 1,
        jobId: 'another-job',
        receiverId: 'receiver-1',
        status: 'succeeded',
        updatedAt: runtime.now(),
        image: { url: 'https://cdn.example/wrong.png' },
      });
      runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
        version: 1,
        jobId: value.id,
        receiverId: 'receiver-1',
        status: 'failed',
        updatedAt: runtime.now(),
        error: 'ChatGPT 未生成图片',
      });
    };
    const client = new ChatGptWebImageClient(
      {
        ...DEFAULT_CONFIG.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
      },
      runtime,
      () => 'job-fail',
    );

    await expect(client.generateImage({ model: '', prompt: 'draw this' })).rejects.toThrow('ChatGPT 未生成图片');
  });

  it('removes partial image chunks when a returned chunk is missing', async () => {
    const runtime = createFakeBridgeRuntime();
    runtime.onSet = (key, value) => {
      if (key !== CHATGPT_IMAGE_JOB_KEY) return;
      runtime.setValue(chatGptImageChunkKey(value.id, 0), 'YWJj');
      runtime.setValue(CHATGPT_IMAGE_RESULT_KEY, {
        version: 1,
        jobId: value.id,
        receiverId: 'receiver-partial',
        status: 'succeeded',
        updatedAt: runtime.now(),
        image: { mimeType: 'image/png', chunkCount: 2 },
      });
    };
    const client = new ChatGptWebImageClient(
      {
        ...DEFAULT_CONFIG.imageAi,
        mode: 'chatgpt_web',
        chatgptConversationUrl: 'https://chatgpt.com/g/g-p-test/project',
      },
      runtime,
      () => 'job-partial',
      0,
    );

    await expect(client.generateImage({ model: '', prompt: 'draw this' })).rejects.toThrow('图片分块缺失');
    expect(runtime.values.has(chatGptImageChunkKey('job-partial', 0))).toBe(false);
    expect(runtime.values.has(chatGptImageChunkKey('job-partial', 1))).toBe(false);
  });
});

describe('summary toolbar styling', () => {
  it('keeps quick-action icons borderless and blended into the chat background', () => {
    const rule = /\.vs-output-tool \{([^}]*)\}/.exec(PANEL_STYLES)?.[1] ?? '';
    expect(rule).toContain('border: 0;');
    expect(rule).toContain('background: transparent;');
    expect(rule).toContain('box-shadow: none;');
  });
});

describe('ChatGPT image receiver', () => {
  const job = createChatGptImageJob({
    id: 'job-receiver',
    prompt: 'draw',
    source: 'bilibili',
    sourceId: 'BV1',
    targetReceiverId: 'receiver-a',
    now: 1_000,
    timeoutMs: 5_000,
  });

  it('accepts only unexpired jobs addressed to the receiver on the configured Project root', () => {
    expect(shouldAcceptChatGptImageJob(
      job,
      'receiver-a',
      'https://chatgpt.com/g/g-p-abc/project?model=auto',
      'https://chatgpt.com/g/g-p-abc/project',
      2_000,
    )).toBe(true);
    expect(shouldAcceptChatGptImageJob(job, 'receiver-b', 'https://chatgpt.com/g/g-p-abc/project', 'https://chatgpt.com/g/g-p-abc/project', 2_000)).toBe(false);
    expect(shouldAcceptChatGptImageJob(job, 'receiver-a', 'https://chatgpt.com/g/g-p-other/project', 'https://chatgpt.com/g/g-p-abc/project', 2_000)).toBe(false);
    expect(shouldAcceptChatGptImageJob(job, 'receiver-a', 'https://chatgpt.com/g/g-p-abc/project', 'https://chatgpt.com/g/g-p-abc/project', 6_001)).toBe(false);
  });

  it('accepts jobs only on the configured Project root and binds only child chats from that Project', () => {
    const projectRoot = 'https://chatgpt.com/g/g-p-abc/project';
    expect(isConfiguredProjectRoot(`${projectRoot}?model=auto`, projectRoot)).toBe(true);
    expect(isConfiguredProjectRoot('https://chatgpt.com/c/child', projectRoot)).toBe(false);
    expect(isProjectChildRoute({
      currentUrl: 'https://chatgpt.com/c/child',
      projectId: 'g-p-abc',
      projectContextHref: '/g/g-p-abc/project',
    })).toBe(true);
    expect(isProjectChildRoute({
      currentUrl: 'https://chatgpt.com/g/g-p-abc/c/child',
      projectId: 'g-p-abc',
    })).toBe(true);
    expect(isProjectChildRoute({
      currentUrl: 'https://chatgpt.com/g/g-p-6a357a38342081918dad2ca18bb9f9c7-sheng-tu/c/6a364c02-c6b4-83ea-9fb3-4f26c0d714e1',
      projectId: 'g-p-6a357a38342081918dad2ca18bb9f9c7',
    })).toBe(true);
    expect(isProjectChildRoute({
      currentUrl: 'https://chatgpt.com/c/child',
      projectId: 'g-p-6a357a38342081918dad2ca18bb9f9c7',
      projectContextHref: '/g/g-p-6a357a38342081918dad2ca18bb9f9c7-sheng-tu/project',
    })).toBe(true);
    expect(isProjectChildRoute({
      currentUrl: 'https://chatgpt.com/c/child',
      projectId: 'g-p-abc',
      projectContextHref: '/g/g-p-other/project',
    })).toBe(false);
  });

  it('resets the ChatGPT tab to the Project root only after the propagation delay', async () => {
    const navigate = vi.fn();
    const navigated = new Promise<void>((resolve) => {
      navigate.mockImplementation(() => resolve());
    });
    scheduleProjectReset('https://chatgpt.com/g/g-p-abc/project', navigate, 5);

    expect(navigate).not.toHaveBeenCalled();
    await navigated;
    expect(navigate).toHaveBeenCalledWith('https://chatgpt.com/g/g-p-abc/project');
  });

  it('waits for the video page to consume the result before resetting the Project tab', async () => {
    vi.useFakeTimers();
    try {
      const runtime = createFakeBridgeRuntime();
      runtime.values.set(CHATGPT_IMAGE_JOB_KEY, job);

      const acknowledged = waitForJobAcknowledgement(runtime, job.id, 1_000, 50);
      await vi.advanceTimersByTimeAsync(200);
      expect(runtime.values.get(CHATGPT_IMAGE_JOB_KEY)).toEqual(job);

      runtime.setValue(CHATGPT_IMAGE_ACK_KEY, {
        version: 1,
        jobId: job.id,
        status: 'consumed',
        updatedAt: runtime.now(),
      });
      await vi.advanceTimersByTimeAsync(50);
      await expect(acknowledged).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not treat a result without a successful consumption acknowledgement as acknowledged', async () => {
    vi.useFakeTimers();
    try {
      const runtime = createFakeBridgeRuntime();
      runtime.values.set(CHATGPT_IMAGE_JOB_KEY, job);

      const acknowledged = waitForJobAcknowledgement(runtime, job.id, 100, 50);
      runtime.deleteValue(CHATGPT_IMAGE_JOB_KEY);
      await vi.advanceTimersByTimeAsync(150);
      await expect(acknowledged).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows an untargeted job to be claimed by the matching Project receiver', () => {
    const untargeted = { ...job, targetReceiverId: undefined };
    expect(shouldAcceptChatGptImageJob(
      untargeted,
      'receiver-new',
      'https://chatgpt.com/g/g-p-abc/project',
      'https://chatgpt.com/g/g-p-abc/project',
      2_000,
    )).toBe(true);
  });

  it('filters icons and incomplete thumbnails while accepting a loaded generated image', () => {
    expect(isGeneratedImageCandidate({ src: 'https://google.com/favicon.ico', width: 512, height: 512, complete: true })).toBe(false);
    expect(isGeneratedImageCandidate({ src: 'https://cdn.example/avatar.png', width: 64, height: 64, complete: true })).toBe(false);
    expect(isGeneratedImageCandidate({ src: 'https://cdn.example/pending.png', width: 1024, height: 1024, complete: false })).toBe(false);
    expect(isGeneratedImageCandidate({
      src: 'https://files.oaiusercontent.com/generated.png',
      alt: 'Generated image',
      width: 1024,
      height: 1024,
      complete: true,
    })).toBe(true);
  });

  it('returns only an image that was not present before this job', () => {
    const candidates = [
      { src: 'https://files.oaiusercontent.com/old.png', width: 1024, height: 1024, complete: true },
      { src: 'https://files.oaiusercontent.com/new.png', width: 1024, height: 1024, complete: true },
    ];
    expect(selectNewGeneratedImage(new Set([candidates[0].src]), candidates)?.src).toBe(candidates[1].src);
    expect(selectNewGeneratedImage(new Set(candidates.map((item) => item.src)), candidates)).toBeUndefined();
  });

  it('finds a new image even when ChatGPT reuses an existing assistant message node', () => {
    const selected = selectJobGeneratedImage(
      new Set(['https://files.oaiusercontent.com/old.png']),
      [{
        messageWasPresentBefore: true,
        images: [{
          src: 'https://files.oaiusercontent.com/new-in-reused-turn.png',
          width: 1024,
          height: 1024,
          complete: true,
        }],
      }],
    );
    expect(selected?.src).toContain('new-in-reused-turn.png');
  });

  it('times out a stalled browser image fetch so the receiver can use its fallback', async () => {
    const stalledFetch = () => new Promise<Response>(() => undefined);
    await expect(fetchBlobWithTimeout('https://chatgpt.com/image.png', stalledFetch, 5)).rejects.toThrow(
      'ChatGPT 图片下载超时',
    );
  });

  it('keeps stable selector fallbacks for the current ChatGPT composer and send button', () => {
    expect(CHATGPT_COMPOSER_SELECTORS).toContain('#prompt-textarea');
    expect(CHATGPT_SEND_BUTTON_SELECTORS).toContain('[data-testid="send-button"]');
    expect(CHATGPT_ASSISTANT_MESSAGE_SELECTOR).toContain('[data-turn="assistant"]');
    expect(CHATGPT_USER_MESSAGE_SELECTOR).toContain('[data-turn="user"]');
  });

  it('confirms prompt submission when ChatGPT replaces an old user turn without increasing the turn count', () => {
    const prompt = 'Generate an image from this video summary';
    const selected = selectSubmittedUserMessage(
      new Set(['old-message-id']),
      [{ key: 'new-message-id', text: `${prompt}\nShow more` }],
      prompt,
    );

    expect(selected?.key).toBe('new-message-id');
  });
});

function createFakeBridgeRuntime(): ChatGptBridgeRuntime & {
  values: Map<string, any>;
  openedUrls: string[];
  onSet?: (key: string, value: any) => void;
} {
  const values = new Map<string, any>();
  const listeners = new Map<number, { key: string; callback: (newValue: unknown) => void }>();
  const openedUrls: string[] = [];
  let listenerId = 0;
  const runtime = {
    values,
    openedUrls,
    now: () => 10_000,
    getValue: <T>(key: string, fallback: T): T => values.has(key) ? values.get(key) : fallback,
    setValue(key: string, value: unknown) {
      values.set(key, value);
      for (const listener of listeners.values()) {
        if (listener.key === key) listener.callback(value);
      }
      runtime.onSet?.(key, value);
    },
    deleteValue(key: string) {
      values.delete(key);
    },
    addValueChangeListener(key: string, callback: (newValue: unknown) => void) {
      const id = ++listenerId;
      listeners.set(id, { key, callback });
      return id;
    },
    removeValueChangeListener(id: number) {
      listeners.delete(id);
    },
    openTab(url: string) {
      openedUrls.push(url);
    },
    onSet: undefined as ((key: string, value: any) => void) | undefined,
  };
  return runtime;
}
