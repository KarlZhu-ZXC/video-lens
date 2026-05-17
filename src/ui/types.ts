import type { AppController } from '../app/AppController';

export type TabId = 'summary' | 'videoInsights' | 'oneImage' | 'settings';

export interface PanelContext {
  controller: AppController;
}
