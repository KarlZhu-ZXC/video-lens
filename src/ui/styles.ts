export const PANEL_STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap");

:host {
  all: initial;
  --vs-bg: #0b0b0f;
  --vs-surface: #111116;
  --vs-surface-low: #15151b;
  --vs-surface-container: #18181e;
  --vs-surface-high: #202028;
  --vs-surface-highest: #282832;
  --vs-outline: #71717a;
  --vs-outline-variant: #3f3f46;
  --vs-text: #fafafa;
  --vs-muted: #a1a1aa;
  --vs-secondary: #71717a;
  --vs-primary: #a78bfa;
  --vs-primary-strong: #7c3aed;
  --vs-tertiary: #34d399;
  --vs-danger: #ef4444;
  --vs-shadow: 0 24px 72px rgba(0, 0, 0, .48);
  color: var(--vs-text);
  font-family: Geist, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
  text-wrap: pretty;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  min-height: 34px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 8px;
  background: var(--vs-surface-high);
  color: var(--vs-text);
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.2;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}

button:hover:not(:disabled) {
  border-color: rgba(167, 139, 250, .62);
  background: var(--vs-surface-highest);
}

button:active:not(:disabled) {
  transform: translateY(1px);
}

button:disabled,
input:disabled,
textarea:disabled,
select:disabled {
  opacity: .52;
  cursor: default;
}

button.primary {
  border-color: var(--vs-primary);
  background: var(--vs-primary);
  color: #0a0012;
  font-weight: 800;
  box-shadow: 0 0 18px rgba(167, 139, 250, .16);
}

button.primary:hover:not(:disabled) {
  background: var(--vs-primary-strong);
  border-color: var(--vs-primary-strong);
  color: var(--vs-text);
  box-shadow: 0 0 24px rgba(167, 139, 250, .24);
}

button.icon {
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  color: var(--vs-muted);
  font-size: 20px;
  line-height: 1;
}

button.icon svg {
  width: 20px;
  height: 20px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-weight: normal;
  font-style: normal;
  font-size: 20px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}

.vs-launcher-wrap {
  position: fixed;
  top: 92px;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  touch-action: none;
}

.vs-launcher-wrap.right { right: 22px; }
.vs-launcher-wrap.left { left: 22px; }
.vs-launcher-wrap.dragged {
  right: auto;
}

.vs-launcher {
  width: 46px;
  height: 46px;
  min-height: 46px;
  display: grid;
  place-items: center;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 14px;
  border: 1px solid rgba(52, 211, 153, .62);
  background:
    radial-gradient(circle at 50% 12%, rgba(52, 211, 153, .24), transparent 56%),
    var(--vs-surface-container);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, .1), 0 14px 34px rgba(0, 0, 0, .44);
}

.vs-launcher-wrap.dragging .vs-launcher {
  cursor: grabbing;
}

.vs-launcher img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  object-position: center;
  justify-self: center;
  align-self: center;
  display: block;
  filter: drop-shadow(0 0 9px rgba(52, 211, 153, .36));
  pointer-events: none;
}

.vs-launcher-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  min-width: 100px;
  max-width: 260px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 10px;
  background: rgba(18, 18, 21, .98);
  box-shadow: 0 18px 48px rgba(0, 0, 0, .42);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 150ms ease, transform 150ms ease;
}

.vs-launcher-wrap:hover .vs-launcher-popover,
.vs-launcher-wrap:focus-within .vs-launcher-popover {
  opacity: 1;
  transform: translate(-50%, 0);
}

.vs-launcher-popover strong {
  font-size: 13px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.vs-launcher-popover span {
  color: var(--vs-muted);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-shell {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 2147483000;
  display: flex;
  width: min(calc(var(--vs-width, 420px) + 72px), calc(100vw - 16px));
  max-height: 100vh;
  overflow: hidden;
  color: var(--vs-text);
  box-shadow: var(--vs-shadow);
}

.vs-shell.wide {
  width: min(calc(var(--vs-width, 420px) + 72px), calc(100vw - 16px));
}

.vs-shell.summary,
.vs-shell.videoInsights {
  width: min(calc(var(--vs-width, 420px) + 122px), calc(100vw - 16px));
}

.vs-shell.right { right: 0; }
.vs-shell.left {
  left: 0;
  flex-direction: row-reverse;
}

.vs-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  z-index: 5;
  cursor: ew-resize;
}

.vs-shell.right .vs-resize-handle { left: 0; }
.vs-shell.left .vs-resize-handle { right: 0; }

.vs-resize-handle::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 3px;
  width: 2px;
  height: 56px;
  border-radius: 999px;
  background: rgba(167, 139, 250, .38);
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 120ms ease;
}

