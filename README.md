# video-summary

Bilibili / YouTube 视频页 userscript：读取视频信息和字幕，通过 OpenAI-compatible 文本模型生成流式摘要和视频洞察问答，并可将摘要直接交给图片模型生成一图流图片。

## 使用

```bash
pnpm install
pnpm build
```

构建产物在 `dist/video-summary.user.js`，安装到 Tampermonkey 后打开 Bilibili 视频页或 YouTube `watch` / `shorts` 页面使用。

脚本声明 Tampermonkey grant，用于把配置写入 Tampermonkey storage、通过 `GM_xmlhttpRequest` 兼容不支持浏览器 CORS 的 OpenAI-compatible API，并使用 `GM_setClipboard` 复制摘要。

开发 watch：

```bash
pnpm dev
```

UI harness：

```bash
pnpm dev:harness
```

打开 `http://127.0.0.1:5173/harness.html`，可用 `?scenario=long-summary|settings|one-image|error` 检查固定 UI 场景。

测试：

```bash
pnpm test
```

更多功能说明见 [FEATURES.md](./FEATURES.md)。

## V1 范围

- Bilibili 视频信息识别和字幕获取
- YouTube `watch` / `shorts` 视频信息识别和字幕获取；默认读取页面内字幕，没有页面字幕时会用同源 `youtubei/v1/player` 作为纯前端 fallback，可配置 YouTube 官方 API 作为备用元数据路径
- OpenAI-compatible 文本摘要、分块摘要、视频洞察问答
- 流式摘要渲染、低干扰模型思考展示、Markdown 正文渲染
- 固定提示词拼接文本摘要后，直接调用图片模型生成一图流
- Shadow DOM 本地面板、点击即总结的悬浮启动按钮、设置、Tampermonkey 配置存储、本地缓存、PNG 导出
- 请求统一使用自动模式：文本优先流式 fetch，必要时回退 GM XHR；图片请求也自动选择可用通道
- 设置页支持真实 API 连通性测试；已保存 API Key 不会回填到密码输入框，留空保存会继续使用旧 key；表单有未保存更改时切换 Tab 会先确认是否保存
- 设置页支持界面语言和字幕/总结语言；英文总结会优先尝试英文字幕并使用英文 prompt；YouTube 可显示人工字幕、自动字幕和翻译字幕源
- 摘要页显示字幕语言、字幕源选择器、缓存生成时间，并提供单视频缓存清理和全量缓存清理
- 所有 Tab 面板宽度通过侧边拖拽调整并持久化
- HTTPS 资源 URL 规范化，减少 HTTPS 页面中的 Mixed Content warning
- SPA 路由监听带 history wrapper 标记；Bilibili / YouTube 页面内切换视频时会短暂重试读取，避免拿到旧视频信息

V1 不包含登录、付费、自建后端、云端历史记录、评论总结、YouTube playlist 批量总结或 Chrome Extension 版本。

YouTube 无字幕视频的 ASR 接入调研见 [ASR_INTEGRATION_RESEARCH.md](./ASR_INTEGRATION_RESEARCH.md)。
