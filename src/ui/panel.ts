import type { AppController } from '../app/AppController';
import { el } from '../utils/dom';
import { PANEL_STYLES } from './styles';
import type { TabId } from './types';
import { renderSummaryView } from './summaryView';
import { renderVideoInsightsView } from './videoInsightsView';
import { renderOneImageView } from './oneImageView';
import { renderSettingsView } from './settingsModal';
import { createUiText } from './i18n';
import mascotLogoUrl from '../../assets/mascot/flat/logo.svg';

export class Panel {
  private readonly host = document.createElement('div');
  private readonly root: ShadowRoot;
  private readonly styleNode = el('style', {}, [PANEL_STYLES]);
  private shellNode?: HTMLElement;
  private toastNode?: HTMLElement;
  private renderedToastId?: number;
  private activeTab: TabId;
  private thinkingOpen: boolean | undefined;
  private summaryOutputSticksToBottom = true;
  private summaryOutputScrollTop = 0;
  private videoInsightsChatSticksToBottom = true;
  private videoInsightsChatScrollTop = 0;
  private settingsDirty = false;
  private saveSettingsBeforeLeave?: () => boolean;

  constructor(private readonly controller: AppController) {
    this.activeTab = controller.config.ui.defaultTab;
    this.root = this.host.attachShadow({ mode: 'open' });
    document.documentElement.append(this.host);
  }

  render(): void {
    this.captureScrollIntent();
    if (!this.styleNode.isConnected) this.root.append(this.styleNode);
    this.shellNode?.remove();
    if (this.controller.config.ui.collapsed) {
      const t = createUiText(this.controller.config.ui.language);
      const launcherPosition = this.controller.config.ui.launcherPosition;
      const launcher = el('div', {
        class: `vs-launcher-wrap ${this.controller.config.ui.position} ${launcherPosition ? 'dragged' : ''}`,
        style: launcherPosition ? `left:${launcherPosition.x}px;top:${launcherPosition.y}px` : undefined,
      }, [
        el('button', {
          class: 'vs-launcher',
          title: t('launcherTitle'),
          'aria-label': t('launcherTitle'),
        }, [
          el('img', { src: mascotLogoUrl, alt: t('appName') }),
        ]),
        el('div', { class: 'vs-launcher-popover', role: 'tooltip' }, [
          el('strong', {}, [t('appName')]),
        ]),
      ]);
      this.bindLauncherDrag(launcher);
      this.shellNode = launcher;
      this.root.append(launcher);
      this.renderToast();
      return;
    }

    const shell = el('section', {
      class: `vs-shell ${this.controller.config.ui.position} ${this.activeTab} ${this.activeTab === 'oneImage' ? 'wide' : ''}`,
      style: `--vs-width:${this.controller.config.ui.panelWidth}px`,
    });
    shell.append(this.renderResizeHandle());
    const panel = el('aside', { class: 'vs-panel' });
    panel.append(
      this.renderHeader(),
      el('main', { class: `vs-content ${this.activeTab}` }, [this.renderActiveTab()]),
    );
    shell.append(panel, this.renderRail());
    this.shellNode = shell;
    this.root.append(shell);
    this.renderToast();
    this.restoreSummaryScroll();
    this.restoreVideoInsightsScroll();
  }

  destroy(): void {
    this.host.remove();
  }

  private renderHeader(): HTMLElement {
    const t = createUiText(this.controller.config.ui.language);
    const header = this.headerContent(t);
    return el('header', { class: 'vs-header' }, [
      el('div', { class: 'vs-brand' }, [
        el('div', { class: 'vs-title' }, [header.title]),
        header.caption ? el('div', { class: 'vs-subtitle' }, [header.caption]) : '',
      ]),
      this.iconButton(t('closePanel'), () => this.controller.toggleCollapsed()),
    ]);
  }

  private renderToast(): void {
    const toast = this.controller.state.toast;
    if (!toast) {
      this.toastNode?.remove();
      this.toastNode = undefined;
      this.renderedToastId = undefined;
      return;
    }
    if (!this.toastNode || this.renderedToastId !== toast.id) {
      this.toastNode?.remove();
      this.toastNode = el('div', { role: 'status', 'aria-live': 'polite' }, [
        el('span', {}, [toast.message]),
        el('i', { 'aria-hidden': 'true' }),
      ]);
      this.renderedToastId = toast.id;
      this.root.append(this.toastNode);
    }
    this.toastNode.className = `vs-toast ${this.controller.config.ui.position}`;
    this.toastNode.setAttribute('style', `--vs-toast-width:${this.toastPanelWidth()}px`);
  }

