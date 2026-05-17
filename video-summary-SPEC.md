# video-summary 项目 Specification

## 1. 项目目标

`video-summary` 是一个视频内容总结 userscript 项目。

V1 仅针对 Bilibili 视频页，自动获取视频信息和字幕，调用用户配置的文本模型生成摘要，再调用用户配置的图片模型生成视觉封面 / 背景，最后输出可保存的一图流总结。

V1 主链路：

```text
Bilibili 视频页
→ 识别 bvid / aid / cid / 标题 / UP 主 / 简介
→ 获取字幕
→ 文本模型生成结构化摘要
→ 长视频自动分块总结
→ 用户可继续追问
→ 文本模型生成一图流 JSON
→ 文本模型生成图片 prompt
→ 图片模型生成视觉图
→ 前端叠加中文信息图排版
→ 导出 PNG
```

---

## 2. V1 功能边界

### V1 必做

```text
1. Bilibili 视频信息识别
2. Bilibili 字幕获取
3. OpenAI-compatible 文本模型摘要
4. 长视频分块摘要
5. Prompt preset
6. 继续追问
7. 一图流结构化总结
8. 图片模型生成视觉图
9. 前端中文信息图排版
10. AI 图 + 中文信息层合成 PNG
11. 本地设置面板
12. 本地缓存
13. SPA 路由监听
```

### V1 不做

```text
1. 登录
2. 付费
3. 自建后端
4. 云端配置
5. 云端历史记录
6. 评论总结
7. 多平台视频支持
8. 浏览器插件版
9. 移动端适配
```

### V1 预留但不实现

```text
AuthProvider
BillingProvider
EntitlementProvider
RemoteTextClient
RemoteImageClient
RemoteConfigProvider
VideoSourceProvider for YouTube / X / 小红书 / 抖音
```

---

## 3. 项目命名

### Package name

```json
{
  "name": "video-summary",
  "version": "0.1.0"
}
```

### Userscript name

```js
// @name         Video Summary - Bilibili
```

### Namespace

```js
// @namespace    https://github.com/yourname/video-summary
```

### 本地存储 key

```ts
export const CONFIG_KEY = 'video_summary_config_v1';
export const SUMMARY_CACHE_KEY = 'video_summary_summary_cache_v1';
export const ONE_PAGE_CACHE_KEY = 'video_summary_one_page_cache_v1';
export const IMAGE_CACHE_KEY = 'video_summary_image_cache_v1';
```

---

## 4. 推荐技术栈

```text
TypeScript
Vite
vite-plugin-monkey
zod
html-to-image
```

安装：

```bash
npm i zod html-to-image
npm i -D typescript vite vite-plugin-monkey @types/tampermonkey
```

V1 不引入 React / Vue。先用：

```text
原生 DOM + Shadow DOM + TypeScript
```

原因：

```text
1. userscript 体积小
2. 样式隔离容易
3. 调试简单
4. 不需要复杂状态管理
```

---

## 5. Userscript Metadata

```ts
// ==UserScript==
// @name         Video Summary - Bilibili
// @namespace    https://github.com/yourname/video-summary
// @version      0.1.0
// @description  Bilibili 视频字幕摘要、继续追问、一图流总结与 AI 封面图生成
// @author       Karl
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.bilibili.com
// @connect      *.bilibili.com
// @connect      *
// @license      MIT
// ==/UserScript==
```

V1 自用可以 `@connect *`。以后公开发布时再收窄。

---

## 6. 目录结构

```text
video-summary/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── SPEC.md
├── LICENSE
│
├── src/
│   ├── main.ts
│   │
│   ├── app/
│   │   ├── AppController.ts
│   │   ├── AppState.ts
│   │   └── events.ts
│   │
│   ├── sources/
│   │   ├── VideoSourceProvider.ts
│   │   └── bilibili/
│   │       ├── BilibiliProvider.ts
│   │       ├── videoInfo.ts
│   │       ├── subtitle.ts
│   │       ├── routeWatcher.ts
│   │       └── types.ts
│   │
│   ├── ai/
│   │   ├── text/
│   │   │   ├── TextAiClient.ts
│   │   │   ├── DirectOpenAITextClient.ts
│   │   │   ├── RemoteTextClient.ts
│   │   │   ├── streamParser.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── image/
│   │   │   ├── ImageAiClient.ts
│   │   │   ├── DirectOpenAIImageClient.ts
│   │   │   ├── GenericImageClient.ts
│   │   │   ├── RemoteImageClient.ts
│   │   │   └── types.ts
│   │   │
│   │   └── chunking.ts
│   │
│   ├── summary/
│   │   ├── summaryPipeline.ts
│   │   ├── qaPipeline.ts
│   │   └── types.ts
│   │
│   ├── onePage/
│   │   ├── onePagePipeline.ts
│   │   ├── onePageSchema.ts
│   │   ├── imagePromptPipeline.ts
│   │   ├── composeOnePage.ts
│   │   ├── exportPng.ts
│   │   ├── types.ts
│   │   └── templates/
│   │       ├── classicTemplate.ts
│   │       ├── denseTemplate.ts
│   │       └── posterTemplate.ts
│   │
│   ├── prompts/
│   │   ├── promptTypes.ts
│   │   ├── defaultPrompts.ts
│   │   ├── renderPrompt.ts
│   │   └── originalPromptBaseline.ts
│   │
│   ├── store/
│   │   ├── configStore.ts
│   │   ├── summaryCache.ts
│   │   ├── onePageCache.ts
│   │   ├── imageCache.ts
│   │   └── types.ts
│   │
│   ├── ui/
│   │   ├── panel.ts
│   │   ├── settingsModal.ts
│   │   ├── summaryView.ts
│   │   ├── qaView.ts
│   │   ├── onePageView.ts
│   │   ├── components.ts
│   │   ├── styles.ts
│   │   └── types.ts
│   │
│   ├── backend/
│   │   ├── AuthProvider.ts
│   │   ├── BillingProvider.ts
│   │   ├── EntitlementProvider.ts
│   │   ├── RemoteConfigProvider.ts
│   │   └── nullProviders.ts
│   │
│   └── utils/
│       ├── dom.ts
│       ├── errors.ts
│       ├── json.ts
│       ├── logger.ts
│       ├── sleep.ts
│       ├── hash.ts
│       └── blob.ts
│
└── dist/
    └── video-summary.user.js
```

