# 项目优化与改进建议报告 (PROJECT_REVIEW_RECOMMENDATIONS)

基于对当前 `video-summary` 核心源码（包括 API 请求客户端、字幕解析器、DOM 渲染引擎、Obsidian 设计系统及平台适配）的全面 Review，我们整理出以下在**架构设计、多浏览器兼容性、平台稳定性及用户体验**上急需改进的 7 个核心点，并提供了具体的代码改进方案。

---

## 1. 【高优先级】哔哩哔哩字幕 API 签名 (WBI) 机制失效风险

### 问题分析
在 `src/sources/bilibili/subtitle.ts` 中，获取视频字幕列表直接请求了 Bilibili 的播放器 API 接口：
```typescript
async function getSubtitleList(video: VideoInfo): Promise<SubtitleMeta[]> {
  const res = await fetch(
    `https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(video.bvid!)}&cid=${video.cid}`,
    { credentials: 'include' },
  );
  ...
}
```
**致命缺陷**：B站已对带有 `wbi` 路径的所有接口（如 `x/player/wbi/v2`）强制实施了 WBI 签名校验。在前端直接发起 Fetch / GM 请求，若不带 `w_rid` 和 `wts` 签名参数，B站服务器会拦截请求并返回 `code: -403` 或 `-401`（签名校验失败），导致用户在使用该 userscript 时遭遇“当前视频没有公开字幕”或“字幕列表请求失败”的报错。

### 改进方案
1. **采用免签名接口降级**：调用无 WBI 校验的传统接口，例如 `https://api.bilibili.com/x/player/v2?bvid=...&cid=...`。
2. **优先从页面 DOM 数据读取**：B站页面通常会在 `window.__INITIAL_STATE__` 中暴露字幕列表。应优先利用已经载入的内存状态，减少 API 网络请求。
3. **补充 WBI 签名算法**：若必须调用该接口，需先请求 `https://api.bilibili.com/x/web-interface/nav` 拿到 `img_key` 和 `sub_key`，然后在客户端完成 WBI 混淆盐值签名计算。

---

## 2. 【中高优先级】Firefox 浏览器 OneImage 缩放 (CSS `zoom`) 兼容性崩溃

### 问题分析
在一图流预览视图（`src/ui/oneImageView.ts`）和布局样式（`src/ui/styles.ts`）中，一图流生成的卡片缩放完全依赖 CSS 的 `zoom` 属性：
```css
.vs-image-viewer-stage {
  width: var(--vs-card-width, 900px);
  max-width: none;
  zoom: var(--vs-zoom, 1);
}
```
**兼容性缺陷**：`zoom` 属性从来都不是 W3C 的标准 CSS 属性。虽然 Chromium (Chrome/Edge/Brave) 和 WebKit (Safari) 对其进行了事实支持，但 **Firefox 浏览器完全不支持 `zoom`**。
在 Firefox 浏览器下，一图流卡片将始终保持 900px 的全宽，使得缩放滑块及适配逻辑彻底失效，严重破坏 Obsidian UI 面板的视觉完整度。

### 改进方案
摒弃 `zoom`，使用标准的 CSS 2D 转换 `transform: scale()` 进行适配，并使用 `transform-origin` 保证对齐：
```css
.vs-image-viewer-stage {
  width: var(--vs-card-width, 900px);
  max-width: none;
  transform: scale(var(--vs-zoom, 1));
  transform-origin: top center;
}
```
*注：由于使用 `scale` 缩放后，DOM 节点在文档流中所占的物理高度不会自动收缩，需要在包裹容器上计算并设置等比例的高度补偿，或设定 `overflow: hidden` 防止页面纵向出现大面积空白。*

---

## 3. 【中优先级】Obsidian 主题中 "Geist" 和 "Geist Mono" 字体缺失加载

### 问题分析
在 `DESIGN.md` 中，项目声明统一使用 “Geist” 现代极客字体。在全局样式（`src/ui/styles.ts`）中，也做了如下声明：
```css
:host {
  font-family: Geist, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.vs-video-duration {
  font-family: "Geist Mono", ui-monospace, monospace;
}
```
**体验缺失**：项目中**仅引入了谷歌的 Material Symbols 图标字体，而根本没有加载 Geist 与 Geist Mono 的任何字体文件**。
如果用户的操作系统上未安装 Geist 字体（99% 的普通用户均未安装），浏览器将默认降级到 `ui-sans-serif` 等系统常规字体。这使得本应充满科技质感、Obsidian 高级黑曜石感的 developer-grade 视觉美感打了折扣。

### 改进方案
在 `PANEL_STYLES` 顶部或 `styles.ts` 中，通过 CDN 显式引入 Geist 字体族文件：
```css
@import url("https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/style.css");
@import url("https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-mono/style.css");
```
这能确保跨平台（Win/Mac/Linux）和不同设备的用户都能体验到极致一致的高级暗色视觉。

---

## 4. 【中优先级】`DirectOpenAITextClient` 自动降级时的静默体验流失