.vs-resize-handle:hover::before,
.vs-resize-handle.dragging::before {
  opacity: 1;
}

.vs-panel {
  position: relative;
  width: calc(100% - 72px);
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--vs-surface-container);
  border-left: 1px solid var(--vs-outline-variant);
  border-right: 1px solid var(--vs-outline-variant);
  overflow: hidden;
}

.vs-toast {
  position: fixed;
  top: 68px;
  width: min(calc(var(--vs-toast-width, 420px) - 32px), calc(100vw - 32px));
  z-index: 2147483001;
  min-height: 42px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 3px;
  overflow: hidden;
  border: 1px solid rgba(167, 139, 250, .34);
  border-radius: 10px;
  background: rgba(18, 18, 21, .96);
  box-shadow: 0 18px 46px rgba(0, 0, 0, .4);
  animation: vs-toast-lifetime 3600ms ease forwards;
}

.vs-toast.right {
  right: 88px;
}

.vs-toast.left {
  left: 88px;
}

.vs-toast span {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  overflow: hidden;
  color: var(--vs-text);
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-toast i {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--vs-primary), var(--vs-tertiary));
  transform-origin: left center;
  animation: vs-toast-progress 3600ms linear forwards;
}

@keyframes vs-toast-progress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@keyframes vs-toast-lifetime {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }
  8%, 86% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.vs-header {
  min-height: 58px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface-container);
}

