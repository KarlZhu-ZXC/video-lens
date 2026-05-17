import type { GeneratedImage } from '../ai/image/types';
import type { LocalConfig } from '../store/types';
import type { OnePageSummaryData } from './onePageSchema';
import { renderClassicTemplate } from './templates/classicTemplate';
import { renderDenseTemplate } from './templates/denseTemplate';
import { renderPosterTemplate } from './templates/posterTemplate';
import { normalizeAssetUrl } from '../utils/url';

export function composeOnePage(data: OnePageSummaryData, config: LocalConfig, image?: GeneratedImage): HTMLElement {
  const template = config.onePage.defaultTemplate;
  if (config.onePage.mode === 'ai_image_only' && (image?.dataUrl || image?.url)) {
    const element = document.createElement('div');
    element.className = 'vs-card vs-card-image-only';
    element.style.width = `${config.onePage.width}px`;
    const img = document.createElement('img');
    img.src = normalizeAssetUrl(image.dataUrl ?? image.url ?? '');
    img.alt = data.title;
    element.append(img);
    return element;
  }

  const element =
    template === 'dense'
      ? renderDenseTemplate(data, image)
      : template === 'poster'
        ? renderPosterTemplate(data, image)
        : renderClassicTemplate(data, image);
  element.style.width = `${config.onePage.width}px`;
  return element;
}
