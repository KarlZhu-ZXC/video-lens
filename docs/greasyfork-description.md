## 它是什么

片语（Video Lens）是一款运行在 Tampermonkey 上的智能视频摘要脚本。在 Bilibili 和 YouTube 视频页面自动读取公开字幕，通过你配置的 OpenAI-compatible 模型生成流式 Markdown 摘要，并支持基于视频内容的连续追问和配图生成。完整支持中英双语界面、字幕选择、大模型思考过程可视化与本地缓存。

## 打开视频就能做的事

- **一键流式摘要**：自动抓取视频元信息和公开字幕，调用你配置的文本模型生成 Markdown 总结。短字幕直接总结，长字幕自动分块并发处理再合并。
- **基于视频的连续对话**：摘要下方就是输入框，可以围绕字幕和摘要继续追问，保留有限轮次上下文，支持流式 Markdown 回答。
- **一句话生图**：在对话框说「画一张配图」「生成封面」等表达，脚本自动改用图片模型，基于摘要生成信息可视化封面图。
- **思考过程可视化**：对支持深度思考的模型（如 DeepSeek），会展开显示 `Thinking`，完成后折叠为 `Thought for 12.3s`。
- **完整的双语体验**：界面中文 / English 可切换；字幕和摘要语言可独立选择中文、英文或自动翻译字幕。
- **本地缓存**：同一视频的摘要与生成图会被缓存，再次打开直接命中，不重复消耗 token。支持一键清除。
- **不打扰观看**：面板宽度可拖动，悬浮按钮可拖到任意位置；浏览器全屏播放时脚本自动隐藏。

## 两种生图方式

- **API 生图（默认）**：使用你配置的 OpenAI-compatible 图片接口（Base URL + API Key + 模型）。
- **ChatGPT 网页生图（实验性）**：在 ChatGPT 中新建专用 Project，把 Project 根页 URL 填入图片设置。脚本会自动在 Project 内开新聊天、跨标签把图片分块传回视频页。依赖 ChatGPT 页面结构，页面改版后可能需要等待适配。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展（Chrome / Edge / Firefox / Safari 均可）。
2. 点击本页「Install」按钮，Tampermonkey 会弹出安装确认页。
3. 确认安装后，刷新一个 Bilibili 或 YouTube 视频页面，右下角就会出现片语悬浮按钮。

## 首次配置

点击面板右上角的设置图标，按需填写：

**文本配置**（用于生成摘要和对话）

- **Base URL**：你的 OpenAI-compatible 接口地址，例如 `https://api.openai.com/v1`。
- **API Key**：对应服务商的 API Key。
- **模型**：模型名称，例如 `gpt-4o-mini`、`deepseek-chat`、`MiniMax-Text-01` 等。
- **API 协议**：可选择 Chat Completions 协议或 Anthropic 协议。
- 点击「模型连通测试」验证可用后再保存。

**图片配置**（用于生成配图）

- 同样需要 Base URL、API Key、模型三项；或选择 ChatGPT 网页生图并填入 Project 根页 URL。
- 与文本配置彼此独立。

**其他选项**：界面语言、字幕获取策略、偏好字幕获取及总结语言、文本总结预设、图片风格预设、图片比例、面板宽度、YouTube 字幕来源、是否启用自动摘要等。

所有配置仅保存在你本地的 Tampermonkey 存储中，不会上传到任何第三方。

## 适用页面

- `*.bilibili.com/video/*` 视频页
- `*.bilibili.com/list/*` 列表页
- `*.youtube.com/watch*` 长视频
- `*.youtube.com/shorts/*` 短视频
- `chatgpt.com/*` 仅在使用「ChatGPT 网页生图」时需要打开对应 Project 根页

## 隐私与安全

- 完全开源，仓库代码可逐行审查，没有任何后端服务或埋点。
- 你的 API Key 仅保存在本地 Tampermonkey 存储，密码输入框不回填已保存值。
- 视频字幕、视频元信息、对话内容会发送到你配置的模型接口，用于生成摘要和回答问题——这意味着服务商能看到你请求的内容，请使用你信任的服务。
- ChatGPT 网页生图模式下，图片请求会通过你登录的 ChatGPT 账号发起，token 与 Cookie 不会被脚本读取或外发。
- 不收集任何使用统计数据，不内置任何广告、追踪或付费墙。

## 常见问题

**视频没有字幕怎么办？**
脚本会明确提示「当前视频没有公开字幕」，不会强制生成低质量总结。暂不支持自动 ASR。

**摘要生成失败 / 卡住不动？**
- 检查 API Key、Base URL、模型名称是否拼写正确。
- 部分服务商需要浏览器 CORS 放行才能流式输出，脚本会自动回退 GM XHR；如果还是失败，请联系你的服务商。
- 流式输出要求接口支持 Server-Sent Events（SSE），否则只能一次性返回。

**YouTube 字幕读不到？**
- 部分视频关闭了字幕，需打开 YouTube 官方「显示字幕」后再试。
- 翻译字幕依赖 YouTube 提供的自动翻译能力，部分视频没有翻译轨。
- 对少数字幕下载接口返回空内容的视频，脚本会尝试读取当前页面的官方 Transcript 面板。
- 设置中可填入 YouTube Data API 凭证作为元数据备用来源。

**会消耗多少 token？**
取决于字幕长度。短视频（< 5 分钟）通常 1–3k tokens；长视频会先分段总结再合并，用量随字幕长度线性增长。带深度思考的模型可能多消耗 2–5 倍 token，但能换来更高质量的总结。

**怎么升级？**
Greasy Fork 会在脚本有新版本时自动提示更新，也可以在 Tampermonkey 面板手动「Check for updates」。

## 反馈

- 提 Issue：[GitHub 仓库](https://github.com/KarlZhu-ZXC/video-lens/issues)
- 觉得有用，欢迎给项目点个 ⭐，或通过 [PayPal](https://paypal.me/xczhu) 请作者喝杯咖啡。

## 许可证

MIT License © 2026 Video Lens Contributors