.vs-brand {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.vs-title {
  font-size: 18px;
  line-height: 1.1;
  font-weight: 850;
  letter-spacing: 0;
}

.vs-subtitle {
  max-width: 100%;
  color: var(--vs-muted);
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-meta {
  display: flex;
  max-width: 172px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.vs-badge {
  max-width: 172px;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid rgba(52, 211, 153, .24);
  border-radius: 999px;
  background: rgba(52, 211, 153, .1);
  color: var(--vs-tertiary);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px;
  line-height: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vs-badge:nth-child(2) {
  border-color: var(--vs-outline-variant);
  background: var(--vs-surface-highest);
  color: var(--vs-muted);
}

.vs-rail {
  width: 72px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 10px;
  border-left: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface);
}

.vs-rail-mascot {
  width: 48px;
  height: 48px;
  object-fit: contain;
  padding: 5px;
  border: 1px solid rgba(52, 211, 153, .32);
  border-radius: 12px;
  background: rgba(52, 211, 153, .08);
  filter: drop-shadow(0 0 8px rgba(52, 211, 153, .24));
}

.vs-rail-line {
  width: 34px;
  height: 1px;
  background: var(--vs-outline-variant);
  margin: 2px 0 6px;
}

.vs-rail-tab {
  width: 50px;
  height: 50px;
  min-height: 50px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--vs-muted);
}

.vs-rail-tab svg {
  width: 24px;
  height: 24px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vs-rail-tab .material-symbols-outlined {
  font-size: 24px;
}

.vs-rail-tab em {
  display: none;
}

.vs-rail-tab:hover:not(:disabled) {
  background: var(--vs-surface-high);
  color: var(--vs-text);
}

.vs-rail-tab.active {
  border-color: rgba(167, 139, 250, .24);
  background: rgba(167, 139, 250, .1);
  color: var(--vs-primary);
}

.vs-rail-tab.active .material-symbols-outlined {
  font-variation-settings: "FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24;
}

.vs-rail-spacer {
  flex: 1;
}

.vs-content {
  min-height: 0;
  display: grid;
  overflow: hidden;
  padding: 16px;
  background: var(--vs-surface-container);
}

.vs-output::-webkit-scrollbar,
.vs-output-content::-webkit-scrollbar,
.vs-chat::-webkit-scrollbar,
.vs-summary-scroll::-webkit-scrollbar,
.vs-one-image-scroll::-webkit-scrollbar,
.vs-thinking pre::-webkit-scrollbar,
.vs-code-block::-webkit-scrollbar,
.vs-table-wrap::-webkit-scrollbar,
.vs-math-block::-webkit-scrollbar,
textarea::-webkit-scrollbar,
.vs-preview-wrap::-webkit-scrollbar,
.vs-preview-content::-webkit-scrollbar,
.vs-content.settings::-webkit-scrollbar,
.vs-settings-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.vs-output::-webkit-scrollbar-track,
.vs-output-content::-webkit-scrollbar-track,
.vs-chat::-webkit-scrollbar-track,
.vs-summary-scroll::-webkit-scrollbar-track,
.vs-one-image-scroll::-webkit-scrollbar-track,
.vs-thinking pre::-webkit-scrollbar-track,
.vs-code-block::-webkit-scrollbar-track,
.vs-table-wrap::-webkit-scrollbar-track,
.vs-math-block::-webkit-scrollbar-track,
textarea::-webkit-scrollbar-track,
.vs-preview-wrap::-webkit-scrollbar-track,
.vs-preview-content::-webkit-scrollbar-track,
.vs-content.settings::-webkit-scrollbar-track,
.vs-settings-scroll::-webkit-scrollbar-track {
  background: var(--vs-surface);
}

.vs-output::-webkit-scrollbar-thumb,
.vs-output-content::-webkit-scrollbar-thumb,
.vs-chat::-webkit-scrollbar-thumb,
.vs-summary-scroll::-webkit-scrollbar-thumb,
.vs-one-image-scroll::-webkit-scrollbar-thumb,
.vs-thinking pre::-webkit-scrollbar-thumb,
.vs-code-block::-webkit-scrollbar-thumb,
.vs-table-wrap::-webkit-scrollbar-thumb,
.vs-math-block::-webkit-scrollbar-thumb,
textarea::-webkit-scrollbar-thumb,
.vs-preview-wrap::-webkit-scrollbar-thumb,
.vs-preview-content::-webkit-scrollbar-thumb,
.vs-content.settings::-webkit-scrollbar-thumb,
.vs-settings-scroll::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, .58);
  border-radius: 999px;
}

.vs-content.settings {
  overflow: hidden;
}

.vs-stack {
  min-height: 100%;
  height: 100%;
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 16px;
  overflow: hidden;
}

.vs-content.summary .vs-stack {
  grid-template-rows: auto auto auto auto minmax(0, 1fr) auto;
}

.vs-content.videoInsights .vs-stack {
  gap: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.vs-content.onePage .vs-stack,
.vs-content.oneImage .vs-stack {
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
}

.vs-content.settings .vs-stack {
  height: auto;
  overflow: visible;
}

.vs-settings-layout {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}

.vs-summary-layout,
.vs-one-image-layout {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}

.vs-settings-scroll,
.vs-summary-scroll,
.vs-one-image-scroll {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 16px;
  overflow: auto;
  padding-right: 4px;
}

.vs-one-image-scroll {
  grid-template-rows: auto auto auto minmax(0, 1fr);
}

.vs-section-title {
  display: grid;
  gap: 6px;
}

.vs-section-title h2 {
  margin: 0;
  color: var(--vs-text);
  font-size: 18px;
  line-height: 1.12;
  font-weight: 850;
  letter-spacing: 0;
}

.vs-section-title p {
  margin: 0;
  color: var(--vs-muted);
  font-size: 13px;
  line-height: 1.35;
}

.vs-video-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 12px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  background: var(--vs-surface-low);
}

.vs-video-thumb {
  position: relative;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 8px;
  background: var(--vs-surface);
}

.vs-video-thumb img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  opacity: .88;
}

.vs-video-thumb.placeholder {
  display: grid;
  place-items: center;
  color: var(--vs-primary);
  font-size: 18px;
  font-weight: 850;
}

.vs-video-duration {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(9, 9, 11, .78);
  color: var(--vs-text);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px;
  line-height: 1.2;
}

.vs-video-info {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.vs-video-info h3 {
  margin: 0;
  overflow: hidden;
  color: var(--vs-text);
  font-size: 14px;
  line-height: 1.35;
  font-weight: 750;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-video-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--vs-muted);
  font-size: 11px;
  line-height: 1.3;
}

