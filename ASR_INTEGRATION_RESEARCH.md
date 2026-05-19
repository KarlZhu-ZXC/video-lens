# ASR Integration Research

Last updated: 2026-05-18

## Goal

YouTube 字幕策略已经升级为：

1. 读取页面内 `captionTracks`
2. 页面无字幕时请求同源 `youtubei/v1/player`
3. 对可翻译 track 生成目标语言字幕选项
4. JSON3 失败后回退 XML 字幕解析

这只能覆盖 YouTube 已暴露的字幕。若视频没有人工字幕、自动字幕或可翻译字幕，需要 ASR 从音频重新转录。

## Key Constraint

纯 Tampermonkey userscript 不能可靠地拿到 YouTube 原始音频文件，也不能执行本机命令。要做 ASR，必须解决两个问题：

- 音频来源：从浏览器捕获、用户上传、用户提供本地文件，或服务端下载。
- 转录执行：云端 ASR、本地浏览器模型、本地 helper，或系统浏览器语音服务。

在“不跑 yt-dlp、本机服务、云端下载服务”的约束下，最低摩擦路径是 Chrome Extension 的 `tabCapture` / `MediaRecorder` 捕获当前标签页音频，再把音频 chunk 发给 ASR API。

## Recommended Low-Cost Paths

### Option A: Chrome Extension Tab Audio Capture + Cheap Cloud ASR

适合：优先提升覆盖率，用户不需要安装本地服务。

流程：

```text
Extension content/panel
  -> 用户点击“转录当前视频”
  -> chrome.tabCapture / MediaRecorder 捕获当前 YouTube 标签页音频
  -> 分片编码为 webm/opus
  -> 上传到 ASR provider
  -> 返回 transcript
  -> 复用现有 summary pipeline
```

优点：

- 不需要 yt-dlp。
- 不需要用户手动下载视频。
- 比浏览器端 Whisper 轻。
- 可以做成只在用户点击后录制，权限边界清晰。

缺点：

- 需要从 userscript 迁移或新增 Chrome Extension。
- 实时捕获意味着 30 分钟视频通常至少要播放/快进捕获一段时间，不能像服务器下载那样直接离线高速处理。
- 需要云端 ASR API Key，存在隐私和成本。

低成本 ASR provider 参考：

