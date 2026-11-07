#!/usr/bin/env bash
# docs/billing/apply-plans.sh の検査。通信しない（PATH の先頭に偽の curl を置く）。
# 実行: bash docs/billing/tests/test-apply-plans.sh
# 確かめること:
#   1. dry-run は curl を 1 回も呼ばず、鍵も読まない
#   2. 鍵の値が標準出力・標準エラー・curl の引数のどこにも出ない（標準入力の設定でだけ渡る）
#   3. 鍵のモードが --mode と違えば、POST を 1 回もせずに止まる（exit 3）
#   4. 本番は端末で live と打たなければ、POST を 1 回もせずに止まる（exit 64）
#   5. 既存と一致すれば POST しない（冪等）。金額が食い違えば期待値と観測値を出して止まる（exit 3）
#   6. plans.json の事故入力（税込で登録、100 倍、小数、税率の内税、回数の欠落、枠に金額なし、税率の識別子の欠落）を exit 2 で落とす
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING="$(cd "$HERE/.." && pwd)"
SCRIPT="$BILLING/apply-plans.sh"
PLANS="$BILLING/plans.json"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/billing-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
cp "$HERE/fake-curl.sh" "$WORK/bin/curl"
chmod +x "$WORK/bin/curl"
DUMMY_KEY="dummy-key-for-leak-check-7f3a9c"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }

# run <scenario> <plans> [args...] → RC と OUT（標準出力と標準エラー）と LOG（偽 curl の記録）
run() {
  local scenario="$1" plans="$2"
  shift 2
  : >"$WORK/log"
  set +e
  OUT="$(FAKE_SCENARIO="$scenario" FAKE_PLANS="$plans" FAKE_LOG="$WORK/log" PATH="$WORK/bin:$PATH" \
    COR_BILLING_API_KEY="${KEY_FOR_RUN:-}" bash "$SCRIPT" --plans "$plans" "$@" </dev/null 2>&1)"
  RC=$?
  set -e
  LOG="$(cat "$WORK/log")"
}

count() { printf '%s\n' "$1" | grep -c -- "$2" || true; }

mutate() {
  local name="$1" filter="$2"
  jq "$filter" "$PLANS" >"$WORK/$name.json"
  printf '%s' "$WORK/$name.json"
}

# 1. dry-run
KEY_FOR_RUN="$DUMMY_KEY" run empty "$PLANS"
[ "$RC" -eq 0 ] && ok "dry-run rc=0" || ng "dry-run rc=$RC"
[ -z "$LOG" ] && ok "dry-run は curl を呼ばない" || ng "dry-run が curl を呼んだ: $LOG"
[ "$(count "$OUT" '^PLAN price ')" -eq 4 ] && ok "dry-run の PLAN price は 4 件" || ng "PLAN price の件数: $(count "$OUT" '^PLAN price ')"
[ "$(count "$OUT" '^SKIP price ')" -eq 2 ] && ok "dry-run の SKIP price は 2 件（premium の枠）" || ng "SKIP price の件数"
printf '%s' "$OUT" | grep -q '10,000 円（税別）/月、参考 税込 11,000 円/月' && ok "basic は税別 10,000 円・税込 11,000 円" || ng "basic の金額表示"
printf '%s' "$OUT" | grep -q '× 12 回（税別の総額 96,000 円' && ok "開発費は 8,000 円 × 12 回 = 96,000 円" || ng "開発費の回数と総額"

# 2. 何も無いテストモードに作る（鍵の漏れも見る）
KEY_FOR_RUN="$DUMMY_KEY" run empty "$PLANS" --apply --mode test
[ "$RC" -eq 0 ] && ok "apply test（空）rc=0" || ng "apply test（空）rc=$RC: $OUT"
[ "$(count "$LOG" '^CALL POST ')" -eq 9 ] && ok "POST は 9 回（税率 1・商品 4・価格 4）" || ng "POST の回数: $(count "$LOG" '^CALL POST ')"
[ "$(printf '%s\n' "$LOG" | grep '^ARGV' | grep '\[-X\] \[POST\]' | grep -vc 'Idempotency-Key: cor-billing-test-' || true)" -eq 0 ] \
  && ok "POST は全部 Idempotency-Key 付き" || ng "Idempotency-Key の無い POST がある"
