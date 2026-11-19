#!/usr/bin/env bash
# shellcheck disable=SC2015 # 「A が成り立てば ok、そうでなければ ng」の形。ok は必ず 0 を返すので、A が成り立ったときに ng は走らない（結果の報告だけに使う）
# docs/billing/contract/verify-sample.mjs の検査（ADR-0028 の R1・R2、道 A）。通信しない。
# 実行: bash docs/billing/tests/test-verify-sample.sh
# 確かめること:
#   1. 陽性 1 件を受け入れ、cor_svc を T1 の判定の見本（judge.sh）に渡して、サービスごとの結果を出す
#   2. 陰性 9 種（署名違い・期限切れ・まだ有効でない・違う iss・違う azp・o 無し・違う組織・sts pending・v が 2 でない）を
#      それぞれの理由で拒否する（R1・R2 の確かめを 1 つ外すと、その試験が red になる）
#   3. 鍵をファイルにも標準出力にも残さない（空のディレクトリで動かして、ファイルが 1 つも増えないことを見る）
#   4. 判定の見本が無い・使い方の誤りは exit 64 で止まる（判定を黙って飛ばさない）
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING="$(cd "$HERE/.." && pwd)"
SAMPLE="$BILLING/contract/verify-sample.mjs"
JUDGE="$BILLING/contract/judge.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/billing-verify-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/empty"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
count() { printf '%s\n' "$1" | grep -c -- "$2" || true; }

[ -f "$SAMPLE" ] || { printf 'FAIL 検証の見本が無い: %s\n' "$SAMPLE"; exit 1; }
[ -f "$JUDGE" ] || { printf 'FAIL 判定の見本が無い: %s\n' "$JUDGE"; exit 1; }
command -v node >/dev/null 2>&1 || { printf 'FAIL node が要る（T2 の見本は Node の組み込みの crypto で書いている）\n'; exit 1; }

# run_case <case> [引数...] → RC・OUT（標準出力）・ERR（標準エラー）
run_case() {
  local case_name="$1"
  shift
  set +e
  OUT="$(cd "$WORK/empty" && node "$SAMPLE" --case "$case_name" "$@" 2>"$WORK/err")"
  RC=$?
  set -e
  ERR="$(cat "$WORK/err")"
}

expect_accept() {
  local what="$1" want="$2"
  if [ "$RC" -ne 0 ]; then ng "$what: rc 期待 0 観測 $RC: $ERR"; return; fi
  if ! printf '%s' "$OUT" | grep -qF -- "$want"; then ng "$what: 出力に「${want}」が無い: $OUT"; return; fi
  ok "$what"
}

expect_reject() {
  local what="$1" code="$2"
  if [ "$RC" -ne 3 ]; then ng "$what: rc 期待 3 観測 $RC: $ERR"; return; fi
  if ! printf '%s' "$OUT" | grep -qxF -- "REJECT $code"; then ng "$what: 「REJECT ${code}」が無い: $OUT"; return; fi
  if printf '%s' "$OUT" | grep -q '^JUDGE '; then ng "$what: 拒否したのに判定を出した: $OUT"; return; fi
  ok "${what}（REJECT ${code}）"
}

# 1. 陽性。12/31 に終わる business-dossier は 2027-01-30 なら読む・書き出すだけ、終わりの無い xesm は開ける
run_case positive --date 2027-01-30
expect_accept "陽性のトークンを受け入れる" "TOKEN accepted iss=https://clerk.example.test azp=https://bd.example.test sub=user_test_1 org_id=org_test_configured"
[ "$(count "$OUT" '^JUDGE ')" -eq 2 ] && ok "cor_svc の 2 サービスを判定する" || ng "JUDGE の行が 2 行でない: $OUT"
printf '%s\n' "$OUT" | grep -qxF 'JUDGE business-dossier read_export_only' \
  && ok "終了日の翌日から 30 日の中は read_export_only（T1 の判定の見本に渡した）" \
  || ng "business-dossier の判定が read_export_only でない: $OUT"
