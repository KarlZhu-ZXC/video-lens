import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import {
  userscriptFileName,
  userscriptName,
  userscriptNamespace,
  userscriptAuthor,
  userscriptVersion,
} from '../vite.config';

describe('userscript build metadata', () => {
  it('uses the package version for the userscript version', () => {
    expect(userscriptVersion).toBe(packageJson.version);
  });

  it('uses the Video Lens package and userscript identity', () => {
    expect(packageJson.name).toBe('video-lens');
    expect(userscriptName).toBe('片语 · Video Lens');
    expect(userscriptNamespace).toBe('urn:video-lens:userscript');
    expect(userscriptAuthor).toBe('Video Lens Contributors');
    expect(userscriptFileName).toBe('video-lens.user.js');
  });
});
