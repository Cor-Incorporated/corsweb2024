#!/usr/bin/env bash
# docs/billing/subscribe.sh の検査（作り方 B: 毎月末の請求書）。通信しない（PATH の先頭に偽の curl を置く）。
# 実行: bash docs/billing/tests/test-subscribe.sh
# 確かめること:
#   0. lib.sh の IMPLEMENTED_BILLING_CLOSING と plans.json の billing.closing が一致する（片方だけ変えると落ちる）
#   1. dry-run は curl を呼ばない。入力の誤り（未来の月、期限前の charge、13 回目の開発費、実在しない日付）を exit 64 で落とす
#   2. 鍵の値が出力にも curl の引数にも出ない。モード違いでは POST しない（exit 3）。本番は live と打たなければ書かない
#   3. 日付と金額の計算を、実装と別に書いた値で確かめる（README 1C 章の例: 11/15 開始・4/5 終了 → 日割り 1,666、
#      残りの期間分 68,334、開発費の残り 48,000。初月は 1 か月分。12 か月目の末日より後の終了日では残り 0。開発費 0 回）
#   4. 請求書: draft → 明細 → 小計の照合 → finalize → send の順。同じ月の 2 枚目は作らない。小計が違えば確定しない
#   5. charge: 振込の顧客・期限前・カードなしは払わない
#   6. 前の形（same_day_advance）の plans.json の写しでは、新しいサブコマンドはテストモードでも本番でも止まる
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING="$(cd "$HERE/.." && pwd)"
PLANS="$BILLING/plans.json"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/billing-sub-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
OLD_PLANS="$WORK/plans-same-day.json"
jq '.billing = {closing: "same_day_advance", payment_due: "at_period_start", first_month: "full_month"}' "$PLANS" >"$OLD_PLANS"
cp "$HERE/fake-curl.sh" "$WORK/bin/curl"
chmod +x "$WORK/bin/curl"
DUMMY_KEY="dummy-key-for-leak-check-7f3a9c"
CLERK_KEY_DUMMY="sk_test_dummy_for_leak_check_9c2f"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
count() { printf '%s\n' "$1" | grep -c -- "$2" || true; }

# run <args...>（環境変数 FAKE_* と KEY はそのまま渡す）→ RC・OUT・LOG
run() {
  : >"$WORK/log"
  rm -f "$WORK/log.items"
  set +e
  OUT="$(FAKE_SCENARIO="${SCN:-match}" FAKE_PLANS="$PLANS" FAKE_LOG="$WORK/log" PATH="$WORK/bin:$PATH" \
    COR_BILLING_API_KEY="${KEY-$DUMMY_KEY}" COR_CLERK_SECRET_KEY="${CKEY-$CLERK_KEY_DUMMY}" \
    bash "$BILLING/subscribe.sh" "$@" --plans "${RUN_PLANS:-$PLANS}" </dev/null 2>&1)"
  RC=$?
  set -e
  LOG="$(cat "$WORK/log")"
}
posts() { count "$LOG" '^CALL POST '; }
post_seq() { printf '%s\n' "$LOG" | grep '^CALL POST ' | sed 's/^CALL POST //' | paste -sd' ' - || true; }
# curl に渡った引数に、ちょうどこの 1 つがあるか
argv_has() { printf '%s\n' "$LOG" | grep '^ARGV' | grep -qF -- "[$1]"; }

expect() {
  # expect <説明> <期待 rc> <期待 POST 数 or -> <出力に含む文字列 or ->
  local what="$1" rc="$2" npost="$3" text="$4"
  if [ "$RC" -ne "$rc" ]; then ng "$what: rc 期待 $rc 観測 $RC: $OUT"; return; fi
  if [ "$npost" != "-" ] && [ "$(posts)" -ne "$npost" ]; then ng "$what: POST 期待 $npost 観測 $(posts): $(post_seq)"; return; fi
  if [ "$text" != "-" ] && ! printf '%s' "$OUT" | grep -qF -- "$text"; then ng "$what: 出力に「$text」が無い: $OUT"; return; fi
  ok "$what"
}
check_arg() { if argv_has "$2"; then ok "$1"; else ng "$1: curl の引数に [$2] が無い"; fi; }
check_no_arg() { if printf '%s\n' "$LOG" | grep '^ARGV' | grep -qF -- "$2"; then ng "$1: curl の引数に $2 がある"; else ok "$1"; fi; }

# lib.sh の関数を 1 つ呼ぶ
lib_fn() { bash -c '. "$1/lib.sh"; PLANS="$2"; shift 2; "$@"' _ "$BILLING" "$PLANS" "$@"; }
eq() { if [ "$2" = "$3" ]; then ok "$1"; else ng "$1: 期待 $3 観測 $2"; fi; }