.vs-video-meta-item {
  min-width: 0;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.vs-video-meta-item svg,
.vs-config-chip svg,
.vs-start-button svg,
.vs-output-tool svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vs-video-meta-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-video-info p {
  margin: 0;
  overflow: hidden;
  color: var(--vs-secondary);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-row,
.vs-action-band {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.vs-action-band {
  padding: 10px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  background: var(--vs-surface-low);
}

.vs-config-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.vs-config-label {
  min-width: 0;
  color: var(--vs-muted);
  font-size: 11px;
  line-height: 1.2;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
}

.vs-config-chips {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.vs-config-chip {
  min-width: 0;
  max-width: min(178px, 34%);
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 999px;
  background: var(--vs-surface-high);
  color: var(--vs-muted);
  font-size: 11px;
  line-height: 1.2;
}

.vs-config-chip:first-child {
  color: var(--vs-primary);
  border-color: rgba(167, 139, 250, .25);
  background: rgba(167, 139, 250, .08);
}

.vs-config-chip:nth-child(2) {
  color: var(--vs-tertiary);
  border-color: rgba(52, 211, 153, .24);
  background: rgba(52, 211, 153, .08);
}

.vs-config-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-start-button {
  width: 100%;
  min-height: 48px;
  justify-content: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  font-size: 14px;
}

.vs-bottom-actions {
  display: grid;
  gap: 10px;
  padding: 12px 0 0;
  border-top: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface-container);
}

.vs-status {
  min-height: 30px;
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 8px;
  background: var(--vs-surface-highest);
  color: var(--vs-muted);
  font-size: 12px;
  line-height: 1.3;
}

.vs-status.busy {
  color: var(--vs-primary);
  border-color: rgba(167, 139, 250, .42);
}

.vs-subtitle-picker {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.vs-subtitle-picker span {
  color: var(--vs-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.vs-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--vs-outline-variant);
}

.vs-progress span {
  display: block;
  width: 34%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--vs-primary), var(--vs-tertiary));
  animation: vs-progress-sway 920ms ease-in-out infinite alternate;
}

.vs-progress.idle {
  display: none;
  animation: none;
}

.vs-progress.idle span {
  animation: none;
}

@keyframes vs-progress-sway {
  from { transform: translateX(0); }
  to { transform: translateX(194%); }
}

.vs-output,
.vs-chat,
.vs-preview-wrap {
  min-height: 300px;
  max-height: none;
  overflow: auto;
  position: relative;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  background: var(--vs-surface);
  padding: 16px;
}

.vs-output {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: visible;
  padding: 0;
}

.vs-output-toolbar {
  position: relative;
  z-index: 4;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--vs-outline-variant);
  background: rgba(18, 18, 21, .78);
}

.vs-output-tool {
  position: relative;
  z-index: 2;
  width: 32px;
  height: 32px;
  min-height: 32px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  color: var(--vs-muted);
}

.vs-output-tool::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 8;
  max-width: 180px;
  padding: 6px 8px;
  border: 1px solid rgba(167, 139, 250, .36);
  border-radius: 7px;
  background: rgba(18, 18, 21, .98);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .36);
  color: var(--vs-text);
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.vs-output-tool:hover:not(:disabled)::after,
.vs-output-tool:focus-visible:not(:disabled)::after {
  opacity: 1;
  transform: translateY(0);
}

.vs-output-content {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.vs-output::before,
.vs-chat::before,
.vs-preview-wrap::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .045;
  background:
    radial-gradient(circle at 2px 2px, rgba(167, 139, 250, .7) 1px, transparent 0);
  background-size: 24px 24px;
}

.vs-output > *,
.vs-output-content > *,
.vs-chat > *,
.vs-preview-wrap > * {
  position: relative;
}

.vs-empty,
.vs-pending {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 9px;
  color: var(--vs-muted);
  text-align: center;
}

.vs-empty strong,
.vs-pending strong {
  color: var(--vs-text);
  font-size: 15px;
}

.vs-empty p,
.vs-pending p {
  max-width: 300px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
}

.vs-pending-dots {
  display: flex;
  gap: 6px;
}

.vs-pending-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--vs-primary);
  animation: vs-dot 900ms ease-in-out infinite alternate;
}

.vs-pending-dots span:nth-child(2) { animation-delay: 120ms; }
.vs-pending-dots span:nth-child(3) { animation-delay: 240ms; }

@keyframes vs-dot {
  from { opacity: .35; transform: translateY(0); }
  to { opacity: 1; transform: translateY(-3px); }
}

