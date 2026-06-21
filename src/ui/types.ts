import type { AppController } from '../app/AppController';

export type TabId = 'summary' | 'settings';

export interface PanelContext {
  controller: AppController;
}
