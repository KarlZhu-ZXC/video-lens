# 片语 · Video Lens

Video Lens（中文名“片语”）是运行在 Bilibili / YouTube 视频页的 userscript：读取视频信息和字幕，通过 OpenAI-compatible 文本模型生成流式摘要，支持在摘要结果下方进行连续的对话交互问答，并在对话中支持生成基于视频内容的配图。

## 使用

```bash
pnpm install
pnpm build
```

构建产物在 `dist/video-lens.user.js`，安装到 Tampermonkey 后打开 Bilibili 视频页或 YouTube `watch` / `shorts` 页面使用。

脚本声明 Tampermonkey grant，用于配置和跨标签任务存储、通过 `GM_xmlhttpRequest` 兼容跨域 API/图片下载、打开 ChatGPT Project，以及复制。

### ChatGPT 网页生图（实验）

图片设置提供 `API 生图` 和 `ChatGPT 网页生图（实验）` 两个选项。网页模式的使用步骤：

1. 在 ChatGPT 新建一个只用于 Video Lens 生图的 Project。
2. 把 Project 根页的完整 `https://chatgpt.com/g/g-p-.../project` URL 填入图片设置并保存。
3. 刷新并保持该 Project 根页打开；设置中的连通性测试应显示接收端在线。
4. 在视频摘要中点击“生图”。脚本每次会在该 Project 内新建独立聊天，自动填词、发送、等待图片并回传视频页；视频页确认图片已成功接收后，ChatGPT 页才返回 Project 根页。

跨标签回传使用分块存储；视频页会等待成功结果关联的全部分块到齐后再组装图片，并发送成功消费确认，以兼容 Tampermonkey 不同 storage key 通知乱序到达的情况。回传失败或未收到确认时，ChatGPT 页会保留在结果聊天，便于查看和重试。

接收页离线时脚本会尝试后台打开 Project 根页。网页任务默认五分钟超时；失败时不会自动切换 API，避免意外产生 API 费用。该模式依赖 ChatGPT 页面 DOM，页面更新后可能需要同步维护选择器。

开发 watch：

```bash
pnpm dev
```

UI harness：

```bash
pnpm dev:harness
```

打开 `http://127.0.0.1:5173/harness.html`，可用 `?scenario=empty-summary|pending-summary|thinking-summary|long-summary|completed-summary|settings|settings-chatgpt|chat-image|image-error|error` 检查固定 UI 场景。

测试：

```bash
pnpm test
```

更多功能说明见 [FEATURES.md](./FEATURES.md)，当前进度和待办分别记录在
[progress/README.md](./progress/README.md) 与
[progress/PROJECT_REVIEW_RECOMMENDATIONS.md](./progress/PROJECT_REVIEW_RECOMMENDATIONS.md)。

## V1 范围

- Bilibili 视频信息识别和字幕获取
- YouTube `watch` / `shorts` 视频信息识别和字幕获取；默认读取页面内字幕，没有页面字幕时会用同源 `youtubei/v1/player` 作为纯前端 fallback，可配置 YouTube 官方 API 作为备用元数据路径
- OpenAI-compatible 文本摘要，支持基于摘要的自由对话
- 流式摘要渲染、Markdown 正文渲染；模型 reasoning (如 DeepSeek 思考过程) 可视化展开
- 支持在对话交互中根据用户意图自动识别并通过图片 API 或 ChatGPT 网页生成相关配图
- Shadow DOM 本地面板、极简的全屏高度对话流布局、设置、Tampermonkey 配置存储、本地缓存
- 请求统一使用自动模式：文本优先流式 fetch，必要时回退 GM XHR；图片请求也自动选择可用通道
- 设置页支持真实 API 连通性测试；已保存 API Key 不会回填到密码输入框，留空保存会继续使用旧 key；表单有未保存更改时切换 Tab 会先确认是否保存
- 设置页支持界面语言和字幕/总结语言，并支持设置是否在打开视频时**自动读取字幕并生成摘要**；英文总结会优先尝试英文字幕并使用英文 prompt；YouTube 可显示人工字幕、自动字幕和翻译字幕源
- 摘要页把字幕语言选择合并到模型配置胶囊中，切换只更新选择，重新生成时才读取新字幕，并提供单视频缓存清理和全量缓存清理
- 初始摘要和后续问答会流式展开模型思考过程，完成后折叠并显示耗时；最新 Agent 回复提供“提炼核心观点 / 列出行动建议 / 生成配图”固定快捷意图
- 长字幕以最多两个并发请求生成分段摘要；分段正文不进入摘要区，空分段会重试一次，整体合并不完整会再合并一次，仍异常则明确报错
- 视频卡片以 3×3 Description 网格依次显示 UP 主、粉丝、上传时间、播放、弹幕、评论、点赞、投币和收藏；缺失项不显示
- 所有 Tab 面板宽度通过侧边拖拽调整并持久化
- HTTPS 资源 URL 规范化，减少 HTTPS 页面中的 Mixed Content warning
- SPA 路由监听带 history wrapper 标记；Bilibili / YouTube 页面内切换视频时会短暂重试读取，避免拿到旧视频信息

V1 不包含登录、付费、自建后端、云端历史记录、评论总结、YouTube playlist 批量总结或 Chrome Extension 版本。

YouTube 无字幕视频的 ASR 接入调研见
[progress/ASR_INTEGRATION_RESEARCH.md](./progress/ASR_INTEGRATION_RESEARCH.md)。
