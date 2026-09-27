import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadContactConfig() {
  vi.resetModules();
  return import('../contact');
}

describe('Cloudia Grift handoff configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the canonical Grift app origin and five-minute exchange-code TTL', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('PUBLIC_GRIFT_HANDOFF_ALLOWED_ORIGINS', '');
    const { CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS, CLOUDIA_GRIFT_HANDOFF_MAX_TTL_MS } =
      await loadContactConfig();

    expect(CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS).toEqual(['https://app.griftai.org']);
    expect(CLOUDIA_GRIFT_HANDOFF_MAX_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('ignores configured Preview origins in production builds', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    vi.stubEnv(
      'PUBLIC_GRIFT_HANDOFF_ALLOWED_ORIGINS',
      'https://grift-preview.example.run.app'
    );
    const { CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS } = await loadContactConfig();

    expect(CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS).toEqual(['https://app.griftai.org']);
  });

  it('adds only exact HTTPS origins from the configured allowlist in Preview builds', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'preview');
    vi.stubEnv(
      'PUBLIC_GRIFT_HANDOFF_ALLOWED_ORIGINS',
      [
        'https://preview.grift.example',
        'https://preview.grift.example/',
        'https://preview-port.grift.example:443',
        'https://*.grift.example',
        'http://insecure.example',
        'https://user:password@evil.example',
        'https://evil.example/path',
        'https://evil.example/?next=1',
        'not-a-url',
      ].join(',')
    );
    const { CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS } = await loadContactConfig();

    expect(CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS).toEqual([
      'https://app.griftai.org',
      'https://preview.grift.example',
    ]);
  });
});