.vs-thinking,
.vs-thinking-inline {
  margin-bottom: 10px;
  color: var(--vs-secondary);
  font-size: 12px;
  line-height: 1.35;
}

.vs-thinking {
  border-left: 2px solid var(--vs-outline-variant);
  padding-left: 10px;
}

.vs-thinking summary {
  cursor: pointer;
  color: var(--vs-muted);
  font-weight: 650;
  list-style-position: outside;
}

.vs-thinking summary:hover {
  color: var(--vs-text);
}

.vs-thinking pre {
  margin: 8px 0 0;
  max-height: 180px;
  overflow: auto;
  color: var(--vs-secondary);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.vs-thinking-inline {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding-left: 2px;
}

.vs-thinking-inline::before {
  content: "";
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--vs-secondary);
  animation: vs-thinking-pulse 900ms ease-in-out infinite alternate;
}

.vs-thinking-inline span {
  flex: 0 0 auto;
  color: var(--vs-muted);
  font-weight: 650;
}

.vs-thinking-inline em {
  min-width: 0;
  overflow: hidden;
  color: var(--vs-secondary);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes vs-thinking-pulse {
  from { opacity: .38; }
  to { opacity: .9; }
}

.vs-markdown {
  color: var(--vs-text);
  font-size: 14px;
  line-height: 1.7;
}

.vs-markdown h1,
.vs-markdown h2,
.vs-markdown h3,
.vs-markdown h4 {
  margin: 22px 0 9px;
  color: var(--vs-text);
  line-height: 1.25;
  letter-spacing: 0;
}

.vs-markdown h1:first-child,
.vs-markdown h2:first-child,
.vs-markdown h3:first-child,
.vs-markdown h4:first-child {
  margin-top: 0;
}

.vs-markdown h1 { color: var(--vs-primary); font-size: 20px; }
.vs-markdown h2 {
  padding-top: 6px;
  border-top: 1px solid rgba(63, 63, 70, .7);
  font-size: 17px;
}
.vs-markdown h3 { font-size: 15px; }
.vs-markdown h4 { font-size: 14px; }

.vs-markdown p {
  margin: 0 0 12px;
}

.vs-markdown blockquote {
  margin: 0 0 14px;
  padding: 9px 12px;
  border-left: 3px solid var(--vs-primary);
  border-radius: 8px;
  background: rgba(167, 139, 250, .08);
  color: var(--vs-muted);
}

.vs-markdown blockquote p {
  margin: 0;
}

.vs-markdown ul,
.vs-markdown ol {
  margin: 0 0 14px;
  padding-left: 20px;
  color: var(--vs-muted);
}

.vs-markdown li {
  margin: 7px 0;
}

.vs-markdown code {
  padding: 2px 5px;
  border-radius: 5px;
  background: rgba(167, 139, 250, .1);
  color: var(--vs-primary);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: .88em;
}

.vs-code-block {
  position: relative;
  margin: 0 0 14px;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 10px;
  background: #08080a;
}

.vs-code-block code {
  padding: 0;
  background: transparent;
  color: var(--vs-text);
  white-space: pre;
}

.vs-code-lang {
  position: absolute;
  top: 6px;
  right: 8px;
  color: var(--vs-secondary);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px;
}

.vs-table-wrap {
  max-width: 100%;
  overflow: auto;
  margin: 0 0 14px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 10px;
}

.vs-markdown table {
  width: 100%;
  border-collapse: collapse;
  min-width: 320px;
}

.vs-markdown th,
.vs-markdown td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--vs-outline-variant);
  text-align: left;
  vertical-align: top;
}

.vs-markdown th {
  background: var(--vs-surface-high);
  color: var(--vs-primary);
  font-weight: 800;
}

.vs-markdown tr:last-child td {
  border-bottom: 0;
}

.vs-math-inline,
.vs-math-block {
  font-family: "Geist Mono", ui-monospace, monospace;
  color: var(--vs-tertiary);
}

.vs-math-inline {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(52, 211, 153, .08);
}

.vs-math-block {
  overflow: auto;
  margin: 0 0 14px;
  padding: 12px;
  border: 1px solid rgba(52, 211, 153, .2);
  border-radius: 10px;
  background: rgba(52, 211, 153, .07);
  white-space: pre;
}

.vs-markdown img {
  max-width: 100%;
  border-radius: 8px;
  display: block;
}