printf '%s\n' "$OUT" | grep -qxF 'JUDGE xesm open' && ok "終わりの無い契約は open" || ng "xesm が open でない: $OUT"
run_case positive --date 2026-12-15
printf '%s\n' "$OUT" | grep -qxF 'JUDGE business-dossier open' \
  && ok "契約の期間の中は open（日付で判定が変わる）" || ng "2026-12-15 の business-dossier が open でない: $OUT"
run_case positive --date 2027-01-31
printf '%s\n' "$OUT" | grep -qxF 'JUDGE business-dossier closed' \
  && ok "終了日の翌日から 31 日目は closed（日付で判定が変わる）" || ng "2027-01-31 の business-dossier が closed でない: $OUT"

# 2. 陰性 9 種
run_case bad-signature
expect_reject "署名違い（別の鍵で署名）は拒否" signature
run_case expired
expect_reject "期限切れは拒否" exp
run_case not-yet
expect_reject "まだ有効でない（nbf が未来）は拒否" nbf
run_case wrong-iss
expect_reject "違う iss は拒否" iss
run_case wrong-azp
expect_reject "許可リストに無い azp は拒否" azp
run_case no-org
expect_reject "o の無いトークンは拒否" org-missing
run_case wrong-org
expect_reject "違う組織の o は拒否" org-mismatch
run_case sts-pending
expect_reject "sts が pending のトークンは拒否" sts
run_case bad-version
expect_reject "v が 2 でないトークンは拒否" v
run_case wrong-azp --azp https://evil.example.test
expect_accept "azp の許可リストを設定で変えられる" "TOKEN accepted"
run_case wrong-org --org-id org_other
expect_accept "組織の id を設定で変えられる" "org_id=org_other"

# 3. 鍵をファイルにも標準出力にも残さない
if [ "$(find "$WORK/empty" -type f | wc -l | tr -d ' ')" -eq 0 ]; then
  ok "空のディレクトリにファイルを作らない（鍵を残さない）"
else
  ng "空のディレクトリにファイルを作った: $(find "$WORK/empty" -type f | tr '\n' ' ')"
fi
run_case positive --date 2027-01-30
if printf '%s%s' "$OUT" "$ERR" | grep -qE 'PRIVATE KEY|BEGIN RSA|-----BEGIN'; then
  ng "鍵らしい文字列が出力に出た"
else
  ok "鍵は標準出力にも標準エラーにも出ない"
fi
if printf '%s' "$OUT" | grep -qE '^[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.'; then
  ng "トークンをそのまま出力に出した"
else
  ok "トークンをそのまま出さない（受け入れた claim の要点だけ）"
fi

# 4. 止まるべき誤り
expect_usage() {
  local what="$1" text="$2" want="$3"
  if [ "$RC" -eq 64 ] && printf '%s' "$ERR" | grep -qF -- "$text"; then
    ok "$what"
  else
    ng "$what: rc 期待 64 観測 ${RC}、「${text}」を期待: $ERR"
  fi
}
run_case positive --date 2027-01-30 --judge "$WORK/none.sh"
expect_usage "判定の見本が無ければ exit 64（判定を飛ばさない）" "判定の見本が無い" "64"
set +e
OUT="$(node "$SAMPLE" --case nope 2>"$WORK/err")"; RC=$?
set -e
ERR="$(cat "$WORK/err")"
expect_usage "知らない --case は exit 64" "知らない --case" "64"
set +e
OUT="$(node "$SAMPLE" 2>"$WORK/err")"; RC=$?
set -e
ERR="$(cat "$WORK/err")"
expect_usage "--case が無いと exit 64" "--case が要る" "64"
run_case positive --date 2027-1-30
expect_usage "日付の形の誤りは exit 64" "--date は YYYY-MM-DD" "64"
set +e
OUT="$(node "$SAMPLE" --help 2>&1)"; RC=$?
set -e
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q -- '--case'; then
  ok "--help は使い方を出して exit 0"
else
  ng "--help が exit 0 で使い方を出さない（rc=${RC}）"
fi

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