`sources/bilibili/` 是 V1 的唯一视频源实现。虽然 V1 只做 Bilibili，但这样以后加 YouTube、X、网页文章、播客转写时，不需要重构核心 pipeline。

---

## 7. VideoSourceProvider 抽象

V1 只有 Bilibili provider，但接口先抽出来。

```ts
export interface VideoInfo {
  source: 'bilibili';
  sourceId: string;
  bvid: string;
  aid?: number;
  cid: number;
  title: string;
  upName?: string;
  description?: string;
  duration?: number;
  url: string;
}

export interface SubtitleLine {
  from: number;
  to: number;
  text: string;
}

export interface Transcript {
  language?: string;
  lines: SubtitleLine[];
  plainText: string;
  charCount: number;
}

export interface VideoSourceProvider {
  name: string;

  match(url: string): boolean;

  getVideoInfo(): Promise<VideoInfo>;

  getTranscript(video: VideoInfo): Promise<Transcript>;

  watchRouteChange(callback: () => void): () => void;
}
```

Bilibili 实现：

```ts
export class BilibiliProvider implements VideoSourceProvider {
  name = 'bilibili';

  match(url: string): boolean {
    return url.includes('bilibili.com/video/') || url.includes('bilibili.com/list/');
  }

  async getVideoInfo(): Promise<VideoInfo> {
    return getBilibiliVideoInfo();
  }

  async getTranscript(video: VideoInfo): Promise<Transcript> {
    return getBilibiliTranscript(video);
  }

  watchRouteChange(callback: () => void): () => void {
    return watchBilibiliRouteChange(callback);
  }
}
```

---

## 8. 配置结构

```ts
export interface LocalConfig {
  schemaVersion: 1;

  source: {
    enabledSources: ['bilibili'];
  };

  providerMode: 'direct' | 'remote';

  textAi: {
    providerMode: 'direct' | 'remote';
    apiUrl: string;
    apiKey: string;
    model: string;
    modelList: string[];
    temperature: number;
    maxTokens: number;
    stream: boolean;
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
  };

  imageAi: {
    enabled: boolean;
    providerMode: 'direct' | 'remote';
    apiStyle: 'openai_images' | 'generic';
    apiUrl: string;
    apiKey: string;
    model: string;
    size: string;
    quality?: string;
    responseFormat: 'url' | 'b64_json' | 'auto';
    requestMode: 'fetch' | 'gm_xhr' | 'auto';
  };

  remote: {
    backendBaseUrl?: string;
  };

  summary: {
    autoRun: boolean;
    defaultPromptId: string;
    chunkTargetChars: number;
    chunkOverlapChars: number;
    maxChunks: number;
  };

  qa: {
    maxHistoryMessages: number;
  };

  onePage: {
    enabled: boolean;
    mode: 'text_card_only' | 'ai_image_background' | 'ai_image_only';
    defaultTemplate: 'classic' | 'dense' | 'poster';
    exportScale: number;
    width: number;
    includeQrCode: boolean;
  };

  ui: {
    position: 'right' | 'left';
    panelWidth: number;
    defaultTab: 'summary' | 'qa' | 'onePage' | 'settings';
    collapsed: boolean;
  };

  prompts: {
    customPresets: PromptPreset[];
  };
}
```

默认配置：

```ts
export const DEFAULT_CONFIG: LocalConfig = {
  schemaVersion: 1,

  source: {
    enabledSources: ['bilibili'],
  },

  providerMode: 'direct',

  textAi: {
    providerMode: 'direct',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
    modelList: ['gpt-4o-mini'],
    temperature: 0.7,
    maxTokens: 2000,
    stream: true,
    requestMode: 'auto',
  },

  imageAi: {
    enabled: true,
    providerMode: 'direct',
    apiStyle: 'openai_images',
    apiUrl: 'https://api.openai.com/v1/images/generations',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1024x1024',
    quality: 'medium',
    responseFormat: 'b64_json',
    requestMode: 'auto',
  },

  remote: {
    backendBaseUrl: '',
  },

  summary: {
    autoRun: false,
    defaultPromptId: 'summary_plain',
    chunkTargetChars: 8000,
    chunkOverlapChars: 500,
    maxChunks: 20,
  },

  qa: {
    maxHistoryMessages: 8,
  },

  onePage: {
    enabled: true,
    mode: 'ai_image_background',
    defaultTemplate: 'classic',
    exportScale: 2,
    width: 900,
    includeQrCode: false,
  },

  ui: {
    position: 'right',
    panelWidth: 420,
    defaultTab: 'summary',
    collapsed: false,
  },

  prompts: {
    customPresets: [],
  },
};
```

---

## 9. 图片模型设计

### 9.1 不建议让图片模型生成中文文字

V1 图片生成策略：

```text
图片模型负责：背景图、视觉主题、插画、信息图风格、氛围、图标感
前端负责：中文标题、结论、关键点、takeaways、来源信息
```

原因：

```text
1. 中文文字稳定性差
2. 直接生成的信息图不可编辑
3. 摘要内容容易被模型画错
4. 前端叠字更清晰
5. 导出 PNG 更可控
```

### 9.2 一图流模式

V1 支持三种模式：

```ts
export type OnePageMode =
  | 'text_card_only'
  | 'ai_image_background'
  | 'ai_image_only';
```

#### text_card_only

不调用图片模型，只生成中文信息卡片。

适合调试、无图片 API key、低成本模式。

#### ai_image_background

推荐默认模式。

```text
文本模型生成摘要
→ 文本模型生成一图流 JSON
→ 文本模型生成 image prompt
→ 图片模型生成无文字视觉背景
→ 前端叠加中文总结信息
→ 导出 PNG
```

#### ai_image_only

直接让图片模型生成整张图。

V1 支持，但不推荐作为默认。它适合生成封面感图片，不适合生成带大量中文内容的一图流。

---

## 10. ImageAiClient 接口

```ts
export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  responseFormat?: 'url' | 'b64_json' | 'auto';
  n?: number;
}

export interface GeneratedImage {
  blob?: Blob;
  dataUrl?: string;
  url?: string;
  mimeType?: string;
  raw?: unknown;
}

export interface ImageAiClient {
  generateImage(
    request: ImageGenerationRequest,
    options?: {
      signal?: AbortSignal;
    }
  ): Promise<GeneratedImage>;
}
```

---

## 11. DirectOpenAIImageClient

