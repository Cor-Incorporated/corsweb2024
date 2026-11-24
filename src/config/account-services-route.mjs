import { parsePublishableKey } from '@clerk/shared/keys';

export const accountServicesRoute = {
  name: 'account-services',
  hooks: {
    'astro:config:setup'({ command, injectRoute }) {
      const environment = process.env.PUBLIC_SITE_ENV;
      const preview = command === 'dev' || environment === 'preview' || environment === 'development';
      if (!preview) {
        if (process.env.PUBLIC_ACCOUNT_SERVICES_ENABLED !== 'true') return;
        const key = parsePublishableKey(process.env.PUBLIC_CLERK_PUBLISHABLE_KEY);
        if (key?.instanceType !== 'production' || !key.frontendApi.endsWith('.cor-jp.com') ||
            process.env.CLERK_ISSUER !== 'https://' + key.frontendApi) {
          throw new Error('サービス一覧の一般公開には契約APIの正規発行元と一致するCor.のClerk本番公開キーが必要です。');
        }
      }
      injectRoute({
        pattern: '/account/services',
        entrypoint: './src/components/account/ServicesPage.astro',
        prerender: true,
      });
    },
  },
};
