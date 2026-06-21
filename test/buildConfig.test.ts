import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { userscriptVersion } from '../vite.config';

describe('userscript build metadata', () => {
  it('uses the package version for the userscript version', () => {
    expect(userscriptVersion).toBe(packageJson.version);
  });
});