```ts
export class DirectOpenAIImageClient implements ImageAiClient {
  constructor(private config: LocalConfig['imageAi']) {}

  async generateImage(
    request: ImageGenerationRequest,
    options?: { signal?: AbortSignal }
  ): Promise<GeneratedImage> {
    if (this.config.requestMode === 'fetch') {
      return this.generateWithFetch(request, options);
    }

    if (this.config.requestMode === 'gm_xhr') {
      return this.generateWithGmXhr(request, options);
    }

    try {
      return await this.generateWithFetch(request, options);
    } catch {
      return this.generateWithGmXhr(request, options);
    }
  }

  private async generateWithFetch(
    request: ImageGenerationRequest,
    options?: { signal?: AbortSignal }
  ): Promise<GeneratedImage> {
    const res = await fetch(this.config.apiUrl, {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        response_format:
          request.responseFormat === 'auto'
            ? undefined
            : request.responseFormat,
        n: request.n ?? 1,
      }),
    });

    if (!res.ok) {
      throw new Error(`Image generation failed: ${res.status}`);
    }

    const json = await res.json();
    return parseGeneratedImage(json);
  }

  private async generateWithGmXhr(
    request: ImageGenerationRequest,
    options?: { signal?: AbortSignal }
  ): Promise<GeneratedImage> {
    // 用 GM_xmlhttpRequest 实现，绕过 CORS
    // V1 可以先只实现 fetch，gm_xhr 后补
    throw new Error('GM XHR image generation not implemented yet.');
  }
}
```

图片结果解析：

```ts
export function parseGeneratedImage(json: any): GeneratedImage {
  const item = json?.data?.[0];

  if (!item) {
    throw new Error('No image returned');
  }

  if (item.b64_json) {
    return {
      dataUrl: `data:image/png;base64,${item.b64_json}`,
      mimeType: 'image/png',
      raw: json,
    };
  }

  if (item.url) {
    return {
      url: item.url,
      raw: json,
    };
  }

  throw new Error('Unsupported image response format');
}
```

---

## 12. GenericImageClient

因为不同图片模型 API 格式不完全一致，V1 可以先做一个通用适配层。

```ts
export interface GenericImageApiConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  requestBodyTemplate: string;
  responsePath: string;
}
```

不过 V1 不建议优先做太泛化。建议 V1 只实现：

```text
DirectOpenAIImageClient
```

然后把 `GenericImageClient` 空出来。

```ts
export class GenericImageClient implements ImageAiClient {
  async generateImage(): Promise<GeneratedImage> {
    throw new Error('Generic image client is reserved for future versions.');
  }
}
```

---

## 13. 一图流 Pipeline

### 13.1 OnePagePipeline

```ts
export interface OnePagePipelineInput {
  video: VideoInfo;
  summary: SummaryResult;
  textAiClient: TextAiClient;
  imageAiClient?: ImageAiClient;
  config: LocalConfig;
  signal?: AbortSignal;
  onProgress?: (event: OnePageProgressEvent) => void;
}

export type OnePageProgressEvent =
  | { type: 'generating_json' }
  | { type: 'validating_json' }
  | { type: 'generating_image_prompt' }
  | { type: 'generating_ai_image' }
  | { type: 'rendering_card' }
  | { type: 'composing' }
  | { type: 'done' }
  | { type: 'error'; error: Error };

export interface OnePagePipelineResult {
  data: OnePageSummaryData;
  imagePrompt?: string;
  generatedImage?: GeneratedImage;
  composedElement: HTMLElement;
}
```

### 13.2 流程

```text
1. 检查是否已有 summary
2. 用 ONE_PAGE_JSON_PROMPT 生成 OnePageSummaryData
3. zod 校验 JSON
4. 用 IMAGE_PROMPT_FROM_SUMMARY 生成图片 prompt
5. 调用图片模型生成视觉图
6. 使用 onePage template 渲染中文信息层
7. 将图片作为 background / visual block
8. 组合成最终 HTMLElement
9. 用户导出 PNG
```

---

## 14. 一图流数据 Schema

```ts
import { z } from 'zod';

export const OnePageSummarySchema = z.object({
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  conclusion: z.string().min(1).max(100),
  keyPoints: z
    .array(
      z.object({
        title: z.string().min(1).max(20),
        detail: z.string().min(1).max(120),
      })
    )
    .min(3)
    .max(8),
  timeline: z
    .array(
      z.object({
        time: z.string().optional(),
        event: z.string().min(1).max(80),
      })
    )
    .max(8)
    .optional(),
  takeaways: z.array(z.string().min(1).max(80)).min(1).max(6),
  tags: z.array(z.string().min(1).max(20)).min(1).max(8),
  source: z.object({
    title: z.string(),
    upName: z.string().optional(),
    url: z.string(),
  }),
});

export type OnePageSummaryData = z.infer<typeof OnePageSummarySchema>;
```

---

## 15. Prompt 体系

### 15.1 PromptType

```ts
export type PromptType =
  | 'summary'
  | 'chunk_summary'
  | 'merge_summary'
  | 'qa'
  | 'one_page_json'
  | 'image_prompt'
  | 'comment_summary';
```

### 15.2 PromptPreset

```ts
export interface PromptPreset {
  id: string;
  name: string;
  type: PromptType;
  description?: string;
  icon?: string;
  template: string;
  builtIn: boolean;
}
```

### 15.3 Prompt Variables

```ts
export interface PromptVariables {
  title?: string;
  upName?: string;
  description?: string;
  url?: string;
  transcript?: string;
  chunkText?: string;
  chunkIndex?: number;
  totalChunks?: number;
  chunkSummaries?: string;
  summary?: string;
  question?: string;
  comments?: string;
}
```

渲染函数：

```ts
export function renderPrompt(
  template: string,
  variables: PromptVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key as keyof PromptVariables];
    return value == null ? '' : String(value);
  });
}
```

---

## 16. 默认 Prompt

### 16.1 原插件 baseline

放在：

```text
src/prompts/originalPromptBaseline.ts
```

