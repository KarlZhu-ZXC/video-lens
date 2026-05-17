import type { SummaryResult } from '../summary/types';
import { makeJsonCache } from './makeJsonCache';
import { SUMMARY_CACHE_KEY } from './types';

export const summaryCache = makeJsonCache<SummaryResult>(SUMMARY_CACHE_KEY);
