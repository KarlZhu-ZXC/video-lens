import type { AppController } from '../app/AppController';
import { el } from '../utils/dom';
import { PANEL_STYLES } from './styles';
import type { TabId } from './types';
import { renderSummaryView, updateSummaryOutput, renderChatMessage } from './summaryView';
import { renderSettingsView } from './settingsModal';
import { createUiText } from './i18n';
import mascotLogoUrl from '../../assets/mascot/flat/logo.svg';

export const SUMMARY_SCROLL_SELECTOR = '.vs-summary-scroll';

export class Panel {
  private readonly host = document.createElement('div');
  private readonly root: ShadowRoot;
  private readonly styleNode = el('style', {}, [PANEL_STYLES]);
  private readonly handleFullscreenChange = () => this.syncFullscreenVisibility();
  private shellNode?: HTMLElement;
  private toastNode?: HTMLElement;
  private renderedToastId?: number;
  private activeTab: TabId;
  private summaryOutputSticksToBottom = true;
  private summaryOutputScrollTop = 0;
  private summaryScrollRestoreGeneration = 0;
  private settingsDirty = false;
  private saveSettingsBeforeLeave?: () => boolean;
  private transitionActive = false;
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private entranceTarget?: 'launcher' | 'panel';
  private entranceEndsAt = 0;

  constructor(private readonly controller: AppController) {
    this.activeTab = controller.config.ui.defaultTab;
    this.root = this.host.attachShadow({ mode: 'open' });
    document.documentElement.append(this.host);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    this.syncFullscreenVisibility();
  }

