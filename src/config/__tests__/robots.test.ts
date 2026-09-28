import { describe, expect, it } from 'vitest';
import { AI_CRAWLER_USER_AGENTS, buildRobotsTxt, DISALLOWED_PATHS } from '../robots';

// RFC 9309 に沿った最小の判定器: UA に最も具体的に一致するグループ（無ければ `*`）を選び、
// パスに最長一致する規則を採用する（同じ長さなら Allow 優先）。規則が無ければ許可。
type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[]; crawlDelay: boolean };

function parseGroups(txt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let collectingAgents = false;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const key = field.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [], crawlDelay: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') current.rules.push({ allow: key === 'allow', path: value });
    if (key === 'crawl-delay') current.crawlDelay = true;
  }
  return groups;
}

function groupFor(txt: string, userAgent: string): Group | undefined {
  const groups = parseGroups(txt);
  const ua = userAgent.toLowerCase();
  return groups.find((g) => g.agents.includes(ua)) ?? groups.find((g) => g.agents.includes('*'));
}

function isAllowed(txt: string, userAgent: string, path: string): boolean {
  const group = groupFor(txt, userAgent);
  if (!group) return true;
  const matches = group.rules.filter((rule) => rule.path !== '' && path.startsWith(rule.path));
  if (matches.length === 0) return true;
  const longest = Math.max(...matches.map((rule) => rule.path.length));
  return matches.some((rule) => rule.path.length === longest && rule.allow);
}

const SITEMAP = 'https://cor-jp.com/sitemap-index.xml';
const production = buildRobotsTxt({ production: true, sitemapUrl: SITEMAP });
const preview = buildRobotsTxt({ production: false, sitemapUrl: SITEMAP });

const CRAWLERS = [...AI_CRAWLER_USER_AGENTS, 'Googlebot', 'Bingbot', 'SomeUnknownBot'];
const OPEN_PATHS = ['/', '/_astro/hoisted.Abc12345.js', '/_astro/index.Abc12345.css', '/blog/a/', '/zh/blog/a/', '/en/about/'];

describe('robots.txt (production): 真理値表 UA × パス', () => {
  for (const agent of CRAWLERS) {
    it.each(OPEN_PATHS)(`${agent} may fetch %s`, (path) => {
      expect(isAllowed(production, agent, path)).toBe(true);
    });
    it.each(DISALLOWED_PATHS.map((path) => `${path}x`))(`${agent} may not fetch %s`, (path) => {
      expect(isAllowed(production, agent, path)).toBe(false);
    });
  }

  it('gives every AI crawler an explicit group (not just the * fallback)', () => {
    for (const agent of AI_CRAWLER_USER_AGENTS) {
      expect(groupFor(production, agent)?.agents).toContain(agent.toLowerCase());
    }
  });

  it('keeps the AI group rules identical to the * group (a specific group does not inherit *)', () => {
    const star = groupFor(production, 'SomeUnknownBot');
    for (const agent of AI_CRAWLER_USER_AGENTS) {
      expect(groupFor(production, agent)?.rules).toEqual(star?.rules);
    }
  });

  it('has no Crawl-delay, does not disallow /_astro/ and advertises the sitemap', () => {
    expect(parseGroups(production).some((group) => group.crawlDelay)).toBe(false);
    expect(production).not.toMatch(/Disallow:\s*\/_astro\//);
    expect(production).toContain(`Sitemap: ${SITEMAP}`);
  });
});

describe('robots.txt (preview / develop: ADR-0010)', () => {
  it('stays a full disallow for every crawler, AI or not', () => {
    expect(preview).toBe('User-agent: *\nDisallow: /');
    for (const agent of CRAWLERS) {
      for (const path of OPEN_PATHS) expect(isAllowed(preview, agent, path)).toBe(false);
    }
  });
});