.vs-markdown a {
  color: var(--vs-primary);
}

.vs-ai-response {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.vs-chat {
  display: grid;
  align-content: start;
  gap: 16px;
}

.vs-content.videoInsights .vs-chat {
  min-height: 0;
  border-width: 0;
  border-radius: 0;
  background: transparent;
  padding: 16px;
}

.vs-insight-context {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface-high);
  color: var(--vs-secondary);
}

.vs-insight-context .material-symbols-outlined {
  font-size: 14px;
}

.vs-insight-context svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vs-insight-context p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.3;
}

.vs-insight-context span {
  color: var(--vs-text);
}

.vs-message {
  display: grid;
  gap: 5px;
  max-width: 86%;
}

.vs-message.user {
  justify-self: end;
}

.vs-message.assistant {
  justify-self: start;
}

.vs-message span {
  padding: 0 4px;
  color: var(--vs-secondary);
  font-size: 10px;
  line-height: 1;
}

.vs-message > p {
  margin: 0;
  padding: 11px 12px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  color: var(--vs-text);
  font-size: 13px;
  line-height: 1.5;
}

.vs-message.typing {
  max-width: 86px;
}

.vs-typing-bubble {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  border-top-left-radius: 3px;
  background: var(--vs-surface-high);
}

.vs-typing-bubble span {
  width: 6px;
  height: 6px;
  padding: 0;
  border-radius: 999px;
  background: var(--vs-primary);
  animation: vs-dot 900ms ease-in-out infinite alternate;
}

.vs-typing-bubble span:nth-child(2) { animation-delay: 120ms; }
.vs-typing-bubble span:nth-child(3) { animation-delay: 240ms; }

.vs-message.user > p {
  border-color: rgba(167, 139, 250, .72);
  border-top-right-radius: 3px;
  background: var(--vs-surface);
}

.vs-message.assistant > p {
  border-top-left-radius: 3px;
  background: var(--vs-surface-high);
}

.vs-message.assistant .vs-ai-response {
  padding: 11px 12px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  border-top-left-radius: 3px;
  background: var(--vs-surface-high);
  color: var(--vs-text);
  font-size: 13px;
  line-height: 1.55;
}

.vs-message.assistant .vs-ai-response .vs-markdown {
  font-size: inherit;
}

textarea,
input,
select {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 8px;
  background: var(--vs-surface);
  color: var(--vs-text);
  padding: 8px 10px;
  outline: none;
  font-size: 13px;
  line-height: 1.35;
}

textarea {
  min-height: 86px;
  resize: vertical;
}

.vs-chat-input {
  padding: 16px;
  border-top: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface-container);
}

.vs-chat-composer {
  display: flex;
  align-items: end;
  gap: 8px;
  min-height: 56px;
  padding: 8px 8px 8px 16px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 28px;
  background: var(--vs-surface-highest);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.vs-chat-composer:focus-within {
  border-color: rgba(167, 139, 250, .5);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, .12);
}

.vs-chat-composer textarea {
  min-height: 40px;
  max-height: 128px;
  resize: none;
  padding: 10px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.vs-chat-composer textarea:focus {
  border-color: transparent;
  box-shadow: none;
}

.vs-chat-send {
  width: 32px;
  height: 32px;
  min-height: 32px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--vs-primary);
  color: var(--vs-bg);
}

.vs-chat-send svg {
  width: 18px;
  height: 18px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

input:focus,
textarea:focus,
select:focus {
  border-color: rgba(167, 139, 250, .72);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, .16);
}

.vs-field {
  display: grid;
  gap: 6px;
}

.vs-field label,
.vs-settings-group h3 {
  color: var(--vs-muted);
  font-size: 11px;
  line-height: 1.2;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.vs-settings-group {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--vs-outline-variant);
  border-radius: 12px;
  background: var(--vs-surface);
}

.vs-settings-group h3 {
  margin: 0;
  color: var(--vs-primary);
}

.vs-settings-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.vs-settings-group-header h3 {
  margin: 0;
}

.vs-connectivity-test {
  min-height: 28px;
  padding: 5px 9px;
  font-size: 11px;
}

.vs-settings-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px 0 0;
  border-top: 1px solid var(--vs-outline-variant);
  background: var(--vs-surface-container);
}

