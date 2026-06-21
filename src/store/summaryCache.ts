import type { SummaryResult } from '../summary/types';
import { makeJsonCache } from './makeJsonCache';
import { LEGACY_SUMMARY_CACHE_KEY, SUMMARY_CACHE_KEY } from './types';

export const summaryCache = makeJsonCache<SummaryResult>(SUMMARY_CACHE_KEY, LEGACY_SUMMARY_CACHE_KEY);