printf '%s' "$OUT" | grep -qF "$DUMMY_KEY" && ng "鍵が出力に出た" || ok "鍵は出力に出ない"
printf '%s' "$LOG" | grep '^ARGV' | grep -qF "$DUMMY_KEY" && ng "鍵が curl の引数に載った" || ok "鍵は curl の引数に載らない"
[ "$(count "$LOG" '^STDIN_AUTH no')" -eq 0 ] && ok "鍵は全部の呼出しで標準入力から渡る" || ng "標準入力に鍵の無い呼出しがある"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'Stripe-Version: 2026-10-28.endive' && ok "API の版を固定して送る" || ng "Stripe-Version が無い"
[ "$(printf '%s\n' "$LOG" | grep '^FIRST ' | grep -vc '^FIRST -q$' || true)" -eq 0 ] && [ "$(count "$LOG" '^FIRST -q$')" -gt 0 ] \
  && ok "curl は全部 -q が最初の引数（~/.curlrc を読まない）" || ng "-q が最初でない呼出しがある"

# 前回の結果が返ったとき（Idempotent-Replayed）、今の状態が期待と違えば「作った」と出さずに止まる
FAKE_REPLAY=1 FAKE_ACTIVE=false KEY_FOR_RUN="$DUMMY_KEY" run empty "$PLANS" --apply --mode test
[ "$RC" -eq 3 ] && printf '%s' "$OUT" | grep -q '前回の結果が返ったが、今の状態が期待と違う' && ok "replay で税率が無効なら exit 3" || ng "replay の扱い rc=$RC: $OUT"
printf '%s' "$OUT" | grep -q '^CREATED tax_rate' && ng "replay なのに CREATED と出た" || ok "replay では CREATED と出さない"
FAKE_CURL_VERSION=7.79.1 KEY_FOR_RUN="$DUMMY_KEY" run empty "$PLANS" --apply --mode test
[ "$RC" -eq 64 ] && printf '%s' "$OUT" | grep -q '7.84 以上' && ok "古い curl（7.79）は exit 64" || ng "古い curl rc=$RC"

# bash -x と、環境変数の MODE
set +e
OUT="$(PATH="$WORK/bin:$PATH" bash -x "$SCRIPT" --plans "$PLANS" </dev/null 2>&1)"; RC=$?
set -e
[ "$RC" -eq 64 ] && printf '%s' "$OUT" | grep -q 'set -x' && ok "bash -x では止まる" || ng "bash -x rc=$RC"
set +e
OUT="$(MODE=live PATH="$WORK/bin:$PATH" bash "$SCRIPT" --plans "$PLANS" --apply </dev/null 2>&1)"; RC=$?
set -e
[ "$RC" -eq 64 ] && printf '%s' "$OUT" | grep -q -- '--apply には --mode' && ok "環境変数の MODE=live は使わない（--mode が要る）" || ng "環境変数の MODE rc=$RC: $OUT"

# 3. 鍵のモード違い
KEY_FOR_RUN="$DUMMY_KEY" run livemismatch "$PLANS" --apply --mode test
[ "$RC" -eq 3 ] && ok "モード違いは exit 3" || ng "モード違いの rc=$RC"
[ "$(count "$LOG" '^CALL POST ')" -eq 0 ] && ok "モード違いでは POST しない" || ng "モード違いで POST した"
printf '%s' "$OUT" | grep -q '観測 livemode=true' && ok "モード違いの観測値を出す" || ng "観測値が無い: $OUT"

# 4. 本番は端末の確認が要る
KEY_FOR_RUN="$DUMMY_KEY" run live "$PLANS" --apply --mode live
[ "$RC" -eq 64 ] && ok "端末なしの本番は exit 64" || ng "端末なしの本番 rc=$RC"
[ "$(count "$LOG" '^CALL POST ')" -eq 0 ] && ok "確認なしの本番では POST しない" || ng "確認なしの本番で POST した"