  render(): void {
    this.syncFullscreenVisibility();
    if (shouldPreserveDirtySettingsView(
      this.activeTab,
      this.settingsDirty,
      this.controller.config.ui.collapsed,
      Boolean(this.shellNode?.isConnected),
    )) {
      this.renderToast();
      return;
    }
    this.captureScrollIntent();
    if (!this.styleNode.isConnected) this.root.append(this.styleNode);
    this.shellNode?.remove();
    if (this.controller.config.ui.collapsed) {
      const t = createUiText(this.controller.config.ui.language);
      const launcherPosition = this.controller.config.ui.launcherPosition;
      const launcher = el('div', {
        class: `vs-launcher-wrap ${this.controller.config.ui.position} ${launcherPosition ? 'dragged' : ''} ${this.isEntering('launcher') ? 'is-entering' : ''}`,
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
      class: `vs-shell ${this.controller.config.ui.position} ${this.activeTab} ${this.isEntering('panel') ? 'is-entering' : ''}`,
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
      }

  renderStreamChange(): void {
    const isCollapsed = this.controller.config.ui.collapsed;
    const isMainStreaming = Boolean(this.controller.state.streamingSummary);
    const isInsightStreaming = Boolean(this.controller.state.streamingSummaryInsight);

    if (this.activeTab === 'summary' && !isCollapsed) {
      let updated = false;

      if (isMainStreaming) {
        const output = this.root.querySelector<HTMLElement>('.vs-output-content');
        if (output) {
          this.captureScrollIntent();
          updateSummaryOutput(this.controller, output);
          updated = true;
        }
      }

      if (isInsightStreaming) {
        const insightNode = this.root.querySelector<HTMLElement>('.vs-streaming-insight');
        if (insightNode) {
          this.captureScrollIntent();
          const newInsightNode = renderChatMessage(
            this.controller,
            this.controller.state.streamingSummaryInsight,
            true,
          );
          newInsightNode.classList.add('vs-streaming-insight');
          insightNode.replaceWith(newInsightNode);
          updated = true;
        }
      }

      if (updated) {
        this.restoreSummaryScroll();
        return;
      }
    }
    this.render();
  }

  destroy(): void {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.host.remove();
  }

  private syncFullscreenVisibility(): void {
    this.host.hidden = isDocumentFullscreen(document);
  }

  private renderHeader(): HTMLElement {
    const t = createUiText(this.controller.config.ui.language);
    const header = this.headerContent(t);
    return el('header', { class: 'vs-header' }, [
      el('div', { class: 'vs-brand' }, [
        el('div', { class: 'vs-title' }, [header.title]),
        header.caption ? el('div', { class: 'vs-subtitle' }, [header.caption]) : '',
      ]),
      this.iconButton(t('closePanel'), () => this.closePanelAnimated()),
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
    if (this.activeTab === 'settings') {
      return { title: t('settings.title'), caption: t('settings.caption') };
    }
    return { title: t('summary.pageTitle') };
  }

  private renderRail(): HTMLElement {
    const t = createUiText(this.controller.config.ui.language);
    const tabs: Array<[TabId, string, string]> = [
      ['summary', t('tabs.summary'), t('tabs.summaryEyebrow')],
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
    if (this.activeTab === 'summary') return baseWidth + 50;
    return baseWidth;
  }

  private renderActiveTab(): HTMLElement {
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
    return renderSummaryView(this.controller);
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
        this.activeTab = 'summary';
        this.openFromLauncherAnimated(launcher);
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

  private openFromLauncherAnimated(launcher: HTMLElement): void {
    if (!canStartPanelTransition(this.transitionActive)) return;
    this.transitionActive = true;
    launcher.classList.add('is-opening');
    this.scheduleTransition(() => {
      this.beginEntrance('panel');
      this.transitionActive = false;
      void this.controller.openFromLauncher();
    });
  }

  private closePanelAnimated(): void {
    if (!canStartPanelTransition(this.transitionActive)) return;
    const shell = this.shellNode;
    if (!shell?.classList.contains('vs-shell')) return;
    this.transitionActive = true;
    shell.classList.add('is-closing');
    this.scheduleTransition(() => {
      this.beginEntrance('launcher');
      this.transitionActive = false;
      this.controller.toggleCollapsed();
    });
  }

  private scheduleTransition(callback: () => void): void {
    const duration = panelTransitionDuration(this.prefersReducedMotion());
    if (duration === 0) {
      callback();
      return;
    }
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = undefined;
      callback();
    }, duration);
  }

  private beginEntrance(target: 'launcher' | 'panel'): void {
    const duration = panelTransitionDuration(this.prefersReducedMotion());
    this.entranceTarget = duration > 0 ? target : undefined;
    this.entranceEndsAt = Date.now() + duration;
  }

  private isEntering(target: 'launcher' | 'panel'): boolean {
    return this.entranceTarget === target && Date.now() < this.entranceEndsAt;
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private captureScrollIntent(): void {
    if (this.activeTab === 'summary') {
      const output = this.root.querySelector(SUMMARY_SCROLL_SELECTOR);
      if (!output) return;
      const distanceFromBottom = output.scrollHeight - output.scrollTop - output.clientHeight;
      this.summaryOutputSticksToBottom = distanceFromBottom < 96;
      this.summaryOutputScrollTop = output.scrollTop;
    }
    }
  private restoreSummaryScroll(): void {
    if (this.activeTab !== 'summary') return;
    const output = this.root.querySelector(SUMMARY_SCROLL_SELECTOR);
    if (!output) return;
    const generation = ++this.summaryScrollRestoreGeneration;
    const immediateTarget = resolveSummaryScrollTop(
      this.summaryOutputSticksToBottom,
      this.summaryOutputScrollTop,
      output.scrollHeight,
    );
    output.scrollTop = immediateTarget;
    const appliedScrollTop = output.scrollTop;
    requestAnimationFrame(() => {
      if (!shouldApplySummaryScrollCorrection(
        generation,
        this.summaryScrollRestoreGeneration,
        this.root.querySelector(SUMMARY_SCROLL_SELECTOR) === output,
        Math.abs(output.scrollTop - appliedScrollTop) < 1,
      )) return;
      output.scrollTop = resolveSummaryScrollTop(
        this.summaryOutputSticksToBottom,
        this.summaryOutputScrollTop,
        output.scrollHeight,
      );
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

export function isDocumentFullscreen(
  doc: { fullscreenElement?: Element | null; webkitFullscreenElement?: Element | null },
): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function resolveSummaryScrollTop(sticksToBottom: boolean, previousScrollTop: number, scrollHeight: number): number {
  return sticksToBottom ? scrollHeight : previousScrollTop;
}

export function shouldApplySummaryScrollCorrection(
  scheduledGeneration: number,
  currentGeneration: number,
  elementStillMounted: boolean,
  scrollPositionUnchanged: boolean,
): boolean {
  return scheduledGeneration === currentGeneration && elementStillMounted && scrollPositionUnchanged;
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

export function shouldPreserveDirtySettingsView(
  activeTab: TabId,
  dirty: boolean,
  collapsed: boolean,
  hasRenderedShell: boolean,
): boolean {
  return activeTab === 'settings' && dirty && !collapsed && hasRenderedShell;
}

export function panelTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 200;
}

export function canStartPanelTransition(transitionActive: boolean): boolean {
  return !transitionActive;
}

type PanelIconName = 'settings' | 'summary' | 'collapse' | 'close';

export function panelIconPaths(name: PanelIconName): string[] {
  const icons: Record<PanelIconName, string[]> = {
    summary: [
      'M12 3l1.15 3.1L16.5 7.5l-3.35 1.4L12 12l-1.15-3.1L7.5 7.5l3.35-1.4z',
      'M18 12l.75 2.25L21 15l-2.25.75L18 18l-.75-2.25L15 15l2.25-.75z',
      'M6 13l.9 2.1L9 16l-2.1.9L6 19l-.9-2.1L3 16l2.1-.9z',
    ],

    settings: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.52a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.73v-.52a2 2 0 0 1 1-1.73l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    ],
    collapse: [
      'M6 6l12 12',
      'M18 6L6 18',
    ],
    close: [
      'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
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