  private headerContent(t: ReturnType<typeof createUiText>): { title: string; caption?: string } {
    if (this.activeTab === 'videoInsights') {
      return { title: t('videoInsights.title'), caption: t('videoInsights.caption') };
    }
    if (this.activeTab === 'oneImage') {
      return { title: t('oneImage.title'), caption: t('oneImage.caption') };
    }
    if (this.activeTab === 'settings') {
      return { title: t('settings.title'), caption: t('settings.caption') };
    }
    return { title: t('appName') };
  }

  private renderRail(): HTMLElement {
    const t = createUiText(this.controller.config.ui.language);
    const tabs: Array<[TabId, string, string]> = [
      ['summary', t('tabs.summary'), t('tabs.summaryEyebrow')],
      ['videoInsights', t('tabs.videoInsights'), t('tabs.videoInsightsEyebrow')],
      ['oneImage', t('tabs.oneImage'), t('tabs.oneImageEyebrow')],
      ['settings', t('tabs.settings'), t('tabs.settingsEyebrow')],
    ];
    return el(
      'nav',
      { class: 'vs-rail', 'aria-label': 'AI Summary navigation' },
      [
        el('img', { class: 'vs-rail-mascot', src: mascotLogoUrl, alt: t('appName') }),
        el('div', { class: 'vs-rail-line' }),
        ...tabs.map(([id, label, eyebrow]) => {
          const tab = el('button', {
            class: `vs-rail-tab ${this.activeTab === id ? 'active' : ''}`,
            title: `${eyebrow} · ${label}`,
            'aria-label': label,
          }, [
            panelIcon(id),
            el('em', {}, [label]),
          ]);
          tab.addEventListener('click', () => {
            if (this.activeTab === id) return;
            if (!this.canLeaveActiveTab()) return;
            this.activeTab = id;
            this.render();
          });
          return tab;
        }),
        el('div', { class: 'vs-rail-spacer' }),
      ],
    );
  }

  private renderResizeHandle(): HTMLElement {
    const handle = el('div', {
      class: 'vs-resize-handle',
      title: '拖动调整面板宽度',
      role: 'separator',
      'aria-orientation': 'vertical',
    });
    let pointerId: number | undefined;
    let startX = 0;
    let startWidth = 0;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startWidth = this.controller.config.ui.panelWidth;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('dragging');
    });
    handle.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const direction = this.controller.config.ui.position === 'right' ? -1 : 1;
      const nextWidth = clampPanelWidth(startWidth + (event.clientX - startX) * direction);
      this.shellNode?.style.setProperty('--vs-width', `${nextWidth}px`);
    });
    handle.addEventListener('pointerup', (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = undefined;
      handle.releasePointerCapture(event.pointerId);
      handle.classList.remove('dragging');
      const direction = this.controller.config.ui.position === 'right' ? -1 : 1;
      this.controller.updateConfig({
        ui: {
          ...this.controller.config.ui,
          panelWidth: clampPanelWidth(startWidth + (event.clientX - startX) * direction),
        },
      }, { showStatus: false });
    });
    handle.addEventListener('pointercancel', (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = undefined;
      handle.classList.remove('dragging');
    });
    return handle;
  }

  private toastPanelWidth(): number {
    const baseWidth = this.controller.config.ui.panelWidth;
    if (this.activeTab === 'oneImage') return 750;
    if (this.activeTab === 'summary' || this.activeTab === 'videoInsights') return baseWidth + 50;
    return baseWidth;
  }

  private renderActiveTab(): HTMLElement {
    if (this.activeTab === 'videoInsights') return renderVideoInsightsView(this.controller);
    if (this.activeTab === 'oneImage') return renderOneImageView(this.controller);
    if (this.activeTab === 'settings') {
      return renderSettingsView(this.controller, {
        onDirtyChange: (dirty) => {
          this.settingsDirty = dirty;
        },
        registerSave: (save) => {
          this.saveSettingsBeforeLeave = save;
        },
      });
    }
    return renderSummaryView(this.controller, {
      thinkingOpen: this.thinkingOpen,
      onThinkingToggle: (open) => {
        this.thinkingOpen = open;
      },
    });
  }

  private iconButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = el('button', { class: 'icon', title: label, 'aria-label': label }, [panelIcon('collapse')]);
    button.addEventListener('click', onClick);
    return button;
  }

  private canLeaveActiveTab(): boolean {
    if (this.activeTab !== 'settings') return true;
    const canLeave = shouldLeaveSettingsTab(
      this.settingsDirty,
      () => window.confirm('设置尚未保存，是否保存更改？'),
      this.saveSettingsBeforeLeave,
    );
    if (canLeave) {
      this.settingsDirty = false;
      this.saveSettingsBeforeLeave = undefined;
    }
    return canLeave;
  }

  private bindLauncherDrag(launcher: HTMLElement): void {
    let pointerId: number | undefined;
    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    launcher.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startClientX = event.clientX;
      startClientY = event.clientY;
      const rect = launcher.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      moved = false;
      launcher.setPointerCapture(event.pointerId);
    });

    launcher.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startClientX;
      const dy = event.clientY - startClientY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      event.preventDefault();
      const position = clampLauncherPosition(startLeft + dx, startTop + dy, launcher);
      launcher.classList.add('dragging', 'dragged');
      launcher.style.left = `${position.x}px`;
      launcher.style.top = `${position.y}px`;
    });

    launcher.addEventListener('pointerup', (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = undefined;
      launcher.releasePointerCapture(event.pointerId);
      launcher.classList.remove('dragging');
      if (!moved) {
        this.controller.toggleCollapsed();
        return;
      }
      const rect = launcher.getBoundingClientRect();
      this.controller.updateLauncherPosition(clampLauncherPosition(rect.left, rect.top, launcher));
    });

    launcher.addEventListener('pointercancel', (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = undefined;
      launcher.classList.remove('dragging');
    });
  }

  private captureScrollIntent(): void {
    if (this.activeTab === 'summary') {
      const output = this.root.querySelector('.vs-output-content');
      if (!output) {
        this.summaryOutputSticksToBottom = false;
        return;
      }
      const distanceFromBottom = output.scrollHeight - output.scrollTop - output.clientHeight;
      this.summaryOutputSticksToBottom = distanceFromBottom < 96;
      this.summaryOutputScrollTop = output.scrollTop;
    }
    if (this.activeTab === 'videoInsights') {
      const chat = this.root.querySelector('.vs-chat');
      if (!chat) {
        this.videoInsightsChatSticksToBottom = true;
        this.videoInsightsChatScrollTop = 0;
        return;
      }
      const distanceFromBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight;
      this.videoInsightsChatSticksToBottom = distanceFromBottom < 96;
      this.videoInsightsChatScrollTop = chat.scrollTop;
    }
  }

  private restoreSummaryScroll(): void {
    if (this.activeTab !== 'summary') return;
    const output = this.root.querySelector('.vs-output-content');
    if (!output) return;
    requestAnimationFrame(() => {
      output.scrollTop = resolveSummaryScrollTop(
        this.summaryOutputSticksToBottom,
        this.summaryOutputScrollTop,
        output.scrollHeight,
      );
    });
  }

  private restoreVideoInsightsScroll(): void {
    if (this.activeTab !== 'videoInsights') return;
    const chat = this.root.querySelector('.vs-chat');
    if (!chat) return;
    requestAnimationFrame(() => {
      chat.scrollTop = this.videoInsightsChatSticksToBottom
        ? chat.scrollHeight
        : this.videoInsightsChatScrollTop;
    });
  }
}

