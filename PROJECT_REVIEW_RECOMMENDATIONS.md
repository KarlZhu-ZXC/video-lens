# 项目优化与改进建议报告

本文档用于记录 `video-summary` 的已落地改动和后续 backlog。状态以当前代码为准，避免把历史 review 结论误当成仍需执行的任务。

最后更新：2026-05-19

## 已落地记录

### 1. 长视频分块合并阶段不再清空已生成内容

状态：已处理。

长视频分块摘要完成后，进入合并阶段时会继续保留已生成的分段摘要，避免正文区域回到“待生成”或空状态。

### 2. Video Insights 回答 Markdown 样式修复

状态：已处理。

聊天气泡样式只作用于消息根节点的直接段落，不再把 Markdown 内部段落、加粗内容或换行块错误包成多个框。

### 3. 一图流重新生成绕过缓存

状态：已处理。

一图流重新生成会传入 `force` 标记，绕过已有 JSON 和图片缓存，重新调用生成链路。

### 4. 面板宽度统一由侧边拖拽控制

状态：已处理。

设置页移除了面板宽度字段。所有 Tab 共用同一个 `panelWidth` 配置，通过侧边 resize handle 调整并持久化。拖拽宽度保存不再弹出“设置已保存”toast。

### 5. 请求模式统一为自动

状态：已处理。

设置页移除了文本模型和生图模型的请求模式选择。配置加载和保存时统一使用 `auto`：文本优先流式 `fetch`，必要时回退 `GM_xmlhttpRequest`；图片请求同样自动选择可用通道。

### 6. 生图模型默认启用

状态：已处理。

设置页移除了“启用生图模型”字段。生图模型默认启用，是否调用图片模型由一图流模式决定。

### 7. 连通性测试按钮位置与行为调整

状态：已处理。

文本模型和生图模型的“连通性测试”按钮移动到对应设置 section header 右侧。按钮 tooltip 明确说明会实际发送轻量 API 请求，成功和失败都会通过全局 toast 反馈。

### 8. 语言设置与英文总结支持

状态：已处理。

设置页语言 section 包含“界面显示语言”和“字幕获取及总结语言”。英文总结会优先尝试英文字幕，摘要、长视频分块/合并、视频洞察和一图流 JSON 都有对应英文 prompt。切换总结语言时会清除旧字幕选择，避免继续复用之前自动选中的字幕源。

### 9. YouTube watch / shorts 支持

状态：已处理。

新增 provider registry 和 `YouTubeProvider`，支持 YouTube `watch` / `shorts` 页面识别、页面内 `captionTracks` 字幕读取、JSON3/XML 字幕解析、英文/中文/翻译字幕优先级和官方 API 元数据备用配置。Prompt、缓存 key、设置页、README、SPEC 和 FEATURES 已改为 Bilibili + YouTube 的平台中性描述。

注意：YouTube 字幕读取只覆盖 YouTube 已向页面或 youtubei player 响应暴露的人工字幕、自动字幕和可翻译字幕。无字幕视频需要 ASR 转录能力，详见 `ASR_INTEGRATION_RESEARCH.md`。

### 10. YouTube 后续问题修复

状态：已处理。

- 同一 SPA 页面内打开另一个视频时，如果 URL 已变化但页面数据仍返回旧视频 id，`refreshVideo()` 会短暂重试，避免继续展示上一个视频。
- 设置页表单有未保存更改时，切换到其他 Tab 会弹出确认框；确认后先保存配置再离开，取消则停留在设置页。
- YouTube XML timedtext 字幕改为字符串解析，不再依赖 `DOMParser.parseFromString`，避免 Trusted Types 页面报错。

### 11. YouTube 字幕策略升级

状态：已处理。

YouTube 页面没有暴露 `captionTracks` 时，会请求同源 `youtubei/v1/player` 作为纯前端 fallback；字幕源列表会主动展示目标语言翻译选项，例如 `English (translated from Chinese)`。

### 12. ASR 低成本接入调研

状态：已处理为调研文档，未实现。

新增 `ASR_INTEGRATION_RESEARCH.md`，覆盖 Chrome Extension 标签页音频捕获 + 云端 ASR、用户上传、本地 WebGPU/WASM Whisper 和 Web Speech API 等方案。当前建议是：userscript 继续完善 YouTube 字幕/youtubei 策略；无字幕视频 ASR 更适合在 Chrome Extension 分支中实现。

### 13. Bilibili 行为回退

状态：已处理。

为避免 YouTube 平台中性改动影响 Bilibili，已恢复 Bilibili provider 的原有 `routeWatcher`、视频信息字段和一图流 `upName` 主路径。一图流 JSON prompt/schema/footer 继续以 `source{title,upName,url}` 为主；YouTube 仅在没有 `upName` 时用 `creatorName` 兼容填充。

### 14. 摘要渲染滚动与思考区行为

状态：已处理。

AI 总结流式渲染时会保存用户手动滚动位置；用户不在底部时，重渲染不会把滚动条拉回顶部。只有用户本来贴近底部时才继续自动跟随到底部。模型思考区在输出结束后默认折叠。