### 问题分析
在 `DirectOpenAITextClient.ts` 中，系统采用非常棒的 `auto` 请求机制：优先尝试 `fetch` 进行流式摘要；当遇到跨域 CORS 拦截或 CSP (Content Security Policy) 限制而失败时，捕获异常并静默降级为 Tampermonkey 独占的 `GM_xmlhttpRequest`。
```typescript
try {
  return await this.completeWithFetch(request, apiKey, options);
} catch (error) {
  if (typeof GM_xmlhttpRequest !== 'function') throw error;
  return this.completeWithGmXhr(request, apiKey); // 静默回退
}
```
**体验缺陷**：由于 `completeWithGmXhr` 采用的是 `stream: false` 的非流式传统网络请求，一旦发生回退：
1. 流式打印动画会完全失效，界面会一直停留在“生成摘要”长达 10~20 秒。
2. 用户不知道发生了降级，以为程序卡死，极易误触或直接关闭。

### 改进方案
1. **支持 GM_xmlhttpRequest 流式传输**：现代 Tampermonkey 的 `GM_xmlhttpRequest` 支持 `onreadystatechange` 监听。可封装 GM 通道流式解析，使其在降级后依然能够流畅实现打字机效果。
2. **降级状态透明化**：在触发 catch 块降级时，通知 Controller 在 UI 状态栏输出一行微弱的提示（如：*“由于浏览器安全拦截，已自动启用跨域背景通道，流式传输可能会有延迟展示”*），提高系统的高级感和透明度。

---

## 5. 【中低优先级】缺乏统一的 Userscript API 平台兼容适配层

### 问题分析
当前代码中，对于 `GM_getValue`、`GM_setValue`、`GM_setClipboard` 等特有接口的调用散落在各处，带有大量冗余的环境判断：
```typescript
const raw = typeof GM_getValue === 'function' ? GM_getValue(CONFIG_KEY, '') : localStorage.getItem(CONFIG_KEY);
if (typeof GM_setClipboard === 'function') GM_setClipboard(content);
```
**架构问题**：
* 造成了大量的重复判断代码，不够整洁。
* 在 Vite Harness 本地测试（`harness.html`）中，不得不频繁去补齐或者 patch 这些全局变量，极其不利于编写整洁的单元测试。
* 无法平滑兼容诸如 Violentmonkey、Greasemonkey 等对老旧 `GM_` 支持度不一的脚本管理器，以及未来可能进行的 Chrome Extension（MV3）移植。

### 改进方案
在 `src/utils/` 下抽象出一个统一的平台适配器（例如 `environment.ts` 或 `gmAdapter.ts`）：
```typescript
export const storage = {
  get: (key: string, fallback: string): string => {
    return typeof GM_getValue === 'function' ? GM_getValue(key, fallback) : localStorage.getItem(key) ?? fallback;
  },
  set: (key: string, value: string): void => {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
    else localStorage.setItem(key, value);
  }
};
export const clipboard = {
  copy: async (text: string): Promise<void> => {
    if (typeof GM_setClipboard === 'function') GM_setClipboard(text);
    else await navigator.clipboard?.writeText(text);
  }
};
```
让 Controller 和 Store 彻底与具体的 userscript 运行时解耦，使得业务逻辑纯净化，单元测试更轻量。

---

## 6. 【中优先级】`html-to-image` 导出图片在严格 CSP 站点下的拦截容错

### 问题分析
一图流导出使用 `html-to-image` 库，在底层会动态将 DOM 节点克隆，将其作为 `foreignObject` 封装进 SVG 并转化为 data URL 渲染。
**致命痛点**：在 YouTube 和 Bilibili 等实行极高安全等级 CSP (Content Security Policy) 的网页中，浏览器可能会彻底拦截 `data:` 图片协议的加载，或当一图流中包含外部 network 图片时，外部资源可能会使 Canvas 跨域污染（CORS Taint），导致 PNG 导出报错 `SecurityError`。

### 改进方案
1. **异常抛出与诊断指引**：在 `AppController.ts` 导出异常的 catch 块中，识别典型跨域/安全策略报错，弹出明确指引（如：*“导出图片被网站安全策略拦截，您可以直接使用系统截图，或前往独立网页/Vite测试页导出。”*）
2. **CORS 图片代理转化**：对于卡片内用到的网络图片，先通过 `GM_xmlhttpRequest` 在 background 下载为 Blob，再转为本地的 Object URL 填充进卡片，彻底避开浏览器的画布沙箱污染。

---

## 7. 【低优先级】Mascot 拖动悬浮在窗口 Resize 时的视口越界拦截

### 问题分析
Mascot 悬浮按钮允许用户自由拖动并记录坐标，但在 `Panel.ts` 的拖拽越界拦截中，仅在 `pointerup` 阶段对当前的窗口宽高进行了 Clamp。
**体验缺陷**：如果用户将 Mascot 拖动至浏览器最右侧边缘，之后将浏览器窗口缩小（Resize）或设备从横屏切换为竖屏，Mascot 很有可能会瞬间掉出当前的屏幕视口，导致用户在不刷新页面的情况下“再也找不到悬浮球”，无法重新呼出面板。

### 改进方案
在 `Panel` 组件挂载时，监听全局的视口改变事件，并自动重定位越界悬浮球：
```typescript
window.addEventListener('resize', () => {
  if (this.controller.config.ui.collapsed && this.shellNode) {
    const rect = this.shellNode.getBoundingClientRect();
    const safePos = clampLauncherPosition(rect.left, rect.top, this.shellNode);
    this.shellNode.style.left = `${safePos.x}px`;
    this.shellNode.style.top = `${safePos.y}px`;
  }
});
```
确保面板在任何屏幕分辨率动态调整下均能维持 100% 的可用性和可交互性。