.vs-settings-validation {
  grid-column: 1 / -1;
  padding: 8px 10px;
  border: 1px solid rgba(239, 68, 68, .36);
  border-radius: 8px;
  background: rgba(239, 68, 68, .1);
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.35;
}

.vs-settings-validation[hidden] {
  display: none;
}

.vs-card {
  width: 900px;
  max-width: 100%;
  min-height: 1220px;
  overflow: hidden;
  border: 1px solid rgba(250, 250, 250, .18);
  border-radius: 24px;
  background: #f7f3eb;
  color: #161316;
  box-shadow: 0 24px 72px rgba(0, 0, 0, .32);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.vs-card-classic {
  display: grid;
  grid-template-rows: 360px 1fr;
}

.vs-card-visual {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 16%, rgba(167, 139, 250, .42), transparent 30%),
    radial-gradient(circle at 84% 28%, rgba(52, 211, 153, .36), transparent 28%),
    linear-gradient(135deg, #17121f, #24323a 56%, #efe4d0);
  background-size: cover;
  background-position: center;
}

.vs-card-visual::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .02), rgba(0, 0, 0, .28)),
    radial-gradient(circle at 50% 110%, rgba(247, 243, 235, .9), transparent 52%);
}

.vs-card-body {
  display: grid;
  align-content: start;
  gap: 24px;
  padding: 48px 56px 56px;
}

.vs-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.vs-card-tags span {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(124, 58, 237, .12);
  color: #5b21b6;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 800;
}

.vs-card h1 {
  margin: 0;
  color: #161316;
  font-size: 52px;
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: 0;
}

.vs-card-subtitle,
.vs-card-conclusion,
.vs-card-points p,
.vs-card-takeaways li,
.vs-card footer {
  margin: 0;
  color: #3f3a42;
  font-size: 24px;
  line-height: 1.5;
}

.vs-card-conclusion {
  padding: 22px 24px;
  border-left: 6px solid #7c3aed;
  border-radius: 14px;
  background: rgba(255, 255, 255, .68);
  color: #201b24;
  font-weight: 750;
}

.vs-card-points {
  display: grid;
  gap: 14px;
}

.vs-card-points section {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  border: 1px solid rgba(22, 19, 22, .1);
  border-radius: 16px;
  background: rgba(255, 255, 255, .58);
}

.vs-card-points strong,
.vs-card-takeaways h2 {
  color: #18151b;
  font-size: 26px;
  line-height: 1.25;
  font-weight: 900;
}

.vs-card-takeaways {
  display: grid;
  gap: 12px;
  padding: 22px 24px;
  border-radius: 18px;
  background: #17151b;
  color: #fafafa;
}

.vs-card-takeaways h2 {
  margin: 0;
  color: #fafafa;
}

.vs-card-takeaways ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 26px;
}

.vs-card-takeaways li {
  color: rgba(250, 250, 250, .86);
}

.vs-card footer {
  overflow: hidden;
  color: #6b626f;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-card-image-only {
  min-height: auto;
  display: grid;
  aspect-ratio: 1 / 1;
  background: var(--vs-surface);
}

.vs-card-image-only img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.vs-preview-wrap {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: stretch;
  align-content: stretch;
  min-height: 420px;
  overflow: visible;
  padding: 0;
}

.vs-preview-toolbar {
  position: relative;
  z-index: 4;
  min-height: 44px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--vs-outline-variant);
  background: rgba(18, 18, 21, .78);
}

.vs-toolbar-spacer {
  flex: 1;
}

.vs-preview-content {
  min-height: 0;
  display: grid;
  justify-items: center;
  align-content: start;
  overflow: auto;
  padding: 16px;
}

.vs-image-viewer-stage {
  width: var(--vs-card-width, 900px);
  max-width: none;
  zoom: var(--vs-zoom, 1);
}

.vs-image-viewer-stage > * {
  max-width: none;
}

.vs-preview-content > div:not(.vs-empty):not(.vs-image-viewer-stage) {
  max-width: 100%;
}

@media (max-width: 560px) {
  .vs-toast.right,
  .vs-toast.left {
    left: 16px;
    right: auto;
  }

  .vs-shell,
  .vs-shell.wide,
  .vs-shell.summary,
  .vs-shell.videoInsights {
    width: 100vw;
  }

  .vs-header {
    grid-template-columns: minmax(0, 1fr) 32px;
  }

  .vs-meta {
    display: none;
  }

  .vs-content {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;