| Provider | 价格参考 | 说明 |
| --- | ---: | --- |
| Groq Whisper Large v3 Turbo | $0.04 / hour transcribed | 当前看到的最低托管 Whisper 价格之一；适合成本优先。Source: [Groq pricing](https://groq.com/pricing) |
| AssemblyAI Universal-2 | $0.15 / hour | 成本低，托管 API 成熟；附加功能另计。Source: [AssemblyAI pricing](https://www.assemblyai.com/pricing/) |
| Google Cloud Speech-to-Text dynamic batch | $0.003 / minute | 约 $0.18 / hour；标准动态批处理低价，但接入 GCP 稍重。Source: [Google Cloud Speech-to-Text pricing](https://cloud.google.com/speech-to-text/pricing) |
| OpenAI gpt-4o-mini-transcribe | $0.003 / minute | 约 $0.18 / hour；与现有 OpenAI-compatible 思路接近，但是真实 API 不是所有兼容网关都支持 audio。Source: [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| Deepgram Nova-3 Monolingual | $0.0048 / minute | 约 $0.288 / hour；实时/预录制能力成熟。Source: [Deepgram pricing](https://deepgram.com/pricing) |

建议优先级：

1. Groq Whisper Large v3 Turbo：成本最低，适合第一版实验。
2. OpenAI gpt-4o-mini-transcribe：接入体验更统一，适合已有 OpenAI API Key 用户。
3. AssemblyAI / Deepgram：适合需要更完整语音产品能力时再加。

### Option B: User Upload Audio/Video File + Cloud ASR

适合：不想做标签页音频捕获，允许用户手动提供文件。

流程：

```text
用户下载音频或视频文件
  -> 插件/网页设置页上传文件
  -> 前端直传 ASR API
  -> 返回 transcript
  -> 复用现有 summary pipeline
```

优点：

- 技术最简单。
- 可以继续保留 userscript 或做独立本地网页工具。
- 不需要处理 YouTube 播放器音频捕获。

缺点：

- 用户流程重。
- YouTube 视频下载仍是用户自己处理。
- 大文件上传慢，且受 ASR API 单文件大小限制。

适合作为高级入口，不建议作为默认主流程。

### Option C: Browser-Side Whisper WebGPU/WASM

适合：极度重视隐私、不想把音频发给云端。

流程：

```text
Extension 捕获音频或用户上传音频
  -> 浏览器端加载 Whisper / distil-whisper 模型
  -> WebGPU 或 WASM 转录
  -> transcript 进入 summary pipeline
```

优点：

- 没有按分钟 API 成本。
- 音频可以不出本机。

缺点：

- 首次模型下载大。
- 长视频性能不可控。
- 移动设备和低端电脑体验差。
- 仍然需要解决音频捕获或上传。

建议作为“实验性隐私模式”，不作为默认。

### Option D: Web Speech API

适合：免费 demo，不适合核心能力。

优点：

- 表面上最轻量。
- 无需模型下载和后端服务。

缺点：

- 长视频不稳定。
- 浏览器和系统依赖强。
- 时间戳、语言、连续识别和错误恢复都难控。
- 可能走浏览器厂商服务，隐私边界不如表面直观。

不建议落地主流程。

## Integration Design

建议新增一个平台中性的转录层：

```ts
interface TranscriptProvider {
  name: string;
  kind: 'subtitle' | 'asr';
  isAvailable(video: VideoInfo): Promise<boolean>;
  getTranscript(video: VideoInfo, options: TranscriptOptions): Promise<Transcript>;
}
```

现有字幕 provider 继续作为第一优先级：

```text
1. YouTube/Bilibili subtitle provider
2. YouTube youtubei fallback
3. User-selected ASR provider
4. Clear error with next actions
```

配置建议：

- `asr.enabled: boolean`
- `asr.provider: 'groq' | 'openai' | 'assemblyai' | 'deepgram' | 'google' | 'browser_whisper'`
- `asr.apiKey?: string`
- `asr.language: 'auto' | 'zh' | 'en' | ...`
- `asr.captureMode: 'tab_audio' | 'file_upload'`
- `asr.chunkSeconds: number`

UI 建议：

- 当字幕为空时显示：“YouTube 没有暴露可读取字幕。可尝试 ASR 转录。”
- ASR 按钮必须明确说明会录制当前标签页音频或上传音频到所选 provider。
- 转录结果进入同一个字幕 tag，但标记为 `ASR: English` / `ASR: Auto detected`，避免和 YouTube 官方字幕混淆。

## Cost Estimate

以 30 分钟视频为例：

| Provider | 粗略成本 |
| --- | ---: |
| Groq Whisper Large v3 Turbo | $0.02 |
| AssemblyAI Universal-2 | $0.075 |
| Google dynamic batch | $0.09 |
| OpenAI gpt-4o-mini-transcribe | $0.09 |
| Deepgram Nova-3 Monolingual | $0.144 |

这些只计算 ASR，不包含摘要 LLM 成本、网络、失败重试和可能的存储成本。

## Recommendation

短期不建议在 userscript 内硬做 ASR。更稳的产品路径是：

1. 当前 userscript 继续把 YouTube subtitle/youtubei 策略做完整。
2. 新建 Chrome Extension 分支，新增“无字幕时 ASR 转录”入口。
3. 第一版 ASR 只支持 `tabCapture + Groq/OpenAI` 两个 provider。
4. 转录结果复用现有 summary cache key，但额外加入 `transcriptSource=asr:<provider>:<language>`，避免和 YouTube 字幕缓存混用。
5. 后续再考虑 browser-side Whisper 作为隐私实验选项。

