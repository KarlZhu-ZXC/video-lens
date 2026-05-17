import type { OnePageSummaryData } from '../onePage/onePageSchema';
import { makeJsonCache } from './makeJsonCache';
import { ONE_PAGE_CACHE_KEY } from './types';

export const onePageCache = makeJsonCache<OnePageSummaryData>(ONE_PAGE_CACHE_KEY);
