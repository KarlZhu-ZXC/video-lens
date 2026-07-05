# 工程 Backlog

这里只记录尚未落地的工程风险和建议。已完成功能与状态见
[`FEATURES.md`](./FEATURES.md)，验证历史见 [`progress/README.md`](../progress/README.md)。

最后更新：2026-06-21

## 高优先级：Bilibili 字幕接口 WBI 韧性

`src/sources/bilibili/subtitle.ts` 当前直接请求 `x/player/wbi/v2`，部分场景可能要求
`w_rid` / `wts` 签名。

建议依次评估页面状态复用、`x/player/v2` fallback 和完整 WBI 签名。验收需要覆盖字幕列表解析、
无字幕错误、API fallback，并至少完成一个有字幕 Bilibili 视频的浏览器验证。

## 中优先级：GM XHR 降级状态透明化

文本请求在流式 `fetch` 失败后会回退到非流式 `GM_xmlhttpRequest`，用户目前无法知道为什么输出
变成等待后一次性出现。

建议在降级时显示“已启用跨域背景通道，可能延迟显示”，再单独评估不同 userscript 管理器的
GM XHR 增量响应能力。

## 中低优先级：Userscript 运行时适配层

GM storage、clipboard、XHR 和 `localStorage` fallback 判断仍分散在 store、controller 和 client 中。
建议集中到 `src/runtime/userscriptAdapter.ts`，降低测试成本并为未来 Chrome Extension 迁移保留边界。

## 低优先级：Launcher 窗口缩放越界

Launcher 只在拖动结束时根据当前视口限制坐标。窗口缩小或屏幕方向变化后，已保存坐标可能移出
视口。建议监听 `resize` / `orientationchange`，只在折叠状态重新限制位置，并确保监听器可清理。

## 低优先级：字体策略复核

样式首选 `Geist` / `Geist Mono`，但没有内置字体。默认继续使用系统 fallback；如需统一字体，
优先构建时内联必要字形，不增加第三方 CDN、隐私和 CSP 依赖。
