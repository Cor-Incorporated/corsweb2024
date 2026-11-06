/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GRIFT_BASE_URL?: string;
  readonly PUBLIC_SITE_ENV?: 'production' | 'preview' | 'development';
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
  readonly PUBLIC_CLARITY_ID?: string;
  readonly PUBLIC_GA4_ID?: string;
  readonly PUBLIC_STRIPE_PAYMENT_LINK?: string;
  readonly PUBLIC_YOUTUBE_API_KEY?: string;
  readonly PUBLIC_TURNSTILE_SITEKEY?: string;
  readonly PUBLIC_GCAL_ID?: string;
  readonly PUBLIC_GCAL_TZ?: string;
  readonly PUBLIC_GCAL_PARAMS?: string;
  readonly PUBLIC_CLOUDIA_LAUNCHER_ENABLED?: string;
  readonly PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED?: string;
  readonly PUBLIC_GRIFT_HANDOFF_ALLOWED_ORIGINS?: string;
}

declare global {
  interface Window {
    Alpine: import('alpinejs').Alpine;
  }
}

export {};