### 15. 摘要输出框空状态高度

状态：已处理。

AI 总结页的输出框即使没有内容或内容很短，也会占满到底部按钮上方的剩余空间，不再缩成内容高度。

## 未落地 Backlog

### 1. 【高优先级】Bilibili 字幕接口 WBI 风险

当前状态：未处理。

当前 `src/sources/bilibili/subtitle.ts` 仍直接请求：

```typescript
https://api.bilibili.com/x/player/wbi/v2?bvid=...&cid=...
```

风险说明：Bilibili 的 `wbi` 接口在部分场景可能要求 `w_rid` / `wts` 签名。若未签名请求被服务端拒绝，用户会看到“当前视频没有公开字幕”或“字幕列表请求失败”。这里不应假设所有环境必然失败，但它是实际稳定性风险。

建议：

- 优先调研 `https://api.bilibili.com/x/player/v2?bvid=...&cid=...` 是否仍能稳定返回字幕列表。
- 尝试从页面已有状态中读取字幕列表，减少额外 API 请求。
- 若必须继续使用 `wbi` 接口，再实现 WBI 签名：先请求 `x/web-interface/nav` 获取 key，再在客户端计算 `w_rid` / `wts`。

验收：

- 有单元测试覆盖字幕列表解析、无字幕错误和 API fallback。
- 至少用一个有字幕 Bilibili 视频在浏览器里验证。

### 2. 【中高优先级】一图流预览缩放避免依赖 CSS `zoom`

当前状态：未处理。

当前 `.vs-image-viewer-stage` 仍使用：

```css
zoom: var(--vs-zoom, 1);
```

风险说明：`zoom` 不是标准 CSS 属性，Firefox 支持不稳定或不可用。一图流预览缩放在非 Chromium 环境下可能失效。

建议：

- 用 `transform: scale(var(--vs-zoom, 1))` 替代 `zoom`。
- 同步处理缩放后的文档流高度补偿，否则会出现大面积空白或滚动高度不正确。
- 用 harness/Playwright 对桌面宽度和窄屏宽度做截图验证。

### 3. 【中优先级】GM XHR 降级状态透明化

当前状态：未处理。

当前文本请求 `auto` 模式优先走流式 `fetch`；当 fetch 失败且可用 `GM_xmlhttpRequest` 时，会回退到非流式 GM XHR。这个回退能提高可用性，但用户无法知道为什么流式输出突然变成等待后一次性出现。

建议：

- 先做状态透明化：触发 GM XHR 回退时，在状态栏或 toast 中提示“已自动启用跨域背景通道，可能延迟显示”。
- 再调研 Tampermonkey 下 GM XHR 是否能稳定提供增量响应。不要默认承诺所有脚本管理器都支持可靠流式。

### 4. 【中低优先级】抽象 userscript 运行时适配层

当前状态：未处理。

`GM_getValue`、`GM_setValue`、`GM_setClipboard`、`GM_xmlhttpRequest` 与 `localStorage` fallback 判断仍散落在 store、controller 和 client 中。

建议：

- 新增 `src/utils/gmAdapter.ts` 或 `src/runtime/userscriptAdapter.ts`。
- 集中封装 storage、clipboard、xhr 能力探测和 fallback。
- 让 store/controller 依赖 adapter，降低测试和未来 Chrome Extension 迁移成本。

### 5. 【中优先级】PNG 导出失败诊断与资源容错

当前状态：未处理。

一图流导出使用 `html-to-image` 的 `toPng`。在 YouTube/Bilibili 页面中，严格 CSP、`data:` 限制、外部图片跨域或 canvas taint 都可能导致导出失败。当前导出失败没有专门的诊断提示。

建议：

- 在 `exportOneImage()` catch 路径中识别 `SecurityError`、CSP、tainted canvas 等典型错误，给出明确用户提示。
- 对卡片中的外部图片资源，调研是否需要通过 `GM_xmlhttpRequest` 下载为 Blob/Object URL 后再参与导出。
- 保留 harness 导出作为稳定验证路径。

### 6. 【低优先级】Mascot 悬浮按钮窗口 resize 越界处理

当前状态：未处理。

Mascot 拖动结束时会 clamp 到当前视口，但窗口缩小或屏幕方向变化后，已保存坐标可能跑出视口。

建议：

- 监听 `resize` / `orientationchange`。
- 当面板处于 collapsed 状态且 launcher 已拖动时，重新 clamp 坐标。
- 避免每次 render 都重复注册监听，注意 cleanup。

### 7. 【低优先级】字体策略复核

当前状态：暂缓。

项目样式使用 `Geist` / `Geist Mono` 作为首选字体，但当前没有内置或加载 Geist 字体。直接通过 CDN `@import` 字体会增加外部网络依赖、隐私暴露和站点 CSP 变量，不建议作为默认改动。

建议：

- 默认继续使用系统字体 fallback，保持 userscript 轻量和离线稳定。
- 如果确实要统一字体，优先考虑构建时内联必要字体或作为可选视觉增强，而不是强依赖第三方 CDN。