```ts
export const ORIGINAL_SUMMARY_PROMPT = `我极度没有耐心，不想动脑子，脾气暴躁且阅读困难。请用最直白的大白话给我解释这视频到底在说什么，在能解释清楚的前提下废话越少越好，禁止使用任何专业术语。请按以下顺序直接输出：1.〖结论〗直接告诉我核心意思；2.〖具体讲了啥〗用极简的白话说明来龙去脉；3.〖关键点〗列出最重要的几个要点；4.〖对我有什么用〗直接说明价值，如果是纯广告或水视频请直接告诉我避雷；5.〖原链接〗在最后附上视频原始链接。记住，不要任何寒暄、铺垫和解释，直接开始回答！`;

export const ORIGINAL_COMMENT_PROMPT = `你是一个专业的评论分析助手。请对以下B站视频评论进行总结分析，包括：
1. 评论整体情感倾向（正面/负面/中性）
2. 主要讨论话题（列出3-5个）
3. 有趣/高赞评论摘录
4. 我理解能力差、没耐心，别讲铺垫、别讲背景、别讲废话，只告诉我：这东西核心结论是什么、有哪几个关键点、对我有什么用。`;

export const ORIGINAL_IMAGE_PROMPT = `根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：

{summary}`;
```

### 16.2 极简白话版

```ts
export const SUMMARY_PLAIN: PromptPreset = {
  id: 'summary_plain',
  name: '极简白话版',
  type: 'summary',
  icon: '⚡',
  builtIn: true,
  template: `你是一个极其擅长省流总结的中文助手。

我没有耐心，不想动脑子，阅读困难。请用最直白的大白话解释这个视频到底在说什么。在能解释清楚的前提下，废话越少越好。

禁止：
- 不要寒暄
- 不要铺垫
- 不要自我介绍
- 不要说“根据字幕”
- 不要堆专业术语

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请严格按以下结构输出：

# 结论
直接告诉我核心意思。

# 具体讲了啥
用极简白话说明来龙去脉。

# 关键点
列出最重要的几个要点。

# 对我有什么用
直接说明价值。如果是广告、水视频、标题党，请直接告诉我避雷。

# 原链接
{{url}}`,
};
```

### 16.3 详细笔记版

```ts
export const SUMMARY_DETAILED: PromptPreset = {
  id: 'summary_detailed',
  name: '详细笔记版',
  type: 'summary',
  icon: '📝',
  builtIn: true,
  template: `请基于视频字幕内容，生成一份结构清晰的中文学习笔记。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请使用 Markdown 输出，并包含：

# 主题概述
说明视频主题与核心论点。

# 内容大纲
用层级列表展示视频结构。

# 关键概念
解释视频中出现的重要概念、术语、人物或事件。

# 关键细节
列出视频中最值得记录的事实、例子、数据或推理过程。

# 金句摘录
提炼 3-5 条值得收藏的话。可以意译，不要编造。

# 个人启发
说明这个视频对观众的实际价值。

# 原链接
{{url}}`,
};
```

### 16.4 批判分析版

```ts
export const SUMMARY_CRITICAL: PromptPreset = {
  id: 'summary_critical',
  name: '批判分析版',
  type: 'summary',
  icon: '🔍',
  builtIn: true,
  template: `请以批判性思维审视这个视频。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请直接输出以下内容：

# 核心观点
视频到底想表达什么。

# 论据评估
UP 主用了哪些证据？这些证据是否充分？

# 逻辑漏洞
是否存在推理跳跃、偷换概念、片面表达、情绪煽动或选择性引用？

# 对立观点
可能有哪些反驳角度或不同视角？

# 内容质量判断
这个视频值得相信吗？是否可能是广告、带货、水视频或标题党？

# 我应该怎么处理
告诉我应该收藏、深入研究、谨慎参考，还是直接跳过。

# 原链接
{{url}}`,
};
```

### 16.5 行动清单版

```ts
export const SUMMARY_ACTION: PromptPreset = {
  id: 'summary_action',
  name: '行动清单版',
  type: 'summary',
  icon: '✅',
  builtIn: true,
  template: `请把视频内容转化为可执行的行动清单。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请输出：

# 核心收获
用一句话说清这个视频教了什么。

# 具体步骤
列出可立即执行的步骤，使用数字编号。

# 注意事项
列出容易踩的坑。

# 适用场景
说明什么情况下用得上。

# 预期效果
说明照做大概能达到什么效果。

# 原链接
{{url}}

要求：
- 保持简洁
- 重在可操作性
- 不要泛泛而谈`,
};
```

### 16.6 分段总结 Prompt

```ts
export const CHUNK_SUMMARY_PROMPT: PromptPreset = {
  id: 'chunk_summary_default',
  name: '分段总结',
  type: 'chunk_summary',
  icon: '🧩',
  builtIn: true,
  template: `你正在总结一个较长视频的第 {{chunkIndex}} / {{totalChunks}} 段字幕。

视频标题：{{title}}
UP 主：{{upName}}

当前字幕片段：
{{chunkText}}

请输出这一段的结构化总结：

# 本段主题
一句话说明本段主要讲什么。

# 本段关键点
列出 3-6 个要点。

# 重要细节
保留重要事实、例子、数字、判断、步骤。

# 与前后文可能的关系
说明这一段在整个视频中可能起什么作用。

要求：
- 不要总结整个视频，只总结当前片段
- 不要编造当前片段没有的信息
- 输出中文 Markdown`,
};
```

### 16.7 合并分段总结 Prompt

```ts
export const MERGE_SUMMARY_PROMPT: PromptPreset = {
  id: 'merge_summary_default',
  name: '合并分段总结',
  type: 'merge_summary',
  icon: '🧠',
  builtIn: true,
  template: `你已经拿到了一个长视频的分段总结。请把它们合并成一份完整、顺畅、去重的中文总结。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

分段总结：
{{chunkSummaries}}

请输出：

# 结论
直接说明这个视频最核心的意思。

# 视频讲了什么
用白话说明完整来龙去脉。

# 核心观点
合并重复内容后，列出最重要的观点。

# 关键细节
保留值得记录的事实、例子、步骤、数据或判断。

# 对我有什么用
说明这个视频对观众的实际价值。如果内容很水或像广告，请直接指出。

# 原链接
{{url}}

要求：
- 不要机械拼接
- 要去重
- 要有整体结构
- 不要编造分段总结里没有的信息`,
};
```

### 16.8 继续追问 Prompt

```ts
export const QA_PROMPT: PromptPreset = {
  id: 'qa_default',
  name: '视频追问',
  type: 'qa',
  icon: '💬',
  builtIn: true,
  template: `你是一个基于视频内容回答问题的助手。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

视频总结：
{{summary}}

用户问题：
{{question}}

请基于视频总结回答。要求：
- 优先使用视频中的信息
- 如果视频总结里没有足够信息，请明确说“不确定”
- 不要编造
- 回答要直接、清楚、简洁`,
};
```