# 5. 冪等と食い違い
KEY_FOR_RUN="$DUMMY_KEY" run match "$PLANS" --apply --mode test
[ "$RC" -eq 0 ] && ok "既存と一致なら rc=0" || ng "一致 rc=$RC: $OUT"
[ "$(count "$LOG" '^CALL POST ')" -eq 0 ] && ok "既存と一致なら POST しない" || ng "一致なのに POST した"
KEY_FOR_RUN="$DUMMY_KEY" run pricemismatch "$PLANS" --apply --mode test
[ "$RC" -eq 3 ] && ok "金額の食い違いは exit 3" || ng "食い違い rc=$RC"
printf '%s' "$OUT" | grep -q 'unit_amount 期待 10000 観測 11000' && ok "食い違いの期待値と観測値を出す" || ng "期待値と観測値が無い: $OUT"
[ "$(count "$LOG" '^CALL POST ')" -eq 0 ] && ok "食い違いでは POST しない" || ng "食い違いで POST した"

# 鍵が無いと止まる（端末も無い）
KEY_FOR_RUN="" run empty "$PLANS" --apply --mode test
[ "$RC" -eq 64 ] && ok "鍵なし・端末なしは exit 64" || ng "鍵なし rc=$RC"
[ -z "$LOG" ] && ok "鍵なしでは curl を呼ばない" || ng "鍵なしで curl を呼んだ"

# 6. 事故入力
check_bad() {
  local name="$1" filter="$2" expect="$3" p
  p="$(mutate "$name" "$filter")"
  KEY_FOR_RUN="" run empty "$p"
  if [ "$RC" -eq 2 ] && printf '%s' "$OUT" | grep -q -- "$expect"; then ok "事故入力 $name は exit 2"; else ng "事故入力 $name: rc=$RC $OUT"; fi
}
check_bad inclusive '(.prices[0].tax_behavior) = "inclusive"' 'tax_behavior は exclusive'
check_bad x100 '(.prices[0].unit_amount_jpy_excl_tax) = 1000000' '範囲外'
check_bad decimal '(.prices[0].unit_amount_jpy_excl_tax) = 10000.5' '整数の円'
check_bad taxincl '(.tax_rate.inclusive) = true' 'tax_rate.inclusive は false'
check_bad noinstall 'del(.prices[4].installments)' 'installments は 1〜36'
check_bad premiumnull '(.prices[1].enabled) = true' '整数の円'
check_bad dupkey '(.prices[2].lookup_key) = "business_dossier_basic_monthly"' 'lookup_key が重複'
check_bad currency '(.currency) = "usd"' 'currency が jpy でない'
# 税率の識別子は tax_rate.id。旧い項目名（gitleaks が generic-api-key と誤検出した名前）に戻すと落ちる
check_bad taxidmissing 'del(.tax_rate.id)' 'tax_rate.id の形が違う'
check_bad taxidoldname '.tax_rate |= with_entries(if .key == "id" then .key = "key" else . end)' 'tax_rate.id の形が違う'
# 解約の方針（特商法ページの「1 か月後の同じ日」「日割り」「返金いたしません」と同じ）。subscribe.sh が実装していない方針は落とす
check_bad cancelrefund '(.cancellation.refund) = "prorated"' 'cancellation.refund は none'
check_bad cancelfinal '(.cancellation.final_period) = "full_month"' 'cancellation.final_period は prorated'
check_bad cancelnotice '(.cancellation.notice_months) = 0' 'cancellation.notice_months は 1〜12'
check_bad cancelmissing 'del(.cancellation)' 'cancellation.plan は basic'
# 請求の形と最低利用期間（特商法ページの「毎月末日で締め、翌月末日」「ご契約から 1 年」「残額」「一括」と同じ）
check_bad billingmix '(.billing.payment_due) = "at_period_start"' 'billing は month_end'
check_bad billingmissing 'del(.billing)' 'billing は month_end'
check_bad termmonths '(.minimum_term.months) = 1.5' 'minimum_term.months は 0〜36'
check_bad termfee '(.minimum_term.early_termination_fee) = "none"' 'early_termination_fee は remaining_term_total'
check_bad termdev '(.minimum_term.dev_fee_on_early_termination) = "continue"' 'dev_fee_on_early_termination は remaining_lump_sum'

# 使い方の誤り
KEY_FOR_RUN="" run empty "$PLANS" --apply
[ "$RC" -eq 64 ] && ok "--apply だけは exit 64" || ng "--apply だけ rc=$RC"
KEY_FOR_RUN="" run empty "$PLANS" --mode live
[ "$RC" -eq 64 ] && ok "--mode だけは exit 64" || ng "--mode だけ rc=$RC"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
