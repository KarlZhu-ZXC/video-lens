# video-summary V1 Spec

## 目标与运行形态

`video-summary` 是运行在 Tampermonkey 中的 Bilibili / YouTube 视频总结 userscript。项目使用 pnpm、Vite、TypeScript 和 `vite-plugin-monkey`，UI 由原生 DOM 与 Shadow DOM 构成。

支持页面：

- Bilibili `/video/`、`/list/`
- YouTube `/watch?v=...`、`/shorts/...`

## 启动与总结流程

页面加载后先显示可拖动悬浮按钮。用户点击按钮时：

1. 展开摘要 Tab。
2. 尝试恢复当前视频、模型、Prompt、语言和字幕源匹配的摘要缓存。
3. 命中缓存时直接展示，不发送模型请求。
4. 未命中时读取字幕并立即调用文本模型总结。

摘要支持流式输出、模型思考折叠展示、长字幕分块/合并、Markdown 安全子集渲染、复制和 Markdown 导出。手动“重新生成”仍会重新执行总结流程。

## 视频与字幕

provider registry 只负责视频站点来源，不参与模型配置。Bilibili 保持现有视频信息和 `upName` 兼容行为。YouTube 支持页面 `captionTracks`、同源 youtubei fallback、JSON3/XML 字幕、人工/自动/翻译字幕和可选官方 API 元数据配置。

## 模型配置

设置页不包含模型供应商概念。文本模型与图片模型各自保留一组独立配置：

- Base URL
- API Key
- 模型
- 连通性测试

请求继续使用 OpenAI-compatible 协议。文本请求自动优先流式 fetch，必要时回退 GM XHR；图片请求使用现有自动通道。API Key 优先保存在 Tampermonkey storage，不回填密码输入框，粘贴 `Bearer <key>` 时会去掉前缀。

旧配置加载时保留已有文本/图片 URL、Key 和模型值，但丢弃供应商、模型预设列表、远程模式和一图流模式等废弃字段。

## 一图流

一图流依赖已有文本摘要。浏览器本地使用以下固定模板拼接摘要：

```text
根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：

{summary}
```

拼接后直接调用图片模型并展示返回的 URL 或 Base64 图片。生成结果按视频、摘要内容、图片模型、图片 Base URL 和 Prompt 版本缓存；重新生成会绕过缓存。用户可以直接下载生成图片。

一图流不包含：

- 结构化 JSON 或 schema 校验
- 文本模型二次生成图片 Prompt
- HTML/CSS 卡片排版
- 浏览器 DOM 合成
- 文字卡、AI 背景、纯 AI 图等模式选择

## UI 与存储

面板支持左右位置、拖拽宽度、临时收起、悬浮按钮拖动和浏览器全屏隐藏。设置页有未保存更改时，切换 Tab 会先确认保存。摘要和图片结果使用本地缓存；清空全部缓存会同时清理两类结果。

## 已知边界

- 无字幕视频不会自动 ASR。
- fetch 流式请求要求 API 支持浏览器 CORS；GM XHR fallback 可能一次性返回。
- 图片 API 必须返回现有客户端支持的 URL 或 Base64 字段。
- 本项目不包含登录、支付、自建后端、云端历史或 playlist 批量总结。