### 16.9 一图流 JSON Prompt

```ts
export const ONE_PAGE_JSON_PROMPT: PromptPreset = {
  id: 'one_page_json_default',
  name: '一图流总结数据',
  type: 'one_page_json',
  icon: '🖼️',
  builtIn: true,
  template: `你是一个中文信息图内容策划助手。

请根据视频总结，生成适合制作“一图流总结”的结构化 JSON。

视频标题：{{title}}
UP 主：{{upName}}
视频链接：{{url}}

视频总结：
{{summary}}

要求：
1. 内容高度浓缩
2. 适合中文信息图排版
3. 标题要短
4. 每个点都要有信息密度
5. 不要输出 Markdown
6. 不要解释
7. 只输出合法 JSON

JSON 格式如下：

{
  "title": "不超过 28 个中文字符的标题",
  "subtitle": "可选副标题，不超过 36 个中文字符",
  "conclusion": "一句话总结，不超过 60 个中文字符",
  "keyPoints": [
    {
      "title": "观点标题，不超过 12 个中文字符",
      "detail": "观点解释，不超过 70 个中文字符"
    }
  ],
  "timeline": [
    {
      "time": "可选时间点，例如 03:20",
      "event": "关键事件、步骤或转折，不超过 50 个中文字符"
    }
  ],
  "takeaways": [
    "适合收藏的一句话，不超过 40 个中文字符"
  ],
  "tags": [
    "标签1",
    "标签2",
    "标签3"
  ],
  "source": {
    "title": "{{title}}",
    "upName": "{{upName}}",
    "url": "{{url}}"
  }
}

数量限制：
- keyPoints：3 到 6 个
- timeline：0 到 6 个
- takeaways：2 到 5 个
- tags：3 到 6 个`,
};
```

### 16.10 图片模型 Prompt

重点：要求图片模型不要生成中文文字。

```ts
export const IMAGE_PROMPT_FROM_SUMMARY: PromptPreset = {
  id: 'image_prompt_from_summary',
  name: '一图流视觉图 Prompt',
  type: 'image_prompt',
  icon: '🎨',
  builtIn: true,
  template: `You are creating a high-quality visual background for a Chinese video summary card.

Video title:
{{title}}

Video summary:
{{summary}}

Create an image prompt for an image generation model.

Requirements:
- The image should work as a visual background or cover illustration for a knowledge summary card.
- Do NOT include any readable text, letters, Chinese characters, numbers, subtitles, UI screenshots, logos, or watermarks.
- Use symbolic visual elements, clean composition, modern editorial design, and subtle information-graphics aesthetics.
- Leave enough empty space for Chinese text overlay.
- The visual style should be professional, clean, premium, and suitable for sharing on social media.
- Avoid clutter.
- Avoid photorealistic humans unless the video topic requires it.
- Prefer abstract, conceptual, cinematic, or editorial illustration style.

Return only the final image prompt in English. Do not explain.`,
};
```

如果想省一次文本模型调用，也可以直接用模板拼 image prompt：

```ts
export function buildImagePromptFromSummary(input: {
  title: string;
  summary: string;
}): string {
  return `
Create a clean, premium, modern editorial illustration as a background for a Chinese video summary card.

Topic: ${input.title}

Summary:
${input.summary}

Requirements:
- No text, no letters, no Chinese characters, no numbers, no logo, no watermark.
- Leave empty space for text overlay.
- Professional knowledge-sharing visual style.
- High contrast but not noisy.
- Suitable for social media cover.
`.trim();
}
```

V1 推荐先用这个简单函数，减少一次模型调用。后面再升级为文本模型生成 image prompt。

---

## 17. OnePage 模板合成方式

### 17.1 推荐最终画布结构

```text
one-page-card
├── background image layer
├── dark / light gradient overlay
├── title area
├── conclusion block
├── key points
├── takeaways
├── tags
└── source footer
```

### 17.2 组合函数

```ts
export interface ComposeOnePageInput {
  data: OnePageSummaryData;
  generatedImage?: GeneratedImage;
  templateId: OnePageTemplateId;
  width: number;
}

export function composeOnePage(
  input: ComposeOnePageInput
): HTMLElement {
  const root = document.createElement('div');
  root.className = `vs-one-page vs-template-${input.templateId}`;

  if (input.generatedImage?.dataUrl || input.generatedImage?.url) {
    const bg = document.createElement('div');
    bg.className = 'vs-one-page-bg';
    bg.style.backgroundImage = `url(${input.generatedImage.dataUrl ?? input.generatedImage.url})`;
    root.appendChild(bg);
  }

  const overlay = document.createElement('div');
  overlay.className = 'vs-one-page-overlay';
  root.appendChild(overlay);

  const content = renderOnePageTextLayer(input.data, input.templateId);
  root.appendChild(content);

  return root;
}
```

关键原则：

```text
所有中文内容用 textContent 插入，不用 innerHTML。
```

---

## 18. PNG 导出

```ts
import { toBlob } from 'html-to-image';

export async function exportOnePageAsPng(
  element: HTMLElement,
  options: {
    scale: number;
  }
): Promise<Blob> {
  const blob = await toBlob(element, {
    pixelRatio: options.scale,
    cacheBust: true,
  });

  if (!blob) {
    throw new Error('Failed to export PNG');
  }

  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
```

文件名：

```ts
export function buildPngFilename(video: VideoInfo): string {
  const safeTitle = video.title
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 40);

  return `video-summary-${safeTitle}-${video.bvid}.png`;
}
```

---

## 19. UI Specification

### 19.1 面板 Tabs

```text
摘要
追问
一图流
设置
```

### 19.2 摘要 Tab

包含：

```text
视频标题
模型选择
Prompt preset 选择
开始总结按钮
停止按钮
进度提示
摘要 Markdown / Text 展示
复制按钮
重新总结按钮
```

状态文案：

```text
等待开始
正在获取字幕
正在总结
正在总结第 2 / 6 段
正在合并总结
已完成
出错
```

### 19.3 追问 Tab

包含：

```text
摘要未生成时：提示先生成摘要
摘要已生成时：
- 对话历史
- 输入框
- 发送按钮
- 停止按钮
```

### 19.4 一图流 Tab

包含：

