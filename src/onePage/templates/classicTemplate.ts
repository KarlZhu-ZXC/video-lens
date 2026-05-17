import type { GeneratedImage } from '../../ai/image/types';
import { el } from '../../utils/dom';
import { normalizeAssetUrl } from '../../utils/url';
import type { OnePageSummaryData } from '../onePageSchema';

export function renderClassicTemplate(data: OnePageSummaryData, image?: GeneratedImage): HTMLElement {
  const root = el('div', { class: 'vs-card vs-card-classic' });
  const visual = el('div', { class: 'vs-card-visual' });
  if (image?.dataUrl || image?.url) visual.style.backgroundImage = `url("${normalizeAssetUrl(image.dataUrl ?? image.url ?? '')}")`;

  root.append(
    visual,
    el('div', { class: 'vs-card-body' }, [
      el('div', { class: 'vs-card-tags' }, data.tags.map((tag) => el('span', {}, [tag]))),
      el('h1', {}, [data.title]),
      data.subtitle ? el('p', { class: 'vs-card-subtitle' }, [data.subtitle]) : '',
      el('p', { class: 'vs-card-conclusion' }, [data.conclusion]),
      el(
        'div',
        { class: 'vs-card-points' },
        data.keyPoints.map((point, index) =>
          el('section', {}, [
            el('strong', {}, [`${index + 1}. ${point.title}`]),
            el('p', {}, [point.detail]),
          ]),
        ),
      ),
      el('div', { class: 'vs-card-takeaways' }, [
        el('h2', {}, ['对我有什么用']),
        el('ul', {}, data.takeaways.map((item) => el('li', {}, [item]))),
      ]),
      el('footer', {}, [`${data.source.upName ?? 'Bilibili'} · ${data.source.title}`]),
    ]),
  );
  return root;
}
