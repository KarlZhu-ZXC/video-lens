# video-summary V1 Spec

## 目标

`video-summary` 是一个面向 Bilibili 和 YouTube 视频页的 Tampermonkey userscript。它在视频页注入 Shadow DOM 面板，读取视频信息和字幕，调用 OpenAI-compatible 文本模型生成摘要、视频洞察问答和一图流数据，并在浏览器端渲染中文信息图。

当前 V1 聚焦本地可用和快速迭代，不包含登录体系、付费系统、自建云端历史、YouTube playlist 批量总结或 Chrome Extension 版本。

## 运行形态

- 包管理器：pnpm
- 构建工具：Vite + TypeScript + vite-plugin-monkey
- 运行载体：Tampermonkey userscript
- UI 技术：原生 DOM + Shadow DOM
- 构建产物：`dist/video-summary.user.js`

userscript metadata 声明 Tampermonkey grant：

- `GM_getValue`
- `GM_setValue`
- `GM_xmlhttpRequest`
- `GM_setClipboard`

userscript metadata 同时声明 `@connect` 允许访问字幕/元数据域名和 OpenAI-compatible API 域名，包括中国区 MiniMax `api.minimaxi.com` 与国际区 MiniMax `api.minimax.io`。

配置优先写入 Tampermonkey storage，避免 API Key 落到视频网站页面 origin 的 `localStorage`。请求通道由系统统一使用 `auto`：流式文本请求优先走浏览器 `fetch`，必要时回退到 GM XHR 的非流式请求；图片请求同样优先使用 fetch，失败时回退 GM XHR。设置页不再暴露请求模式选择。

## 适用页面

脚本由 Tampermonkey 注入到 Bilibili 和 YouTube 域名：

- `*://*.bilibili.com/*`
- `*://bilibili.com/*`
- `*://*.youtube.com/*`

实际 UI 只在以下页面启用：

- `bilibili.com/video/`
- `bilibili.com/list/`
- `youtube.com/watch?v=...`
- `youtube.com/shorts/...`

## 核心流程

1. 页面加载后执行 `src/main.ts`。
2. 判断当前 URL 是否为支持的 Bilibili 或 YouTube 视频页面。
3. 创建 `AppController` 和 `Panel`。
4. provider registry 根据 URL 选择 `BilibiliProvider` 或 `YouTubeProvider` 读取视频基本信息和字幕。
5. 如果用户选择过字幕源，使用该字幕源；否则根据“字幕获取及总结语言”自动选择字幕：中文优先 `zh-CN -> zh -> first`，英文优先 `en -> translated en -> fallback`。YouTube provider 会先读取页面内 caption tracks；没有页面 tracks 时，请求同源 `youtubei/v1/player` 作为不需要 Google API Key 的纯前端 fallback；当总结语言变化时，清除旧的自动字幕选择，下一次生成重新按新语言选择。
6. 摘要 pipeline 按字幕长度决定直接摘要或分块摘要。
7. 文本模型以 stream 模式生成内容；长视频分块摘要完成后会在合并阶段继续展示已生成的分段内容，避免可见正文回到空状态。
8. UI 实时渲染流式摘要、低干扰模型思考状态和 Markdown 正文。
9. 摘要结果写入本地缓存。
10. 用户可继续进行视频洞察问答、生成一图流、导出 PNG。

当视频站点在同一个 SPA 页面内切换视频时，URL 变化后页面内的视频数据可能短暂滞后。`AppController.refreshVideo()` 会在检测到当前 URL 已变化但读取到的仍是旧视频 id 时进行短暂重试，避免用户打开另一个视频后面板继续展示上一个视频。

YouTube 字幕读取的边界：当前实现只读取 YouTube 已向页面或 youtubei player 响应暴露的人工字幕、自动字幕和可翻译字幕。若视频没有这些字幕轨道，userscript 不会凭空生成转录文本；后续如需覆盖无字幕视频，需要接入 ASR，建议参考 `ASR_INTEGRATION_RESEARCH.md`。

## 文本模型

当前文本供应商只提供 `Minimax-CN`。设置项包括：

- 文本供应商
- Base URL
- API Key
- 模型
- 连通性测试

Base URL 保存时只做路径规范化，不改写用户填写的域名：

- 去掉尾部 `/`
- 如果用户填完整 `/chat/completions`，保存为 base URL
- 请求时再拼接 `/chat/completions`

API Key 保存和请求前会规范化：

- 支持直接填写 key
- 支持粘贴 `Bearer <key>`，会自动去掉 `Bearer`
- 已保存的 key 不会回填到设置页密码输入框；输入框留空保存时继续使用旧 key
- 如果没有 Tampermonkey storage 能力，fallback 存储会剥离 API Key，避免写入页面 `localStorage`
- 空 key 会在请求前报错

模型下拉当前包含：

- `MiniMax-M2.7`
- `MiniMax-M2.5`
- `MiniMax-M2.1`
- `MiniMax-M2.1-highspeed`
- `MiniMax-M2`
- `MiniMax-M1`
- `MiniMax-Text-01`

## 流式渲染

文本客户端解析 OpenAI-compatible SSE stream：