```text
当前摘要状态
一图流模式选择：
  - 纯信息卡片
  - AI 视觉背景 + 中文信息卡片
  - AI 直接出图

图片模型状态：
  - 未配置
  - 已配置
  - 正在生成图片
  - 图片生成失败

按钮：
  - 生成一图流
  - 重新生成文案
  - 重新生成图片
  - 更换模板
  - 导出 PNG
  - 清除缓存
```

### 19.5 设置 Tab / Modal

设置项：

```text
文本模型：
- API URL
- API Key
- 模型
- 模型列表
- temperature
- maxTokens
- 是否流式输出
- 请求模式 fetch / GM_xhr / auto

图片模型：
- 图片模型启用开关
- 图片 API URL
- 图片 API Key
- 图片模型名
- 图片尺寸
- 图片质量
- 响应格式 url / b64_json / auto
- 请求模式 fetch / GM_xmlhttpRequest / auto
- 测试图片模型按钮

摘要：
- 默认 Prompt
- 自定义 Prompt
- 分块大小
- 分块重叠

一图流：
- 默认模板
- 导出倍率
- 画布宽度
- 是否包含二维码

UI：
- 面板位置
- 面板宽度
- 默认 tab

数据：
- 导入配置
- 导出配置
- 清空缓存
```

---

## 20. AppController

```ts
export class AppController {
  private state: AppState;

  constructor(private deps: AppDeps) {}

  mount(): void {}

  async handleRouteChange(): Promise<void> {}

  async loadVideo(): Promise<void> {}

  async loadTranscript(): Promise<void> {}

  async startSummary(force?: boolean): Promise<void> {}

  stopCurrentTask(): void {}

  async askQuestion(question: string): Promise<void> {}

  async generateOnePage(options?: {
    forceText?: boolean;
    forceImage?: boolean;
  }): Promise<void> {}

  async regenerateOnePageImage(): Promise<void> {}

  async exportOnePagePng(): Promise<void> {}

  updateConfig(partial: Partial<LocalConfig>): Promise<void> {}
}
```

`AppController` 是唯一能串联 UI、Bilibili、AI、Store 的地方。

UI 不直接调用 API。

---

## 21. AppState

```ts
export interface AppState {
  status:
    | 'idle'
    | 'loading_video'
    | 'loading_transcript'
    | 'summarizing'
    | 'chatting'
    | 'generating_one_page_json'
    | 'generating_image'
    | 'composing_one_page'
    | 'done'
    | 'error';

  activeTab: 'summary' | 'qa' | 'onePage' | 'settings';

  video?: VideoInfo;
  transcript?: Transcript;
  summary?: SummaryResult;

  onePage?: {
    data?: OnePageSummaryData;
    imagePrompt?: string;
    generatedImage?: GeneratedImage;
    composedElement?: HTMLElement;
  };

  conversation: ChatMessage[];

  error?: AppError;

  currentAbortController?: AbortController;
}
```

---

## 22. TextAiClient

```ts
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  raw?: unknown;
}

export interface TextAiClient {
  chatCompletion(
    request: ChatCompletionRequest,
    options?: {
      signal?: AbortSignal;
      onDelta?: (delta: string) => void;
    }
  ): Promise<ChatCompletionResult>;
}
```

---

## 23. DirectOpenAITextClient

```ts
export class DirectOpenAITextClient implements TextAiClient {
  constructor(private config: LocalConfig['textAi']) {}

  async chatCompletion(
    request: ChatCompletionRequest,
    options?: {
      signal?: AbortSignal;
      onDelta?: (delta: string) => void;
    }
  ): Promise<ChatCompletionResult> {
    if (this.config.requestMode === 'fetch') {
      return this.chatWithFetch(request, options);
    }

    if (this.config.requestMode === 'gm_xhr') {
      return this.chatWithGmXhr(request, options);
    }

    try {
      return await this.chatWithFetch(request, options);
    } catch {
      return this.chatWithGmXhr(request, options);
    }
  }

  private async chatWithFetch(...) {}

  private async chatWithGmXhr(...) {}
}
```

说明：

```text
fetch：
- 优点：ReadableStream 处理流式输出更标准
- 缺点：容易遇到 provider CORS

GM_xmlhttpRequest：
- 优点：绕过 CORS
- 缺点：流式解析要用 onprogress 处理 responseText 增量
```

V1 建议：

```text
默认 auto
优先 fetch
失败后 fallback 到 GM_xmlhttpRequest
```

---

## 24. Bilibili 模块

### 24.1 getVideoInfo

```ts
export async function getBilibiliVideoInfo(): Promise<VideoInfo> {
  // 1. read window.__INITIAL_STATE__
  // 2. parse bvid from location.href
  // 3. fallback to DOM
  // 4. ensure cid exists
}
```

优先级：

```text
window.__INITIAL_STATE__.videoData
→ window.__INITIAL_STATE__.aid / bvid / cid
→ URL BV 号
→ DOM title / up name
→ B 站 API 补 cid
```

### 24.2 getTranscript

```ts
export async function getBilibiliTranscript(video: VideoInfo): Promise<Transcript> {
  // 1. fetch subtitle metadata
  // 2. select best subtitle
  // 3. fetch subtitle url
  // 4. normalize lines
}
```

字幕选择优先级：

```text
zh-CN
zh-Hans
ai-zh
中文
第一个可用字幕
```

错误类型：

```ts
export class NoSubtitleError extends Error {}
export class BiliApiError extends Error {}
export class SubtitleParseError extends Error {}
```

---

## 25. 摘要 Pipeline

```ts
export interface SummaryResult {
  video: VideoInfo;
  model: string;
  promptId: string;
  content: string;
  chunkSummaries?: string[];
  createdAt: number;
}

export interface SummaryPipelineInput {
  video: VideoInfo;
  transcript: Transcript;
  prompt: PromptPreset;
  textAiClient: TextAiClient;
  config: LocalConfig;
  signal?: AbortSignal;
  onProgress?: (event: SummaryProgressEvent) => void;
  onDelta?: (delta: string) => void;
}

export type SummaryProgressEvent =
  | { type: 'start' }
  | { type: 'short_summary' }
  | { type: 'chunking'; totalChunks: number }
  | { type: 'summarizing_chunk'; current: number; total: number }
  | { type: 'merging_chunks' }
  | { type: 'done' }
  | { type: 'error'; error: Error };
```

流程：

```text
1. 读取 transcript.charCount
2. 如果 <= chunkTargetChars，直接总结
3. 如果 > chunkTargetChars，切分 chunks
4. 每个 chunk 调用 chunk_summary prompt
5. 所有 chunk 完成后，调用 merge_summary prompt
6. 返回 SummaryResult
```

