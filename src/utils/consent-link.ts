// 同意の文（locales の documentRequest.consent）の中のポリシーの語を、1 か所だけ切り出す。
// 文面は変えず、その語だけをリンクにするために使う。見つからなければ null。
export type ConsentSplit = { before: string; term: string; after: string };

export function splitConsentAtPolicy(consent: string, policyTerm: string): ConsentSplit | null {
  if (!policyTerm) return null;
  // 語を正規表現としてではなく、そのままの文字列として探す（特殊文字を escape する）。
  const escaped = policyTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(escaped, 'i').exec(consent);
  if (!match) return null;
  const before = consent.slice(0, match.index);
  // term は consent の中の実際の綴り（大文字小文字もそのまま）。
  const term = consent.slice(match.index, match.index + match[0].length);
  const after = consent.slice(match.index + match[0].length);
  return { before, term, after };
}