- `delta.content` 进入摘要正文
- `delta.reasoning_content`、`delta.reasoningContent`、`delta.thinking` 进入模型思考
- 正文里的 `<think>...</think>` 会被抽取到模型思考，并从正文中移除
- 流式分片中的半截 `<think>` 标签会跨 chunk 追踪

UI 使用 `streamingSummary` 临时状态持续刷新。生成完成后写入 `summary` 并缓存。

## Markdown 渲染

摘要正文通过本地 Markdown 子集渲染器输出，不直接作为纯文本显示。当前支持：

- 标题 `#` 到 `####`
- 段落
- 无序列表
- 有序列表
- 粗体
- 行内代码
- HTTP/HTTPS 链接
- HTTP/HTTPS 图片；显示资源 URL 会将 `//...` 和 `http://...` 规范为 HTTPS，减少 Mixed Content warning

渲染器通过 DOM 节点构建，不直接注入未处理的 HTML。

## 模型思考展示

模型思考采用低干扰三态展示：

- 仅有思考、正文尚未开始时，显示一行 `模型思考` 状态和最新思考片段。
- 正文开始流式输出后，隐藏模型思考，避免遮挡摘要或对话正文。
- 生成完成后，如果存在思考内容，显示默认收起的 `模型思考` 折叠行，用户可手动展开查看完整内容。

## 一图流

一图流流程包括：

1. 基于摘要生成结构化 JSON。
2. 校验 JSON schema。
3. 可选生成图片 prompt 和 AI 背景图。
4. 使用浏览器 DOM 合成中文信息图。
5. 通过 `html-to-image` 生成 PNG base64 data URL，再转 Blob 触发下载。

当前模板：

- classic
- dense
- poster

## 本地存储

配置优先保存在 Tampermonkey storage。摘要、一图流和图片结果保存在浏览器本地缓存中。摘要缓存 key 包含平台、视频 id、prompt id、文本模型、字幕/总结语言和字幕源，避免不同平台、模型、提示词或字幕结果互相覆盖。

摘要页会显示当前字幕语言、摘要生成时间和模型配置。加载到多个字幕源后，摘要页显示字幕源选择器；重新生成摘要时使用用户选择的字幕源。用户可以清除此视频的摘要缓存，也可以清空摘要、一图流和图片缓存。

## UI 行为

- 面板挂载在 Shadow DOM 中，减少与视频网站页面样式冲突。
- 面板支持左/右位置配置，所有 Tab 共用一个面板宽度。宽度通过面板侧边 resize handle 调整并写入配置，拖拽范围为 `300px` 到 `900px`，拖拽保存不显示 `设置已保存` toast。
- 默认以可拖动悬浮 mascot 按钮启动，点击后展开完整面板。
- 面板支持临时收起；折叠状态不持久化，刷新后仍从悬浮按钮开始。
- 摘要和一图流的主操作按钮使用底部吸底操作区，和设置页保存按钮保持一致。
- 设置页语言 section 包含界面显示语言和字幕获取及总结语言。字幕/总结语言为英文时，字幕源优先尝试英文字幕；YouTube 没有英文但原字幕可翻译时，会优先使用 `tlang=en` 翻译字幕。摘要、长视频分块/合并、视频洞察和一图流 JSON 使用对应语言 prompt。
- 设置页视频源 section 提供 YouTube 字幕策略：`auto` 默认先读页面内字幕，配置了官方 API 后可作为备用；`page` 只用页面字幕；`official` 优先官方 API 能力。
- 设置页表单有未保存更改时，切换到其他 Tab 会弹出确认框；确认后先保存配置再离开，取消则停留在设置页。
- 设置页文本模型和生图模型 section header 右侧提供 `连通性测试`。按钮 tooltip 会提示会实际发送轻量 API 请求；成功或失败都会通过全局 toast 反馈。
- 设置页不再提供文本/图片请求模式、生图模型启用开关或面板宽度下拉；请求模式固定为自动，生图模型默认启用。
- 全局顶部通知独立于 Tab 内容渲染，切换 Tab 不会重启未结束的通知动画。
- Obsidian 高对比暗色 UI 使用 zinc surface scale 和清晰 outline 分层。

## UI Harness

项目提供根入口 `harness.html` 和 `pnpm dev:harness`，用于在本地 Vite 环境中渲染实际 Panel 类。固定场景通过 query 参数切换：

- `?scenario=long-summary`
- `?scenario=settings`
- `?scenario=one-image`
- `?scenario=error`

## 已知限制

- 自动请求模式中的 fetch 通道要求 AI API 支持浏览器 CORS。
- 自动请求模式回退到 GM XHR 后可绕过浏览器 CORS，但无法提供真正的流式渲染。
- API Key 仍然保存在本机 Tampermonkey storage，不提供账号级加密、同步或远程密钥托管。
- 当前支持 Bilibili 视频/list 页面和 YouTube watch/shorts 页面；不支持 youtu.be、embed 或 playlist 批量总结入口。
- YouTube 页面内字幕结构不是官方公共 API，YouTube 改版时可能失效；保留官方 API 配置作为备用元数据路径。
- YouTube XML timedtext 字幕使用字符串解析，避免 YouTube 页面 Trusted Types 限制下 `DOMParser.parseFromString` 被拦截。
- 当前没有云端账号、同步历史或支付体系。
- Markdown 渲染器是安全子集，不支持完整 CommonMark。