核心函数：

```ts
export async function runSummaryPipeline(
  input: SummaryPipelineInput
): Promise<SummaryResult> {}
```

---

## 26. 字幕分块算法

```ts
export function splitTranscriptIntoChunks(
  transcript: Transcript,
  options: {
    targetChars: number;
    overlapChars: number;
    maxChunks: number;
  }
): string[] {
  // 优先按 SubtitleLine 累加，不要从 plainText 中间硬切
}
```

规则：

```text
1. 优先按字幕行累加
2. 每块接近 targetChars
3. 块之间保留 overlapChars 近似重叠
4. 超过 maxChunks 时提示用户或强制继续
```

V1 可以先强制继续，但 UI 显示：

```text
检测到长视频，已切分为 N 段。
```

---

## 27. JSON 提取

AI 可能返回：

````markdown
```json
{...}
```
````

所以需要：

```ts
export function extractJsonObject(text: string): unknown {
  // 1. 去掉 markdown fence
  // 2. 找第一个 { 和最后一个 }
  // 3. JSON.parse
}
```

---

## 28. 路由监听

B 站是 SPA，需要监听：

```text
history.pushState
history.replaceState
popstate
```

实现：

```ts
export function watchBilibiliRouteChange(callback: () => void): () => void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(callback, 0);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(callback, 0);
    return result;
  };

  window.addEventListener('popstate', callback);

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', callback);
  };
}
```

切换视频后：

```text
停止当前任务
清空 transcript / summary / onePage
重新读取视频信息
更新 UI
```

---

## 29. 后端预留接口

### 29.1 AuthProvider

```ts
export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthProvider {
  getCurrentUser(): Promise<UserProfile | null>;
  getAccessToken(): Promise<string | null>;
  login(): Promise<void>;
  logout(): Promise<void>;
}
```

V1：

```ts
export class NullAuthProvider implements AuthProvider {
  async getCurrentUser() {
    return null;
  }

  async getAccessToken() {
    return null;
  }

  async login() {
    throw new Error('Login is not available in local mode.');
  }

  async logout() {}
}
```

### 29.2 EntitlementProvider

```ts
export interface Entitlement {
  plan: 'local' | 'free' | 'pro' | 'team';
  canUseRemoteAi: boolean;
  canUseOnePageSummary: boolean;
  canUseAiImage: boolean;
  maxVideoMinutes: number;
  monthlyQuota: number;
  usedQuota: number;
}

export interface EntitlementProvider {
  getEntitlement(): Promise<Entitlement>;
}
```

V1：

```ts
export class LocalEntitlementProvider implements EntitlementProvider {
  async getEntitlement(): Promise<Entitlement> {
    return {
      plan: 'local',
      canUseRemoteAi: false,
      canUseOnePageSummary: true,
      canUseAiImage: false,
      maxVideoMinutes: Infinity,
      monthlyQuota: Infinity,
      usedQuota: 0,
    };
  }
}
```

### 29.3 BillingProvider

```ts
export interface BillingProvider {
  createCheckoutSession(planId: string): Promise<{ url: string }>;
  openCustomerPortal(): Promise<{ url: string }>;
}
```

V1 不实现。

### 29.4 未来后端接口

```text
POST /api/ai/chat
POST /api/image/generate
POST /api/image/one-page-summary
POST /api/image/render
POST /api/billing/checkout
GET  /api/me
GET  /api/me/entitlement
GET  /api/config
PUT  /api/config
```

V1 只保留 `RemoteTextClient` / `RemoteImageClient` skeleton。

---

## 30. 缓存设计

### 30.1 Summary cache

```text
summary:${source}:${sourceId}:${cid}:${model}:${promptId}:${transcriptHash}
```

### 30.2 One-page JSON cache

```text
onepage:${source}:${sourceId}:${model}:${summaryHash}
```

### 30.3 Image cache

```text
image:${source}:${sourceId}:${imageModel}:${imagePromptHash}:${size}:${quality}
```

### 30.4 Cache item

```ts
export interface SummaryCacheItem {
  key: string;
  source: string;
  sourceId: string;
  cid?: number;
  title: string;
  model: string;
  promptId: string;
  transcriptHash: string;
  result: SummaryResult;
  createdAt: number;
}

export interface OnePageCacheItem {
  key: string;
  source: string;
  sourceId: string;
  title: string;
  model: string;
  summaryHash: string;
  data: OnePageSummaryData;
  createdAt: number;
}

export interface ImageCacheItem {
  key: string;
  source: string;
  sourceId: string;
  title: string;
  imageModel: string;
  imagePromptHash: string;
  size: string;
  quality?: string;
  image: GeneratedImage;
  createdAt: number;
}
```

限制：

```text
summary cache：最多 50 条
one-page cache：最多 50 条
image cache：最多 30 条
```

图片缓存可能比较大，如果用 base64，注意容量膨胀。V1 可以默认只缓存最近 10 张图片。

---

## 31. 错误处理

```ts
export type AppErrorCode =
  | 'NO_VIDEO'
  | 'NO_SUBTITLE'
  | 'BILI_API_ERROR'
  | 'TEXT_AI_CONFIG_MISSING'
  | 'TEXT_AI_REQUEST_FAILED'
  | 'TEXT_AI_STREAM_PARSE_FAILED'
  | 'IMAGE_AI_CONFIG_MISSING'
  | 'IMAGE_AI_REQUEST_FAILED'
  | 'IMAGE_AI_RESPONSE_INVALID'
  | 'AI_JSON_PARSE_FAILED'
  | 'ONE_PAGE_RENDER_FAILED'
  | 'PNG_EXPORT_FAILED'
  | 'ABORTED'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
  }
}
```

UI 文案：

```text
NO_SUBTITLE：
这个视频没有可用字幕。可以后续支持手动粘贴字幕。

TEXT_AI_CONFIG_MISSING：
请先在设置里填写文本 API URL、API Key 和模型。

TEXT_AI_REQUEST_FAILED：
文本模型请求失败，请检查 API、模型、额度或网络。

IMAGE_AI_CONFIG_MISSING：
请先在设置里填写图片 API URL、API Key 和模型。

IMAGE_AI_REQUEST_FAILED：
图片生成失败，请检查图片模型、额度、API URL 或网络。

IMAGE_AI_RESPONSE_INVALID：
图片接口返回格式无法识别。请检查 response format 设置。

AI_JSON_PARSE_FAILED：
一图流结构化数据解析失败，可以点击重新生成。

ABORTED：
已停止生成。
```

