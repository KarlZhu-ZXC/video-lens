import { makeJsonCache } from './makeJsonCache';
import { IMAGE_CACHE_KEY, LEGACY_IMAGE_CACHE_KEY } from './types';

export const imageCache = makeJsonCache<{ dataUrl?: string; url?: string; prompt: string }>(
  IMAGE_CACHE_KEY,
  LEGACY_IMAGE_CACHE_KEY,
);