export function clampLauncherPosition(x: number, y: number, launcher: HTMLElement): { x: number; y: number } {
  const rect = launcher.getBoundingClientRect();
  const width = rect.width || 48;
  const height = rect.height || 48;
  const margin = 8;
  return {
    x: Math.round(Math.min(Math.max(margin, x), window.innerWidth - width - margin)),
    y: Math.round(Math.min(Math.max(margin, y), window.innerHeight - height - margin)),
  };
}

export function clampPanelWidth(width: number): number {
  return Math.round(Math.min(900, Math.max(300, width)));
}

export function resolveSummaryScrollTop(sticksToBottom: boolean, previousScrollTop: number, scrollHeight: number): number {
  return sticksToBottom ? scrollHeight : previousScrollTop;
}

export function shouldLeaveSettingsTab(
  dirty: boolean,
  confirmSave: () => boolean,
  save?: () => boolean,
): boolean {
  if (!dirty) return true;
  if (!confirmSave()) return false;
  return save ? save() : true;
}

type PanelIconName = TabId | 'collapse';

export function panelIconPaths(name: PanelIconName): string[] {
  const icons: Record<PanelIconName, string[]> = {
    summary: [
      'M7 3.5h7.2L19 8.3V20.5H7z',
      'M14 3.5V9h5',
      'M10 12.5h6',
      'M10 15.5h5',
      'M10 18.5h3.5',
    ],
    videoInsights: [
      'M5.5 6.5h13a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-6L8 20v-3H5.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z',
      'M8 10h8M8 13h5',
    ],
    oneImage: [
      'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
      'M7 15l3-3 2.5 2.5L15.5 11 19 15',
      'M8.5 9.5h.1',
    ],
    settings: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.52a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.73v-.52a2 2 0 0 1 1-1.73l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    ],
    collapse: [
      'M6 6l12 12',
      'M18 6L6 18',
    ],
  };
  return icons[name];
}

function panelIcon(name: PanelIconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  panelIconPaths(name).forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}