---

## 32. 安全原则

### 32.1 API Key

不要存：

```text
bilibili.com localStorage
```

使用：

```text
GM_setValue / GM_getValue
```

注意：GM storage 也不是绝对安全，只是比页面 localStorage 更适合 userscript。

### 32.2 日志

禁止打印：

```text
apiKey
完整 headers
完整 config
```

可以打印：

```text
source
sourceId
bvid
model
apiUrl hostname
status
error code
```

### 32.3 AI 输出

AI 返回内容视为不可信。

V1 建议：

```text
摘要内容按 text/markdown 方式展示
不要直接 innerHTML 渲染未消毒内容
一图流模板只插入 textContent
```

如果后续引入 Markdown renderer，需要配 DOMPurify。

---

## 33. V1 开发里程碑

### Milestone 0：项目初始化

```text
初始化 video-summary
配置 Vite + TypeScript + vite-plugin-monkey
生成 dist/video-summary.user.js
安装到 Tampermonkey
```

验收：

```text
打开 Bilibili 视频页，console 出现脚本启动日志。
```

### Milestone 1：Bilibili 面板

```text
Shadow DOM 面板
Tabs：摘要 / 追问 / 一图流 / 设置
```

验收：

```text
B 站页面右侧出现面板。
点击 tab 可以切换。
页面样式不被污染。
```

### Milestone 2：Bilibili 视频信息

```text
BilibiliProvider
getVideoInfo()
routeWatcher
```

验收：

```text
打开视频页能显示当前视频信息。
站内跳转另一个视频后，面板自动更新。
```

### Milestone 3：字幕获取

```text
getTranscript()
字幕语言选择
无字幕错误处理
```

验收：

```text
有字幕视频能展示字幕预览。
无字幕视频显示明确提示。
```

### Milestone 4：文本模型摘要

```text
ConfigStore
DirectOpenAITextClient
summaryPipeline
非流式摘要
```

验收：

```text
填写 API URL / Key / Model 后，可以生成摘要。
```

### Milestone 5：流式输出和停止

```text
fetch stream parser
AbortController
停止生成
GM_xmlhttpRequest fallback 可后置
```

验收：

```text
摘要可以流式输出。
点击停止后请求终止。
```

### Milestone 6：长视频分块

```text
splitTranscriptIntoChunks()
chunk_summary
merge_summary
进度显示
```

验收：

```text
长视频不会因为上下文太长直接失败。
UI 显示第 N / M 段总结进度。
最终输出合并后的完整总结。
```

### Milestone 7：继续追问

```text
qaPipeline
conversation state
追问 UI
```

验收：

```text
用户可以基于视频摘要继续提问。
模型不会每次重新吞完整字幕。
```

### Milestone 8：一图流 JSON

```text
ONE_PAGE_JSON_PROMPT
extractJsonObject()
zod validation
classicTemplate
```

验收：

```text
摘要完成后，点击生成一图流。
能生成结构化一图流数据并渲染中文信息卡片。
```

### Milestone 9：图片模型接入

```text
ImageAiClient
DirectOpenAIImageClient
图片 API 配置
图片生成进度
图片结果展示
```

验收：

```text
用户配置图片 API 后，可以基于摘要生成视觉图。
图片生成失败时有明确错误提示。
```

### Milestone 10：图文合成

```text
composeOnePage()
AI 图作为背景
前端叠加中文总结
模板切换
```

验收：

```text
能生成 AI 视觉背景 + 中文总结信息的一图流卡片。
中文内容清晰可读。
```

### Milestone 11：PNG 导出

```text
html-to-image
导出 PNG
文件命名
```

验收：

```text
点击导出后，下载一张可读 PNG。
中文不乱码。
排版不明显错位。
```

### Milestone 12：缓存和打磨

```text
summary cache
onePage cache
image cache
配置导入/导出
清空缓存
```

验收：

```text
同一视频刷新后可读取缓存。
用户可以强制重新生成。
```

---

## 34. 推荐开发顺序

```text
1. main.ts
2. ui/panel.ts + ui/styles.ts
3. sources/VideoSourceProvider.ts
4. sources/bilibili/BilibiliProvider.ts
5. sources/bilibili/videoInfo.ts
6. sources/bilibili/routeWatcher.ts
7. sources/bilibili/subtitle.ts
8. store/configStore.ts
9. prompts/defaultPrompts.ts
10. ai/text/DirectOpenAITextClient.ts
11. summary/summaryPipeline.ts
12. ai/chunking.ts
13. summary/qaPipeline.ts
14. onePage/onePageSchema.ts
15. onePage/onePagePipeline.ts
16. ai/image/DirectOpenAIImageClient.ts
17. onePage/templates/classicTemplate.ts
18. onePage/composeOnePage.ts
19. onePage/exportPng.ts
20. cache
21. settings polish
```

最小可运行闭环是：

```text
main.ts
→ panel.ts
→ BilibiliProvider.getVideoInfo()
→ BilibiliProvider.getTranscript()
→ DirectOpenAITextClient
→ runSummaryPipeline()
```

一旦这个闭环跑通，再加一图流和图片模型。

---

## 35. V1 最终验收标准

```text
1. 项目名为 video-summary
2. V1 仅支持 Bilibili
3. 打开 Bilibili 视频页后自动出现面板
4. 正确识别 title / bvid / aid / cid / upName / description
5. 能获取字幕
6. 能配置文本模型 API
7. 能生成摘要
8. 长视频能分块总结
9. 能继续追问
10. 能配置图片模型 API
11. 能基于摘要生成图片 prompt
12. 能调用图片模型生成视觉图
13. 能生成一图流中文总结卡片
14. 能把 AI 图片作为背景或视觉区
15. 能导出最终 PNG
16. 不依赖自建服务器
17. API key 不写入 bilibili.com localStorage
18. 切换视频后状态能正确刷新
19. 后端、登录、付费接口已预留但不实现
```

---

## 36. 当前版本一句话定义

```text
video-summary V1 是一个纯前端 Bilibili 视频总结 userscript：
它用用户自己的文本模型生成视频摘要和问答，用用户自己的图片模型生成视觉图，再由前端合成可导出的中文一图流总结。
```