# 月の計算（実装の lib.sh と別に書く）
ym_shift() {
  local i=$((10#${1:0:4} * 12 + 10#${1:5:2} - 1 + $2))
  printf '%04d-%02d' $((i / 12)) $((i % 12 + 1))
}
jst_epoch() { TZ=Asia/Tokyo date -j -f '%Y-%m-%d %H:%M:%S' "$1" '+%s' 2>/dev/null || TZ=Asia/Tokyo date -d "$1" '+%s'; }
TODAY="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
TOMORROW="$(TZ=Asia/Tokyo date -r "$(($(date '+%s') + 86400))" '+%Y-%m-%d' 2>/dev/null || TZ=Asia/Tokyo date -d tomorrow '+%Y-%m-%d')"
THIS="${TODAY:0:7}"
LAST="$(ym_shift "$THIS" -1)"
NEXT="$(ym_shift "$THIS" 1)"
TWO_AGO="$(ym_shift "$THIS" -2)"
# 先月分の支払期限 = 今月の末日 23:59:59 JST = 来月 1 日 0:00 JST の 1 秒前
DUE_LAST=$(($(jst_epoch "$NEXT-01 00:00:00") - 1))
DUE_TWO_AGO=$(($(jst_epoch "$THIS-01 00:00:00") - 1))
meta() { jq -nc --arg s "${2:-}" --arg c "${3:-}" --arg e "${4:-}" --arg p "$1" '{customer_code: "sample-co"}
  + (if $p == "" then {} else {payment: $p} end) + (if $s == "" then {} else {contract_xesm_start: $s} end)
  + (if $c == "" then {} else {contract_xesm_devfee_count: $c} end) + (if $e == "" then {} else {contract_xesm_end: $e} end)'; }

# 0. 宣言と実装の一致（lib.sh の IMPLEMENTED_BILLING_CLOSING ↔ plans.json の billing.closing）
impl="$(sed -n 's/^readonly IMPLEMENTED_BILLING_CLOSING="\(.*\)"$/\1/p' "$BILLING/lib.sh")"
decl="$(jq -r '.billing.closing' "$PLANS")"
if [ -n "$impl" ] && [ "$impl" = "$decl" ]; then
  ok "lib.sh の IMPLEMENTED_BILLING_CLOSING と plans.json の billing.closing が一致（$impl）"
else
  ng "lib.sh の IMPLEMENTED_BILLING_CLOSING=${impl:-（読めない）}、plans.json の billing.closing=$decl（一致しない）"
fi

# 1. dry-run と入力
run customer --code sample-co --name テスト株式会社 --email billing@example.test --payment card
expect "customer の dry-run" 0 0 "DONE dry-run"
[ -z "$LOG" ] && ok "dry-run は curl を呼ばない" || ng "dry-run が curl を呼んだ"
run customer --code sample-co --name x --email billing@example.test
expect "customer は --payment が要る" 64 0 "customer には --payment が要る"
run customer --code sample-co --name x --email billing@example.test --payment cash
expect "--payment は card か transfer" 64 0 "--payment は card か transfer"
run customer --code Sample_Co --name x --email billing@example.test --payment card
expect "顧客コードの大文字・下線は exit 64" 64 0 "--code は英小文字"
run customer --code sample-co --name x --email "billing at example" --payment card
expect "メールの形の誤りは exit 64" 64 0 "--email の形が違う"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12
expect "contract の dry-run は書く値を出す" 0 0 "contract_xesm_start=2026-11-15、contract_xesm_devfee_count=12"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 13
expect "開発費 13 回は exit 64（plans.json は 12）" 64 0 "--devfee-count は 0〜12"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 0
expect "開発費 0 回の契約は通る" 0 0 "devfee_count=0"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 012
expect "0 で始まる回数は exit 64（算術で 8 進数に読まれる）" 64 0 "--devfee-count は 0〜12"
FAKE_CUST_META="$(meta card 2026-11-15 012)" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "metadata の回数が 0 で始まれば請求書を作らない" 3 0 "devfee_count が 0〜12 でない（観測: 012）"
run contract --customer cus_x --service xesm --start 2026-02-30 --devfee-count 3
expect "実在しない開始日は exit 64" 64 0 "実在する日付ではない"
run contract --customer sub_x --service xesm --start 2026-11-15 --devfee-count 3
expect "customer に sub_ の id は exit 64" 64 0 "--customer は cus_"
run contract --customer cus_x --service grift --start 2026-11-15 --devfee-count 3
expect "知らないサービスは exit 64" 64 0 "--service は"
run invoice --customer cus_x --month "$NEXT"
expect "未来の月の invoice は exit 64（F2）" 64 0 "未来の月は使わない"
run invoice --customer cus_x --month "$TWO_AGO"
expect "先月より前の invoice は exit 64" 64 0 "今月か先月"
run invoice --customer cus_x --month 2026-13
expect "月の形の誤りは exit 64" 64 0 "--month は YYYY-MM"
run invoice --customer cus_x --month "$LAST"
expect "invoice の dry-run は支払期限（翌月末日）を出す" 0 0 "due_date $DUE_LAST"
run charge --customer cus_x --month "$THIS"
expect "期限前の charge は exit 64（F2）" 64 0 "期限の日より前は払わない"
run cancel --customer cus_x --service xesm --accepted "$TOMORROW"
expect "未来の受理日は exit 64" 64 0 "未来の日付は使わない"
run cancel --customer cus_x --service xesm --accepted 2026-02-30
expect "実在しない受理日は exit 64" 64 0 "実在する日付ではない"
run cancel --customer cus_x --service xesm --accepted 2026-03-05
expect "cancel の dry-run は終了日（1 か月後の同じ日）を出す" 0 0 "= 2026-04-05 を metadata[contract_xesm_end] に書く"
run status --customer cus_x --accepted "$TODAY" --mode test
expect "--accepted は cancel でだけ使う" 64 0 "cancel でだけ使う"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 3 --month "$LAST"
expect "--month は invoice と charge でだけ使う" 64 0 "invoice charge mark-paid でだけ使う"
run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 3 --clerk-org org_abc123
expect "--clerk-org は customer でだけ使う" 64 0 "customer でだけ使う"
run status --customer cus_x
expect "status に --mode が無いと exit 64" 64 0 "--mode test か --mode live"
run invoice --customer cus_x --month "$LAST" --apply
expect "--apply に --mode が無いと exit 64" 64 0 "--mode"
run simulate --start 2026-11-15 --devfee-count 12 --months 3 --mode test
expect "simulate に --mode は使わない" 64 0 "simulate は通信しない"
run simulate --start 2026-11-15 --devfee-count 12 --months 0
expect "simulate --months 0 は exit 64" 64 0 "--months は 1〜36"
run simulate --start 2026-11-15 --devfee-count 12 --end 2026-11-01 --months 3
expect "simulate の終了日が開始日より前は exit 64" 64 0 "--end が --start より前"

# 2. 鍵とモード、customer
SCN=livemismatch run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode test
expect "モード違いは POST せずに exit 3" 3 0 "観測 livemode=true"
FAKE_SEARCH=none run customer --code sample-co --name x --email billing@example.test --payment transfer --apply --mode test
expect "customer を作る" 0 1 "CREATED customer cus_new（customer_code=sample-co、payment=transfer"
check_arg "Customer の metadata に payment を送る" "metadata[payment]=transfer"
printf '%s' "$OUT" | grep -qF "$DUMMY_KEY" && ng "鍵が出力に出た" || ok "鍵は出力に出ない"
printf '%s' "$LOG" | grep '^ARGV' | grep -qF "$DUMMY_KEY" && ng "鍵が curl の引数に載った" || ok "鍵は curl の引数に載らない"
FAKE_SEARCH=one run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode test
expect "既にある customer は作らない" 0 0 "OK customer cus_existing"
FAKE_SEARCH=one_transfer run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode test
expect "既存の顧客の payment が違えば書き換えずに exit 3" 3 0 "期待 card、観測 transfer"
FAKE_SEARCH=one_clerk run customer --code sample-co --name x --email billing@example.test --payment card --clerk-org org_abc123 --apply --mode test
expect "既存の顧客の clerk_org_id が違えば書き換えずに exit 3" 3 0 "期待 org_abc123、観測 org_other"
FAKE_SEARCH=two run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode test
expect "customer_code が 2 件なら exit 3" 3 0 "2 件ある"
FAKE_SEARCH=none FAKE_REPLAY=1 run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode test
expect "replay で顧客が残っていれば続ける" 0 1 "Idempotent-Replayed"
SCN=live FAKE_SEARCH=none run customer --code sample-co --name x --email billing@example.test --payment card --apply --mode live
expect "本番は端末で live と打たなければ書かない" 64 0 "本番は端末から実行する"

# 3. contract
FAKE_CUST_META="$(meta card)" run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "contract は契約を metadata に書く" 0 1 "CONTRACT cus_x xesm: start=2026-11-15 devfee_count=12"
check_arg "contract は開始日を送る" "metadata[contract_xesm_start]=2026-11-15"
check_arg "contract は開発費の回数を送る" "metadata[contract_xesm_devfee_count]=12"
FAKE_CUST_META="$(meta card 2026-11-15 12)" run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "同じ契約なら書かない" 0 0 "OK contract cus_x xesm: 既に"
FAKE_CUST_META="$(meta card 2026-10-01 12)" run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "違う開始日があれば書き換えずに exit 3" 3 0 "期待 2026-11-15、観測 2026-10-01"
FAKE_CUST_META="$(meta card 2026-11-15 8)" run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "違う回数があれば書き換えずに exit 3" 3 0 "期待 12、観測 8"
FAKE_CUST_META="$(meta card)" FAKE_META_ECHO=wrong run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "応答の metadata が違えば exit 3" 3 1 "応答の metadata が期待と違う"
FAKE_CUST_META='{}' run contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
expect "customer_code の無い顧客には書かない" 3 0 "customer_code が無い"
FAKE_CUST_META="$(meta card)" run contract --customer cus_x --service business-dossier --start 2026-11-15 --devfee-count 6 --apply --mode test
check_arg "business-dossier の回数の名前（38 文字）も送る" "metadata[contract_business-dossier_devfee_count]=6"

# 4. card-setup
FAKE_CUST_META="$(meta card)" run card-setup --customer cus_x --apply --mode test
expect "card-setup はページを作り URL を出す" 0 2 "SETUP_URL https://checkout.example.test/c/new"
check_arg "card-setup は mode=setup" "mode=setup"
check_arg "card-setup は currency=jpy" "currency=jpy"
check_arg "card-setup は success_url を付ける" "success_url=https://cor-jp.com/"
check_arg "card-setup は session の id を Customer に書く" "metadata[card_setup_session]=cs_new"
check_no_arg "card-setup は payment_method_types を送らない（この版に無い）" "payment_method_types"
FAKE_CUST_META="$(meta card)" FAKE_CUST_PM=pm_default run card-setup --customer cus_x --apply --mode test
expect "既定のカードがあれば作らない" 0 0 "カードは保存済み（pm_default"
FAKE_CUST_META="$(jq -c '. + {card_setup_session: "cs_old"}' <<<"$(meta card)")" FAKE_CS_STATUS=complete run card-setup --customer cus_x --apply --mode test
expect "保存の済んだ session があれば作らない" 0 0 "カードは保存済み（pm_saved"
FAKE_CUST_META="$(jq -c '. + {card_setup_session: "cs_old"}' <<<"$(meta card)")" FAKE_CS_STATUS=open run card-setup --customer cus_x --apply --mode test
expect "開いているページがあれば作らずに URL を出す" 0 0 "SETUP_URL https://checkout.example.test/c/old"
FAKE_CUST_META="$(jq -c '. + {card_setup_session: "cs_old"}' <<<"$(meta card)")" FAKE_CS_STATUS=expired run card-setup --customer cus_x --apply --mode test
expect "期限の切れたページなら作り直す" 0 2 "SETUP_URL https://checkout.example.test/c/new"

# 5. 解約の終了日: 受理日の 1 か月後の同じ日（無い月は月末）。実装と別に書いた値で確かめる
for c in "2026-11-05 2026-12-05" "2026-12-15 2027-01-15" "2026-03-31 2026-04-30" "2027-01-31 2027-02-28" "2028-01-31 2028-02-29" "2026-08-31 2026-09-30" "2026-03-05 2026-04-05"; do
  set -- $c
  eq "受理日 $1 の終了日は $2" "$(lib_fn cancel_end_date "$1")" "$2"
done
for c in "2026-02-30 no" "2027-02-29 no" "2028-02-29 yes" "2100-02-29 no" "2000-02-29 yes" "2026-13-01 no"; do
  set -- $c
  if lib_fn valid_date "$1"; then got=yes; else got=no; fi
  eq "日付 $1 の実在 = $2" "$got" "$2"
done
WANT_END="$(lib_fn add_months_clamped "$TODAY" 1)"
FAKE_CUST_META="$(meta card "$LAST-15" 12)" run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "cancel は終了日を metadata に書く" 0 1 "CANCEL cus_x xesm: 受理日 $TODAY → 終了日 $WANT_END"
check_arg "cancel は contract_xesm_end を送る" "metadata[contract_xesm_end]=$WANT_END"
printf '%s' "$OUT" | grep -q "^LINE ${WANT_END:0:7} xesm usage_prorated " && ok "cancel は終了の月の日割りの明細を出す" || ng "cancel の出力に終了の月の日割りが無い: $OUT"
FAKE_CUST_META="$(meta card 2099-01-01 12)" run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "終了日が契約の開始日より前なら exit 64" 64 0 "契約の開始日 2099-01-01 より前"
FAKE_CUST_META="$(meta card "$LAST-15" 12 2099-12-31)" run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "別の終了日があれば書き換えずに exit 3" 3 0 "別の終了日がある（期待 $WANT_END、観測 2099-12-31）"
FAKE_CUST_META="$(meta card "$LAST-15" 12 "$WANT_END")" run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "同じ終了日なら書かない" 0 0 "OK cancel cus_x xesm: 既に終了日"
FAKE_CUST_META="$(meta card "$LAST-15" 12)" FAKE_INV_STATE=open run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "終了の月の請求書が既にあれば書かない" 3 0 "の請求書 in_open が既にある"
FAKE_CUST_META="$(meta card)" run cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode test
expect "契約の無いサービスは解約しない" 3 0 "xesm の契約が無い"

# 6. 明細の計算（simulate と lib.sh の billing_lines）。値は README 1C 章の例と、手で計算した値
run simulate --start 2026-11-15 --devfee-count 12 --end 2027-04-05 --months 7 --service xesm
expect "simulate は通信しない" 0 0 "SUM 216000"
[ -z "$LOG" ] && ok "simulate は curl を呼ばない" || ng "simulate が curl を呼んだ"
has_line() { if printf '%s\n' "$OUT" | grep -q "^$2"; then ok "$1"; else ng "$1: 「$2」の行が無い: $OUT"; fi; }
no_line() { if printf '%s\n' "$OUT" | grep -q "^$2"; then ng "$1: 「$2」の行がある: $OUT"; else ok "$1"; fi; }
has_line "開始の月（11/15 開始）は 1 か月分 10,000 円" "LINE 2026-11 usage_first 10000 "
has_line "2 か月目からは 1 か月分" "LINE 2027-03 usage 10000 "
has_line "4/5 終了の日割りは 10,000 × 5 ÷ 30 = 1,666 円（切り捨て）" "LINE 2027-04 usage_prorated 1666 "
has_line "終了の月の開発費は 6 回目" "LINE 2027-04 devfee 8000 .* 6/12 回目"
has_line "残りの期間分の利用料は 120,000 − 51,666 = 68,334 円" "LINE 2027-04 remaining_usage 68334 2027-04-06〜2027-10-31 "
has_line "開発費の残りは 6 回 = 48,000 円" "LINE 2027-04 remaining_devfee 48000 2027-05-01〜2027-10-31 "
has_line "終了の月の合計は 126,000 円" "TOTAL 2027-04 126000"
has_line "終了の月より後は請求しない" "TOTAL 2027-05 0"
run simulate --start 2026-11-15 --devfee-count 12 --months 14 --service xesm
has_line "12 回目の開発費は請求する" "LINE 2027-10 devfee 8000 .* 12/12 回目"
no_line "13 回目の開発費は請求しない（F2）" "LINE 2027-11 devfee"
has_line "13 か月目は利用料だけ" "TOTAL 2027-11 10000"
run simulate --start 2026-11-15 --devfee-count 12 --end 2027-11-05 --months 13 --service xesm
has_line "12 か月目の末日より後の終了日（11/5）は日割りだけ" "TOTAL 2027-11 1666"
no_line "12 か月目の末日より後の終了日では、残りの期間分は 0（明細なし）" "LINE 2027-11 remaining_usage"
run simulate --start 2026-11-15 --devfee-count 12 --end 2027-10-31 --months 12 --service xesm
has_line "12 か月目の末日に終わるなら日割りは 1 か月分" "LINE 2027-10 usage_prorated 10000 "
no_line "12 か月目の末日に終わるなら残りの期間分は 0" "LINE 2027-10 remaining_usage"
run simulate --start 2026-11-15 --devfee-count 12 --end 2027-10-05 --months 12 --service xesm
has_line "12 か月目の途中の終了は 120,000 − (110,000 + 1,612) = 8,388 円" "LINE 2027-10 remaining_usage 8388 "
run simulate --start 2026-11-15 --devfee-count 0 --end 2027-04-05 --months 6 --service xesm
no_line "開発費 0 回の契約では開発費を請求しない" "LINE [0-9-]* devfee"
no_line "開発費 0 回の契約では開発費の残りも無い" "LINE [0-9-]* remaining_devfee"
has_line "開発費 0 回の終了の月は 1,666 + 68,334 = 70,000 円" "TOTAL 2027-04 70000"
run simulate --start 2026-11-15 --devfee-count 12 --end 2026-11-30 --months 2 --service xesm
has_line "開始の月に終わっても初月は 1 か月分" "LINE 2026-11 usage_first 10000 "
has_line "開始の月に終われば残りの期間分は 110,000 円" "LINE 2026-11 remaining_usage 110000 "
has_line "開始の月に終わっても合計は 1 年分（120,000 + 96,000）" "TOTAL 2026-11 216000"
run simulate --start 2027-11-15 --devfee-count 0 --end 2028-02-15 --months 4 --service xesm
has_line "うるう年の 2 月の日割りは 10,000 × 15 ÷ 29 = 5,172 円" "LINE 2028-02 usage_prorated 5172 "
eq "開始の月より前は明細なし" "$(lib_fn billing_lines xesm 2026-11-15 12 "" 2026-10)" ""
eq "終了の月より後は明細なし" "$(lib_fn billing_lines xesm 2026-11-15 12 2027-04-05 2027-05)" ""
for c in "2026-11 2026-12-31" "2027-01 2027-02-28" "2027-12 2028-01-31" "2028-01 2028-02-29"; do
  set -- $c
  eq "$1 分の支払期限は翌月末日 $2" "$(lib_fn due_date_of_month "$1")" "$2"
done
for c in "2026-12-31 1798729199" "2027-02-28 1803826799" "2028-01-31 1832943599" "2028-02-29 1835449199"; do
  set -- $c
  eq "$1 23:59:59 JST は $2" "$(lib_fn jst_day_end_epoch "$1")" "$2"
done

# 7. invoice（先月分。契約は先月 15 日に開始、開発費 12 回）
INV_META="$(meta card "$LAST-15" 12)"
FAKE_CUST_META="$INV_META" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "invoice は請求書を作り、確定して送る" 0 6 "CHECK ok: 小計 18000 円（税別）・明細 2 行は計算と一致"
eq "POST の順は draft → 明細 → finalize → send → 送った記録" "$(post_seq)" "/v1/invoices /v1/invoiceitems /v1/invoiceitems /v1/invoices/in_new/finalize /v1/invoices/in_new/send /v1/customers/cus_x"
check_arg "送ったことを Customer の metadata に書く" "metadata[invoice_sent]=$LAST:in_new"
check_arg "請求書は send_invoice" "collection_method=send_invoice"
check_arg "支払期限は翌月末日 23:59:59 JST（$DUE_LAST）" "due_date=$DUE_LAST"
check_arg "auto_advance=false" "auto_advance=false"
check_arg "保留の明細を取り込まない" "pending_invoice_items_behavior=exclude"
check_arg "請求書に月を書く" "metadata[billing_month]=$LAST"
check_arg "利用料の明細は初月も 1 か月分" "amount=10000"
check_arg "開発費の明細は 1 回分" "amount=8000"
check_arg "明細に消費税を付ける" "tax_rates[0]=txr_fake"
check_arg "明細は作った下書きに付ける" "invoice=in_new"
check_arg "初月の期間は開始日の 0:00 JST から" "period[start]=$(jst_epoch "$LAST-15 00:00:00")"
[ "$(count "$LOG" '^STDIN_AUTH no')" -eq 0 ] && ok "鍵は全部の呼出しで標準入力から渡る" || ng "標準入力に鍵の無い呼出しがある"
printf '%s' "$LOG" | grep '^ARGV' | grep -qF "$DUMMY_KEY" && ng "invoice で鍵が curl の引数に載った" || ok "invoice でも鍵は curl の引数に載らない"
INV_META_SENT="$(jq -c --arg s "$LAST:in_open" '. + {invoice_sent: $s}' <<<"$INV_META")"
FAKE_CUST_META="$INV_META_SENT" FAKE_INV_STATE=open run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "同じ月の請求書があれば作らない（F2: 2 枚目）" 0 0 "OK invoice cus_x: $LAST 分の請求書 in_open は既にある"
# 確定のあと送付で止まった請求書（送った記録が無い）は、やり直しで送り直す（独立レビューの MEDIUM）
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=open run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "送った記録の無い確定済みの請求書は送り直す" 0 2 "SENT in_open $LAST: 送り直した"
eq "送り直しは send → 送った記録" "$(post_seq)" "/v1/invoices/in_open/send /v1/customers/cus_x"
FAKE_CUST_META="$(jq -c --arg s "2026-01:in_old" '. + {invoice_sent: $s}' <<<"$INV_META")" FAKE_INV_STATE=open run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "別の月の記録しか無ければ送り直す" 0 2 "SENT in_open"
check_arg "記録は新しい順に足す" "metadata[invoice_sent]=$LAST:in_open,2026-01:in_old"
FAKE_CUST_META="$INV_META_SENT" FAKE_INV_STATE=open FAKE_INV_WHERE=list FAKE_INV_MONTH="$LAST" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "検索に出る前でも一覧で見つけて作らない" 0 0 "in_open は既にある"
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=two run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "同じ月の請求書が 2 件なら exit 3" 3 0 "請求書が 2 件ある"
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=void run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "取り消した請求書があれば作り直さない" 3 0 "status=void"
FAKE_CUST_META="$INV_META" FAKE_SUBTOTAL_BUMP=1 run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "小計が計算と違えば確定しない" 3 3 "確定しない"
printf '%s' "$LOG" | grep -q '^CALL POST .*/finalize' && ng "小計が違うのに確定した" || ok "小計が違えば finalize を呼ばない"
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=draft FAKE_DRAFT_SUBTOTAL=18000 FAKE_DRAFT_LINES=2 run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "明細まで済んだ下書きは確定して送る" 0 3 "INVOICE in_draft"
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=draft run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "明細の無い下書きには明細を足して送る" 0 5 "INVOICE in_draft"
FAKE_CUST_META="$INV_META" FAKE_INV_STATE=draft FAKE_DRAFT_SUBTOTAL=10000 FAKE_DRAFT_LINES=1 run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "途中までの下書きは確定しない" 3 0 "確定しない"
FAKE_CUST_META="$(meta card)" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "契約の無い顧客には作らない" 3 0 "契約が無い"
FAKE_CUST_META="$(meta card "$NEXT-01" 12)" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "開始の月より前の月は作らない（F2）" 0 0 "請求するものが無い"
FAKE_CUST_META="$(meta card "$(ym_shift "$LAST" -6)-15" 12 "$(ym_shift "$LAST" -1)-05")" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "終了の月より後の月は作らない（F2）" 0 0 "請求するものが無い"
FAKE_CUST_META="$(meta card "$(ym_shift "$LAST" -5)-15" 12 "$LAST-05")" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "終了の月（6 か月目）には残りを足す" 0 8 "TOTAL $LAST 126000 円（税別、明細 4 行）"
check_arg "終了の月に開発費の残り 6 回 = 48,000 円" "amount=48000"
FAKE_CUST_META="$INV_META" FAKE_REPLAY=1 FAKE_INV_GET_STATUS=void run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "replay で前回の請求書が下書きでなければ exit 3" 3 1 "前回の結果が返ったが、今の状態が期待と違う"
SCN=live FAKE_CUST_META="$INV_META" run invoice --customer cus_x --month "$LAST" --apply --mode live
expect "本番の invoice は live と打たなければ作らない" 64 0 "本番は端末から実行する"
SCN=livemismatch FAKE_CUST_META="$INV_META" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "invoice のモード違いは exit 3" 3 0 "観測 livemode=true"

# 8. charge（2 か月前の分。期限は先月の末日で、もう過ぎている）
CH_META="$(meta card "$TWO_AGO-15" 12)"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "charge は既定のカードで払う" 0 1 "PAID in_open $TWO_AGO"
check_arg "charge は既定のカードを渡す" "payment_method=pm_default"
FAKE_CUST_META="$(jq -c '. + {card_setup_session: "cs_old"}' <<<"$CH_META")" FAKE_CS_STATUS=complete FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "charge は card-setup で保存したカードで払う" 0 1 "PAID in_open"
check_arg "charge は SetupIntent のカードを渡す" "payment_method=pm_saved"
FAKE_CUST_META="$(meta transfer "$TWO_AGO-15" 12)" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "振込の顧客には charge しない（F2）" 3 0 "card でない（観測 payment=transfer）"
FAKE_CUST_META="$(meta "" "$TWO_AGO-15" 12)" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "payment の無い顧客には charge しない" 3 0 "観測 payment=なし"
FAKE_CUST_META="$CH_META" FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "カードが無ければ払わない" 3 0 "保存したカードが無い"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "請求書が無ければ払わない" 3 0 "請求書が無い"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=draft run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "下書きの請求書は払わない" 3 0 "open でない"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=paid run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "支払い済みなら払わない" 0 0 "は支払い済み"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE=1 run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "請求書の支払期限が計算と違えば払わない" 3 0 "支払期限が計算と違う（期待 $DUE_TWO_AGO"
FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" FAKE_PAY_STATUS=open run charge --customer cus_x --month "$TWO_AGO" --apply --mode test
expect "払った応答が paid でなければ exit 3" 3 1 "支払い済みにならなかった"
SCN=live FAKE_CUST_META="$CH_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_TWO_AGO" run charge --customer cus_x --month "$TWO_AGO" --apply --mode live
expect "本番の charge は live と打たなければ払わない" 64 0 "本番は端末から実行する"

# 9. status（読むだけ）
FAKE_CUST_META="$(jq -c '. + {card_setup_session: "cs_old"}' <<<"$(meta card "$LAST-15" 12 2099-01-05)")" FAKE_CS_STATUS=open FAKE_INV_STATE=open run status --customer cus_x --mode test
expect "status は契約の metadata を出す" 0 0 "CONTRACT xesm start=$LAST-15 devfee_count=12 end=2099-01-05"
has_line "status は今月の請求書を出す" "INVOICE $THIS in_open status=open"
has_line "status は先月の請求書を出す" "INVOICE $LAST in_open status=open"
has_line "status はカードが無いことを出す" "CARD なし（card-setup のページ: open）"
has_line "status は開いているページの URL を出す" "SETUP_URL https://checkout.example.test/c/old"

# 10. 前の形（same_day_advance）の写しでは、新しいサブコマンドはテストモードでも本番でも止まる（F2: 前の形の plans.json）
old_stops() {
  local what="$1" scn="$2"
  shift 2
  RUN_PLANS="$OLD_PLANS" SCN="$scn" FAKE_CUST_META="$INV_META" run "$@"
  expect "前の形の写しでは $what を止める" 3 0 "このスクリプトの実装（month_end"
  [ -z "$LOG" ] && ok "前の形の写しの $what は curl を呼ばない" || ng "前の形の写しの $what が curl を呼んだ"
}
old_stops "contract（test）" match contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode test
old_stops "contract（live）" live contract --customer cus_x --service xesm --start 2026-11-15 --devfee-count 12 --apply --mode live
old_stops "invoice（test）" match invoice --customer cus_x --month "$LAST" --apply --mode test
old_stops "invoice（live）" live invoice --customer cus_x --month "$LAST" --apply --mode live
old_stops "invoice の dry-run" match invoice --customer cus_x --month "$LAST"
old_stops "charge（live）" live charge --customer cus_x --month "$TWO_AGO" --apply --mode live
old_stops "card-setup（test）" match card-setup --customer cus_x --apply --mode test
old_stops "cancel（live）" live cancel --customer cus_x --service xesm --accepted "$TODAY" --apply --mode live
old_stops "simulate" match simulate --start 2026-11-15 --devfee-count 12 --months 3
RUN_PLANS="$OLD_PLANS" run customer --code sample-co --name テスト株式会社 --email billing@example.test --payment card
expect "前の形の写しでも customer の dry-run は動く" 0 0 "DONE dry-run"
RUN_PLANS="$OLD_PLANS" FAKE_CUST_META="$INV_META" run status --customer cus_x --mode test
expect "前の形の写しでも status（読むだけ）は動く" 0 0 "CUSTOMER cus_x customer_code=sample-co"

# 13. 寺田の決定（2026-11-07 12:4x）1: --early-test はテストモードだけ、期限前でも払う。本番では受け付けない
EARLY_META="$(meta card "$LAST-15" 12)"
FAKE_CUST_META="$EARLY_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_LAST" run charge --customer cus_x --month "$LAST" --apply --mode test
expect "--early-test なしでは期限前の charge は止まる" 64 0 "期限の日より前は払わない"
FAKE_CUST_META="$EARLY_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_LAST" run charge --customer cus_x --month "$LAST" --early-test --apply --mode test
expect "テストモードの --early-test は期限前でも払う" 0 1 "NOTE --early-test"
check_arg "前倒しでも保存したカードで払う" "payment_method=pm_default"
SCN=live FAKE_CUST_META="$EARLY_META" FAKE_CUST_PM=pm_default FAKE_INV_STATE=open FAKE_INV_DUE="$DUE_LAST" run charge --customer cus_x --month "$LAST" --early-test --apply --mode live
expect "本番の --early-test は exit 64" 64 0 "--early-test はテストモードだけ"
[ -z "$LOG" ] && ok "本番の --early-test は curl を呼ばない（鍵も読まない）" || ng "本番の --early-test が curl を呼んだ: $LOG"
run charge --customer cus_x --month "$LAST" --early-test
expect "--mode の無い --early-test は exit 64" 64 0 "--early-test はテストモードだけ"
run invoice --customer cus_x --month "$LAST" --early-test
expect "--early-test は charge でだけ使う" 64 0 "--early-test は charge でだけ使う"

# 14. 寺田の決定 2: 前からの顧客は、開始日を元の契約日にし、請求を始める月（bill_from）より前は請求しない
run contract --customer cus_x --service xesm --start 2026-08-10 --devfee-count 12 --billing-from 2026-11
expect "contract の dry-run は bill_from を出す" 0 0 "contract_xesm_bill_from=2026-11"
run contract --customer cus_x --service xesm --start 2026-08-10 --devfee-count 12 --billing-from 2026-07
expect "開始日の月より前の bill_from は exit 64" 64 0 "開始日の月より前"
run contract --customer cus_x --service xesm --start 2026-08-10 --devfee-count 12 --billing-from 2026-1
expect "bill_from の形の誤りは exit 64" 64 0 "--billing-from は YYYY-MM"
FAKE_CUST_META="$(meta transfer)" run contract --customer cus_x --service xesm --start 2026-08-10 --devfee-count 12 --billing-from 2026-11 --apply --mode test
expect "contract は bill_from も書く" 0 1 "CONTRACT cus_x xesm: start=2026-08-10 devfee_count=12 bill_from=2026-11"
check_arg "bill_from を metadata に書く" "metadata[contract_xesm_bill_from]=2026-11"
FAKE_CUST_META="$(meta transfer 2026-08-10 12)" run contract --customer cus_x --service xesm --start 2026-08-10 --devfee-count 12 --billing-from 2026-11 --apply --mode test
expect "契約があとから bill_from を足すのは止める（二重請求の元）" 3 0 "contract_xesm_bill_from が違う"
BF_META="$(jq -c --arg b "$THIS" '. + {contract_xesm_bill_from: $b}' <<<"$(meta card "$TWO_AGO-10" 12)")"
FAKE_CUST_META="$BF_META" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "bill_from より前の月の invoice は止める（その月は請求書払いで請求済み）" 3 0 "より前を請求しない"
BF_META2="$(jq -c --arg b "$LAST" '. + {contract_xesm_bill_from: $b}' <<<"$(meta card "$TWO_AGO-10" 12)")"
FAKE_CUST_META="$BF_META2" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "bill_from の月からは請求する（2 か月目として 1 か月分 + 開発費 2 回目）" 0 6 "CHECK ok: 小計 18000 円"
printf '%s\n' "$LOG" | grep '^ARGV' | grep -qF '2/12 回目' && ok "bill_from の月は初月の扱いにしない（開発費は元の開始月から数えて 2 回目）" || ng "開発費の明細に 2/12 回目が無い"
check_no_arg "bill_from の月に初月の明細を作らない" "初月"
# 元の開始日から数える（独立レビューの例）: 2026-06-10 開始、bill_from 2026-11、2027-03-15 終了。
# 残りの期間分 = 10,000 × 12 −（6〜2 月の 9 か月 90,000 + 3 月の日割り 10,000 × 15 ÷ 31 = 4,838）= 25,162
run simulate --start 2026-06-10 --devfee-count 0 --end 2027-03-15 --billing-from 2026-11 --months 10
expect "simulate は bill_from を受ける" 0 0 "billing_from=2026-11"
has_line "bill_from より前の月（6 月）は 0" "TOTAL 2026-06 0"
has_line "bill_from より前の月（10 月）は 0" "TOTAL 2026-10 0"
has_line "bill_from の月（11 月）は 1 か月分（初月の扱いにしない）" "LINE 2026-11 usage 10000 "
has_line "最後の月は日割り（15/31 日 = 4,838）" "LINE 2027-03 usage_prorated 4838 "
has_line "残りの期間分は元の開始日から数える（25,162）" "LINE 2027-03 remaining_usage 25162 "

# 15. 独立レビューの MEDIUM（寺田 2026-11-07「直す」）: 今月の分は締めの日（月の末日）からだけ作る
END_THIS="$(TZ=Asia/Tokyo date -r "$(($(jst_epoch "$NEXT-01 00:00:00") - 1))" '+%Y-%m-%d' 2>/dev/null || TZ=Asia/Tokyo date -d "@$(($(jst_epoch "$NEXT-01 00:00:00") - 1))" '+%Y-%m-%d')"
run invoice --customer cus_x --month "$THIS"
if [ "$TODAY" = "$END_THIS" ]; then
  expect "今月の末日（締めの日）は今月の分を作れる" 0 0 "PLAN invoice"
else
  expect "今月の分は締めの日（$END_THIS）より前は exit 64" 64 0 "締めの日（$END_THIS）から作る"
fi
run invoice --customer cus_x --month "$LAST"
expect "先月の分はいつでも作れる" 0 0 "PLAN invoice"

# 16. 振込の顧客の請求書には、振込先（COR_BILLING_TRANSFER_FOOTER）を footer に入れる。無ければ作らない
TR_META="$(meta transfer "$LAST-15" 12)"
FAKE_CUST_META="$TR_META" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "振込先の無い振込の顧客の請求書は作らない" 3 0 "振込先（環境変数 COR_BILLING_TRANSFER_FOOTER）が無い"
COR_BILLING_TRANSFER_FOOTER="お振込先: テスト銀行 本店 普通 0000000" FAKE_CUST_META="$TR_META" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "振込の顧客の請求書は作る" 0 6 "NOTE 振込の顧客: 請求書の footer に振込先"
check_arg "振込先を footer に入れる" "footer=お振込先: テスト銀行 本店 普通 0000000"
COR_BILLING_TRANSFER_FOOTER="お振込先: テスト銀行" FAKE_CUST_META="$(meta card "$LAST-15" 12)" run invoice --customer cus_x --month "$LAST" --apply --mode test
expect "カードの顧客の請求書も作る" 0 6 "CHECK ok"
check_no_arg "カードの顧客の請求書に振込先を入れない" "footer="

# 17. mark-paid: 振込を受けたら、その月の請求書を Stripe の外で支払い済みにする（引き落とさない）
run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY"
expect "mark-paid の dry-run は paid_out_of_band を出す" 0 0 "paid_out_of_band=true"
run mark-paid --customer cus_x --month "$LAST" --paid-on "$TOMORROW"
expect "未来の入金日は exit 64" 64 0 "未来の日付は使わない"
run mark-paid --customer cus_x --month "$LAST"
expect "mark-paid には入金日が要る" 64 0 "mark-paid には --paid-on が要る"
run charge --customer cus_x --month "$LAST" --paid-on "$TODAY"
expect "--paid-on は mark-paid でだけ使う" 64 0 "--paid-on は mark-paid でだけ使う"
FAKE_CUST_META="$(meta card "$LAST-15" 12)" FAKE_INV_STATE=open run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "カードの顧客は mark-paid しない" 3 0 "transfer でない"
FAKE_CUST_META="$TR_META" FAKE_INV_STATE=open run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "振込の顧客の open の請求書を支払い済みにする" 0 1 "MARKED_PAID in_open $LAST"
check_arg "Stripe の外での支払いとして記録する" "paid_out_of_band=true"
check_no_arg "mark-paid はカードで払わない" "payment_method="
FAKE_CUST_META="$TR_META" FAKE_INV_STATE=paid run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "支払い済みなら何もしない" 0 0 "OK mark-paid"
FAKE_CUST_META="$TR_META" run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "請求書が無ければ exit 3" 3 0 "請求書が無い"
FAKE_CUST_META="$TR_META" FAKE_INV_STATE=open FAKE_PAY_STATUS=open run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "支払い済みにならなければ exit 3" 3 1 "支払い済みにならなかった"
SCN=live FAKE_CUST_META="$TR_META" FAKE_INV_STATE=open run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode live
expect "本番の mark-paid は live と打たなければ何もしない" 64 0 "本番は端末から実行する"
# 独立レビューの HIGH: 月を取り違えて新しい月を支払い済みにしない（支払い済みは取り消せない）
FAKE_CUST_META="$TR_META" FAKE_INV_STATE=open FAKE_OLDER_OPEN="$TWO_AGO" run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "前の月の open の請求書があれば mark-paid しない" 3 0 "より前の open の請求書がある: $TWO_AGO（in_older）"
FAKE_CUST_META="$TR_META" FAKE_INV_STATE=open FAKE_OLDER_OPEN="$THIS" run mark-paid --customer cus_x --month "$LAST" --paid-on "$TODAY" --apply --mode test
expect "後の月の open の請求書は止める理由にならない" 0 1 "MARKED_PAID in_open $LAST"

# 18. clerk-sync: 契約の metadata から services を作り、Clerk の組織の public_metadata.services に送る
CLERK_META="$(jq -c '. + {clerk_org_id: "org_x"}' <<<"$(meta card "$LAST-15" 12)")"
clerk_calls() { count "$LOG" '^CALL .*/organizations/'; }
clerk_patches() { count "$LOG" '^CALL PATCH /organizations/'; }
clerk_state() { if [ -f "$WORK/log.clerk" ]; then cat "$WORK/log.clerk"; else printf '{}'; fi; }

FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test
expect "clerk-sync の dry-run は送る services を出す" 0 0 'PLAN services.xesm from='
eq "clerk-sync の dry-run は Clerk を呼ばない（顧客を読むだけ）" "$(clerk_calls)" "0"
printf '%s' "$OUT" | grep -qF '"business-dossier":null' && ok "契約の無いサービスは null（Clerk から消す）" || ng "null のサービスが無い: $OUT"
printf '%s' "$OUT" | grep -qF '"xesm":{"from":"'"$LAST"'-15","until":null,"hold":false}' && ok "契約のサービスは from・until・hold の 3 つを出す" || ng "xesm の形が違う: $OUT"
printf '%s' "$OUT" | grep -qF 'DONE dry-run' && ok "clerk-sync の dry-run は書かないと出す" || ng "DONE dry-run が無い"
printf '%s' "$LOG" | grep -qF "$CLERK_KEY_DUMMY" && ng "Clerk の鍵が curl の引数に載った" || ok "Clerk の鍵は curl の引数に載らない"
CKEY="" FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test
expect "clerk-sync の dry-run は Clerk の鍵が無くても通る（鍵を読まない）" 0 0 'DONE dry-run'
FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply
expect "clerk-sync の apply は組織の metadata に送る" 0 0 'SENT clerk org_x: services を送った'
eq "clerk-sync は PATCH を 1 回だけ呼ぶ（先に顧客を読む）" "$(clerk_patches)" "1"
printf '%s\n' "$LOG" | grep -qF 'CLERK_BODY {"public_metadata":{"services":' && ok "送る本文は public_metadata.services の形" || ng "送る本文の形が違う: $LOG"
printf '%s' "$LOG" | grep '^ARGV' | grep -qF "$CLERK_KEY_DUMMY" && ng "Clerk の鍵が curl の引数に載った（apply）" || ok "apply でも Clerk の鍵は curl の引数に載らない"
printf '%s' "$LOG" | grep -q '^STDIN_AUTH no' && ng "標準入力に鍵の無い呼出しがある" || ok "鍵は全部の呼出しで標準入力から渡る（Clerk も）"
eq "Clerk の state に xesm が入った" "$(clerk_state | jq -r '.services.xesm.from')" "$LAST-15"
FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply --clerk-org org_y
expect "--clerk-org は clerk-sync でだけ使わない（customer 用）" 64 0 "customer でだけ使う"
FAKE_CUST_META="$(jq -c 'del(.clerk_org_id)' <<<"$CLERK_META")" run clerk-sync --customer cus_x --mode test --apply
expect "clerk_org_id の無い顧客は止まる" 3 0 "clerk_org_id が無い"
eq "clerk_org_id が無ければ Clerk を呼ばない" "$(clerk_calls)" "0"
FAKE_CUST_META="$(jq -c '. + {clerk_org_id: "org-bad!"}' <<<"$CLERK_META")" run clerk-sync --customer cus_x --mode test --apply
expect "clerk_org_id の形が違えば止まる" 3 0 "clerk_org_id の形が違う"
FAKE_CUST_META="$(jq -c '. + {contract_xesm_start: "2026-02-30"}' <<<"$CLERK_META")" run clerk-sync --customer cus_x --mode test --apply
expect "実在しない開始日は Clerk に送らない" 3 0 "実在する日付ではない"
CKEY="" FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply
expect "Clerk の鍵が無ければ書かない（端末も無い）" 64 0 "Clerk の鍵が無い"
eq "Clerk の鍵が無ければ PATCH しない" "$(clerk_patches)" "0"
SCN=live FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode live --apply
expect "本番の clerk-sync は live と打たなければ送らない" 64 0 "本番は端末から実行する"
FAKE_CLERK_ECHO=wrong FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply
expect "Clerk の応答が送った値と違えば exit 3（戻せないことを伝える）" 3 0 "Clerk の応答の services が送った値と違う"
FAKE_CLERK_STATUS=500 FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply
expect "Clerk が 500 を返したら exit 4" 4 0 "API エラー"
# deep merge: 契約の無くなったサービスは null で消える（Clerk の既存の metadata に business-dossier がある状態から始める）
rm -f "$WORK/log.clerk"
FAKE_CLERK_META='{"services":{"business-dossier":{"from":"2026-01-01","until":null,"hold":false},"xesm":{"from":"2026-11-01","until":null,"hold":false}}}' \
  FAKE_CUST_META="$CLERK_META" run clerk-sync --customer cus_x --mode test --apply
expect "既存の services に契約の無いサービスがあれば消す" 0 0 "business-dossier=null"
eq "消したあとの state に business-dossier が無い" "$(clerk_state | jq -r '"\(has("services")):\(.services | has("business-dossier"))"')" "true:false"
FAKE_CUST_META="$(jq -c '. + {contract_xesm_hold: "true"}' <<<"$CLERK_META")" run clerk-sync --customer cus_x --mode test --apply
expect "hold の印を Clerk に写す" 0 0 'hold=true'
printf '%s' "$LOG" | grep '^CLERK_BODY' | grep -qF '"hold":true' && ok "hold=true を本文で送る" || ng "hold=true が本文に無い: $LOG"
FAKE_CUST_META="$(jq -c '. + {contract_xesm_hold: "yes"}' <<<"$CLERK_META")" run clerk-sync --customer cus_x --mode test --apply
expect "hold の印が true でも false でも空でもなければ送らない" 3 0 "hold が true か false でも空でもない"
run clerk-sync --customer cus_x
expect "clerk-sync に --mode が無いと exit 64（顧客を読むため）" 64 0 "--mode test か --mode live が要る"
run clerk-sync --customer cus_x --service xesm --mode test
expect "--service は clerk-sync でだけ使わない" 64 0 "contract cancel simulate でだけ使う"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
