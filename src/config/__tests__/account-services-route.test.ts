import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountServicesRoute } from '../account-services-route.mjs';

const keyFor = (host: string, mode = 'live') =>
  'pk_' + mode + '_' + Buffer.from(host + '$').toString('base64url');

function registeredRoutes(command = 'build') {
  const injectRoute = vi.fn();
  accountServicesRoute.hooks['astro:config:setup']({ command, injectRoute });
  return injectRoute.mock.calls.map(([route]) => route.pattern);
}

describe('サービス一覧の公開先', () => {
  beforeEach(() => vi.stubEnv('CLERK_ISSUER', 'https://clerk.cor-jp.com'));
  afterEach(() => vi.unstubAllEnvs());
  it.each(['', 'production', 'unknown'])('環境 %j で明示しなければ一般配布に含めない', environment => {
    vi.stubEnv('PUBLIC_SITE_ENV', environment);
    vi.stubEnv('PUBLIC_ACCOUNT_SERVICES_ENABLED', '');
    vi.stubEnv('PUBLIC_CLERK_PUBLISHABLE_KEY', keyFor('clerk.cor-jp.com'));
    expect(registeredRoutes()).toEqual([]);
  });

  it.each(['preview', 'development'])('検証環境 %s は同じURLを持つ', environment => {
    vi.stubEnv('PUBLIC_SITE_ENV', environment);
    expect(registeredRoutes()).toEqual(['/account/services']);
  });

  it('ローカルの開発サーバーでも同じURLを使う', () => {
    vi.stubEnv('PUBLIC_SITE_ENV', '');
    expect(registeredRoutes('dev')).toEqual(['/account/services']);
  });

  it.each(['', 'invalid', keyFor('clerk.cor-jp.com', 'test'), keyFor('unrelated.example')])(
    '鍵未設定、異常、開発用、他の組織用では一般公開できない', key => {
      vi.stubEnv('PUBLIC_SITE_ENV', 'production');
      vi.stubEnv('PUBLIC_ACCOUNT_SERVICES_ENABLED', 'true');
      vi.stubEnv('PUBLIC_CLERK_PUBLISHABLE_KEY', key);
      expect(() => registeredRoutes()).toThrow('Clerk本番公開キー');
    },
  );

  it.each(['', 'https://other.cor-jp.com'])('契約APIと発行元が一致しない場合は公開しない', issuer => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('PUBLIC_ACCOUNT_SERVICES_ENABLED', 'true');
    vi.stubEnv('CLERK_ISSUER', issuer);
    vi.stubEnv('PUBLIC_CLERK_PUBLISHABLE_KEY', keyFor('clerk.cor-jp.com'));
    expect(() => registeredRoutes()).toThrow('正規発行元');
  });

  it('掲載を指定し、自社用の本番公開キーがある場合に登録する', () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('PUBLIC_ACCOUNT_SERVICES_ENABLED', 'true');
    vi.stubEnv('PUBLIC_CLERK_PUBLISHABLE_KEY', keyFor('clerk.cor-jp.com'));
    expect(registeredRoutes()).toEqual(['/account/services']);
  });
});
