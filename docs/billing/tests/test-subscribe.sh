#!/usr/bin/env bash
# docs/billing/subscribe.sh と verify-installments.sh の検査。通信しない（PATH の先頭に偽の curl を置く）。
# 実行: bash docs/billing/tests/test-subscribe.sh
# 確かめること:
#   1. dry-run は curl を呼ばない。入力の誤り（顧客コード・メール・id・回数・過去の日付）を exit 64 で落とす
#   2. 鍵の値が出力にも curl の引数にも出ない。モード違いでは POST しない（exit 3）
#   3. basic の重複・カードの無い開発費・開発費の重複・basic 以外の解約を、POST せずに exit 3 で止める
#   4. 最初の請求書の税込の額が plans.json と違えば、支払いページの URL を出さずに exit 3
#   5. verify-installments: 支払い済みがちょうど N 件・他 0 件・canceled のときだけ合格。N+1 件や active は exit 5
#   6. verify-installments は本番の鍵（livemode=true）なら何も作らずに exit 3
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING="$(cd "$HERE/.." && pwd)"
REAL_PLANS="$BILLING/plans.json"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/billing-sub-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
# 実装済みの形（same_day_advance）の写しで、既存の動きを確かめる。本物の plans.json（month_end）では、
# 契約・解約を作るサブコマンドが止まることを、ファイルの末尾で確かめる。
PLANS="$WORK/plans-same-day.json"
jq '.billing = {closing: "same_day_advance", payment_due: "at_period_start", first_month: "full_month"}' "$REAL_PLANS" >"$PLANS"
cp "$HERE/fake-curl.sh" "$WORK/bin/curl"
chmod +x "$WORK/bin/curl"
DUMMY_KEY="dummy-key-for-leak-check-7f3a9c"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
count() { printf '%s\n' "$1" | grep -c -- "$2" || true; }

# run <script> <args...>（環境変数 FAKE_* と KEY はそのまま渡す）→ RC・OUT・LOG
run() {
  local script="$1"
  shift
  : >"$WORK/log"
  set +e
  OUT="$(FAKE_SCENARIO="${SCN:-match}" FAKE_PLANS="$PLANS" FAKE_LOG="$WORK/log" PATH="$WORK/bin:$PATH" \
    COR_BILLING_API_KEY="${KEY-$DUMMY_KEY}" VERIFY_POLL_SECONDS=0 VERIFY_MIN_STEP_SECONDS=0 \
    bash "$BILLING/$script" "$@" --plans "${RUN_PLANS:-$PLANS}" </dev/null 2>&1)"
  RC=$?
  set -e
  LOG="$(cat "$WORK/log")"
}
posts() { count "$LOG" '^CALL POST '; }

expect() {
  # expect <説明> <期待 rc> <期待 POST 数 or -> <出力に含む文字列 or ->
  local what="$1" rc="$2" npost="$3" text="$4"
  if [ "$RC" -ne "$rc" ]; then ng "$what: rc 期待 $rc 観測 $RC: $OUT"; return; fi
  if [ "$npost" != "-" ] && [ "$(posts)" -ne "$npost" ]; then ng "$what: POST 期待 $npost 観測 $(posts)"; return; fi
  if [ "$text" != "-" ] && ! printf '%s' "$OUT" | grep -qF -- "$text"; then ng "$what: 出力に「$text」が無い: $OUT"; return; fi
  ok "$what"
}

# 1. dry-run と入力
run subscribe.sh customer --code sample-co --name テスト株式会社 --email billing@example.test
expect "customer の dry-run" 0 0 "DONE dry-run"
[ -z "$LOG" ] && ok "dry-run は curl を呼ばない" || ng "dry-run が curl を呼んだ"
run subscribe.sh basic --customer cus_x --service xesm --tenant 組織
expect "basic の dry-run は税別と参考の税込を出す" 0 0 "税別 10,000 円（参考 税込 11,000 円）"
run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align
expect "devfee の dry-run は回数と総額を出す" 0 0 "× 8 回 = 税別 64,000 円"
run subscribe.sh customer --code Sample_Co --name x --email billing@example.test
expect "顧客コードの大文字・下線は exit 64" 64 - "--code は英小文字"
run subscribe.sh customer --code sample-co --name x --email "billing at example"
expect "メールの形の誤りは exit 64" 64 - "--email の形が違う"
run subscribe.sh basic --customer sub_x --service xesm --tenant 組織
expect "customer に sub_ の id は exit 64" 64 - "--customer は cus_"
run subscribe.sh basic --customer cus_x --service grift --tenant 組織
expect "知らないサービスは exit 64" 64 - "--service は"
run subscribe.sh devfee --customer cus_x --service xesm --count 13 --start now
expect "回数 13 は exit 64（plans.json は 12）" 64 - "--count は 1〜12"
run subscribe.sh devfee --customer cus_x --service xesm --count 0 --start now
expect "回数 0 は exit 64" 64 - "--count は 1〜12"
run subscribe.sh devfee --customer cus_x --service xesm --count 3 --start 2020-01-01
expect "過去の開始日は exit 64" 64 - "過去の日付は使わない"
run subscribe.sh status --customer cus_x
expect "status に --mode が無いと exit 64" 64 0 "--mode test か --mode live"
run subscribe.sh basic --customer cus_x --service xesm --tenant 組織 --apply
expect "--apply に --mode が無いと exit 64" 64 0 "--mode"

# 2. 鍵とモード
SCN=livemismatch run subscribe.sh customer --code sample-co --name x --email billing@example.test --apply --mode test
expect "モード違いは POST せずに exit 3" 3 0 "観測 livemode=true"
FAKE_SEARCH=none run subscribe.sh customer --code sample-co --name x --email billing@example.test --apply --mode test
expect "customer を作る" 0 1 "CREATED customer cus_new"
printf '%s' "$OUT" | grep -qF "$DUMMY_KEY" && ng "鍵が出力に出た" || ok "鍵は出力に出ない"
printf '%s' "$LOG" | grep '^ARGV' | grep -qF "$DUMMY_KEY" && ng "鍵が curl の引数に載った" || ok "鍵は curl の引数に載らない"
FAKE_SEARCH=one run subscribe.sh customer --code sample-co --name x --email billing@example.test --apply --mode test
expect "既にある customer は作らない" 0 0 "OK customer cus_existing"
FAKE_SEARCH=two run subscribe.sh customer --code sample-co --name x --email billing@example.test --apply --mode test
expect "customer_code が 2 件なら exit 3" 3 0 "2 件ある"
FAKE_SEARCH=none run subscribe.sh customer --code sample-co --name x --email billing@example.test --clerk-org org_abc123 --apply --mode test
expect "Clerk の組織 id を付けて customer を作る" 0 1 "clerk_org_id=org_abc123"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'metadata\[clerk_org_id\]=org_abc123' && ok "Customer の metadata に clerk_org_id を送る" || ng "metadata[clerk_org_id] が無い"
FAKE_SEARCH=one_clerk run subscribe.sh customer --code sample-co --name x --email billing@example.test --clerk-org org_abc123 --apply --mode test
expect "既存の顧客の clerk_org_id が違えば書き換えずに exit 3" 3 0 "期待 org_abc123、観測 org_other"
run subscribe.sh customer --code sample-co --name x --email billing@example.test --clerk-org "org abc"
expect "--clerk-org の形の誤りは exit 64" 64 0 "--clerk-org は英数字と下線"
run subscribe.sh basic --customer cus_x --service xesm --tenant 組織 --clerk-org org_abc123
expect "--clerk-org は customer でだけ使う（exit 64）" 64 0 "customer でだけ使う"

# 3. 重複と前提
FAKE_SUBS=basic_active run subscribe.sh basic --customer cus_x --service business-dossier --tenant c01 --apply --mode test
expect "basic の重複は POST せずに exit 3" 3 0 "basic が既にある"
FAKE_SUBS=none run subscribe.sh basic --customer cus_x --service business-dossier --tenant c01 --apply --mode test
expect "basic を作り、支払いページの URL を出す" 0 1 "PAY_URL https://invoice.example.test/i/1"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'payment_settings\[save_default_payment_method\]=on_subscription' \
  && ok "basic はカードを保存する設定で作る" || ng "save_default_payment_method が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'default_tax_rates\[0\]=txr_fake' && ok "basic に消費税を付ける" || ng "default_tax_rates が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'items\[0\]\[price\]=price_fake' && ok "basic は plans.json の価格で作る" || ng "items[0][price] が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'payment_behavior=default_incomplete' && ok "basic は default_incomplete で作る" || ng "payment_behavior が無い"
FAKE_SUBS=none FAKE_REPLAY=1 FAKE_SUB_STATUS=incomplete_expired FAKE_INV_STATUS=void run subscribe.sh basic --customer cus_x --service business-dossier --tenant c01 --apply --mode test
expect "replay で前回の basic が失効していれば URL を出さずに exit 3" 3 1 "前回の結果が返ったが、今の状態が期待と違う"
printf '%s' "$OUT" | grep -q '^PAY_URL' && ng "失効した basic の URL を出した" || ok "失効した basic の URL は出さない"
FAKE_SUBS=none FAKE_REPLAY=1 FAKE_SUB_STATUS=incomplete FAKE_INV_STATUS=open run subscribe.sh basic --customer cus_x --service business-dossier --tenant c01 --apply --mode test
expect "replay でも前回の basic がまだ払える状態なら URL を出す" 0 1 "PAY_URL https://invoice.example.test/i/1"
FAKE_SUBS=basic_incomplete run subscribe.sh status --customer cus_x --mode test
expect "status は未払いの basic の支払いページの URL を出す" 0 0 "PAY_URL sub_inc https://invoice.example.test/i/9"
FAKE_SEARCH=none FAKE_REPLAY=1 run subscribe.sh customer --code sample-co --name x --email billing@example.test --apply --mode test
expect "replay で顧客が残っていれば続ける" 0 1 "Idempotent-Replayed"
FAKE_SUBS=none FAKE_BASIC_TOTAL=10000 run subscribe.sh basic --customer cus_x --service business-dossier --tenant c01 --apply --mode test
expect "税込の額の違い（消費税が付いていない）は URL を出さずに exit 3" 3 1 "期待 11000、観測 10000"
printf '%s' "$OUT" | grep -q '^PAY_URL' && ng "額が違うのに URL を出した" || ok "額が違えば URL を出さない"
FAKE_SUBS=none run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "basic が active でなければ開発費を作らない" 3 0 "basic が active でない"
FAKE_SUBS=basic_nopm run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "カードの無い basic では開発費を作らない" 3 0 "カードが保存されていない"
FAKE_SUBS=basic_active FAKE_SCHEDULES=devfee_active run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "開発費の schedule の重複は exit 3" 3 0 "開発費の schedule が既にある"
FAKE_SUBS=basic_active run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "開発費の schedule を作る" 0 1 "CREATED schedule sub_sched_1"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'phases\[0\]\[duration\]\[interval_count\]=8' && ok "schedule は回数 8 で止まる設定" || ng "interval_count=8 が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'end_behavior=cancel' && ok "schedule は end_behavior=cancel" || ng "end_behavior=cancel が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q "start_date=1767225600" && ok "--start align は basic の期間末に合わせる" || ng "start_date が basic の期間末でない"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'default_settings\[default_payment_method\]=pm_fake' && ok "schedule は basic のカードを使う" || ng "default_payment_method が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'phases\[0\]\[duration\]\[interval\]=month' && ok "schedule の単位は month" || ng "interval=month が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'phases\[0\]\[default_tax_rates\]\[0\]=txr_fake' && ok "schedule に消費税を付ける" || ng "phases の default_tax_rates が無い"
FAKE_SUBS=basic_active FAKE_REPLAY=1 FAKE_SCHED_STATUS=canceled run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "replay で前回の schedule が終わっていれば exit 3" 3 1 "前回の結果が返ったが、今の状態が期待と違う"
FAKE_SUBS=basic_active FAKE_REPLAY=1 FAKE_SCHED_STATUS=not_started run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "replay でも前回の schedule が生きていれば続ける" 0 1 "CREATED schedule sub_sched_1"
# 解約: 受理日の 1 か月後の同じ日（無い月は月末）の終わり = 翌日の日本時間 0:00（特商法ページ・plans.json の cancellation）
# 日付の計算は、実装と別に書いた値で確かめる
date_fn() { bash -c '. "$1/lib.sh"; PLANS="$2"; shift 2; "$@"' _ "$BILLING" "$PLANS" "$@"; }
for c in "2026-11-05 2026-12-05" "2026-12-15 2027-01-15" "2026-03-31 2026-04-30" "2027-01-31 2027-02-28" "2028-01-31 2028-02-29" "2026-08-31 2026-09-30"; do
  set -- $c
  got="$(date_fn add_months_clamped "$1" 1)"
  [ "$got" = "$2" ] && ok "受理日 $1 の 1 か月後は $2" || ng "受理日 $1 の 1 か月後: 期待 $2 観測 $got"
done
for c in "2026-02-30 no" "2027-02-29 no" "2028-02-29 yes" "2100-02-29 no" "2000-02-29 yes" "2026-13-01 no"; do
  set -- $c
  if date_fn valid_date "$1"; then got=yes; else got=no; fi
  [ "$got" = "$2" ] && ok "日付 $1 の実在 = $2" || ng "日付 $1 の実在: 期待 $2 観測 $got"
done
for c in "2026-11-05 1796482800" "2027-01-31 1803826800" "2028-01-31 1835449200"; do
  set -- $c
  got="$(bash -c '. "$1/lib.sh"; PLANS="$3"; set_cancel_at "$2"; printf "%s" "$CANCEL_AT"' _ "$BILLING" "$1" "$PLANS")"
  [ "$got" = "$2" ] && ok "受理日 $1 の終了日時は $2（終了日の翌日 0:00 JST）" || ng "受理日 $1 の終了日時: 期待 $2 観測 $got"
done
TODAY="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
WANT_AT="$(bash -c '. "$1/lib.sh"; PLANS="$3"; set_cancel_at "$2"; printf "%s" "$CANCEL_AT"' _ "$BILLING" "$TODAY" "$PLANS")"
TOMORROW="$(TZ=Asia/Tokyo date -r "$(($(date '+%s') + 86400))" '+%Y-%m-%d' 2>/dev/null || TZ=Asia/Tokyo date -d tomorrow '+%Y-%m-%d')"
run subscribe.sh cancel --subscription sub_x
expect "解約は受理日が要る" 64 0 "cancel には --accepted が要る"
run subscribe.sh cancel --subscription sub_x --accepted "$TOMORROW"
expect "未来の受理日は exit 64" 64 0 "未来の日付は使わない"
run subscribe.sh cancel --subscription sub_x --accepted 2026-02-30
expect "実在しない受理日は exit 64" 64 0 "実在する日付ではない"
run subscribe.sh cancel --subscription sub_x --accepted 2020-01-15
expect "終了日が過ぎた受理日は exit 64" 64 0 "既に過ぎている"
run subscribe.sh status --customer cus_x --accepted "$TODAY" --mode test
expect "--accepted は cancel でだけ使う" 64 0 "cancel でだけ使う"
run subscribe.sh cancel --subscription sub_x --accepted "$TODAY"
expect "解約の dry-run は終了日と終了日時を出す" 0 0 "cancel_at=$WANT_AT"
FAKE_SUB_PLAN=dev_fee run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "開発費の subscription は解約しない" 3 0 "basic でない"
FAKE_SUB_PLAN=basic run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "basic に受理日から数えた終了日時を付ける" 0 1 "CANCEL_AT sub_x"
printf '%s' "$LOG" | grep '^ARGV' | grep '\[-X\] \[POST\]' | grep -qF "[cancel_at=$WANT_AT]" && ok "解約は cancel_at=$WANT_AT を送る" || ng "cancel_at=$WANT_AT が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep '\[-X\] \[POST\]' | grep -q 'cancel_at_period_end\|proration_behavior' && ng "期間末の解約か日割りの指定を送った" || ok "期間末の解約も日割りの指定も送らない"
FAKE_SUB_PLAN=basic FAKE_PERIOD_END=$(($(date '+%s') + 90 * 86400)) run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "終了日時が支払い済みの期間の中なら止めない（差額が残高に戻るため）" 3 0 "支払い済みの期間（"
FAKE_SUB_PLAN=basic FAKE_CANCEL_AT="$WANT_AT" run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "同じ終了日時が付いていれば何もしない" 0 0 "OK cancel sub_x: 既に"
FAKE_SUB_PLAN=basic FAKE_CANCEL_AT=1999999999 run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "別の終了日時は書き換えない" 3 0 "既に別の終了日時がある"
FAKE_SUB_PLAN=basic FAKE_CANCEL_STATE=true run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "期間末で止まる設定は書き換えない" 3 0 "cancel_at_period_end=true"
FAKE_SUB_PLAN=basic FAKE_SUB_STATUS=canceled run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "終わった subscription は解約しない" 3 0 "解約できる状態でない"
FAKE_SUB_PLAN=basic FAKE_CANCEL_ECHO=wrong run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "応答の cancel_at が違えば exit 3" 3 1 "にならなかった"
FAKE_SUB_PLAN=basic FAKE_REPLAY_RAW=1 run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "replay の値が「True + CR」でも見落とさない" 3 1 "前回の結果が返ったが、今の状態が期待と違う"
FAKE_SUB_PLAN=basic FAKE_REPLAY=1 run subscribe.sh cancel --subscription sub_x --accepted "$TODAY" --apply --mode test
expect "replay で終了日時が付いていなければ exit 3（取り消した解約の再実行）" 3 1 "前回の結果が返ったが、今の状態が期待と違う"
printf '%s' "$OUT" | grep -q '^CANCEL_AT ' && ng "効いていない解約を出した" || ok "効いていない解約は出さない"
FAKE_SUBS=basic_active run subscribe.sh status --customer cus_x --mode test
expect "status は読むだけ" 0 0 "SUB sub_basic service=business-dossier plan=basic status=active"

# 5. verify-installments
FAKE_DEV_INVOICES=12 run verify-installments.sh
expect "12 件・他 0・canceled は合格" 0 - "VERIFY ok: 開発費は 12 回請求して止まった（13 回目は無い）"
[ "$(count "$LOG" 'CALL POST /v1/test_helpers/test_clocks/clock_fake/advance')" -eq 14 ] && ok "clock を 14 回（N+2）進める" || ng "advance の回数: $(count "$LOG" 'advance')"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'start_date=1767225600' && ok "verify は既定で align（basic の次の請求日に始める）" || ng "verify の start_date が align でない"
printf '%s' "$LOG" | grep '^ARGV' | grep 'subscription_schedules' | grep -q 'phases\[0\]\[duration\]\[interval\]=month' \
  && ok "verify の schedule は subscribe.sh と同じ組み立て（month）" || ng "verify の schedule に interval=month が無い"
printf '%s' "$LOG" | grep '^ARGV' | grep '/v1/subscriptions\]' | grep -q 'payment_settings\[save_default_payment_method\]=on_subscription' \
  && ok "verify の basic は subscribe.sh と同じ組み立て" || ng "verify の basic にカードの保存の設定が無い"
FAKE_DEV_INVOICES=12 run verify-installments.sh --start now
expect "verify --start now も合格" 0 - "VERIFY ok"
printf '%s' "$LOG" | grep '^ARGV' | grep -q 'start_date=now' && ok "verify --start now は start_date=now" || ng "start_date=now が無い"
FAKE_DEV_INVOICES=13 run verify-installments.sh
expect "13 件なら不合格 exit 5（F2: 13 回目の請求）" 5 - "支払い済み 13 件（期待 12）"
FAKE_DEV_INVOICES=12 FAKE_DEV_OPEN=1 run verify-installments.sh
expect "支払い済み 12 件でも未払いの 13 回目があれば不合格" 5 - "それ以外 1 件（期待 0）"
FAKE_DEV_INVOICES=12 FAKE_DEV_STATUS=active run verify-installments.sh
expect "subscription が active のままなら不合格" 5 - "subscription=active（期待 canceled）"
FAKE_DEV_INVOICES=12 FAKE_DEV_TOTAL=8000 run verify-installments.sh
expect "税が付いていない請求書があれば不合格" 5 - "額の違う請求書 12 件"
FAKE_PM=none run verify-installments.sh
expect "basic にカードが保存されなければ不合格" 5 - "カードが保存されなかった"
FAKE_DEV_INVOICES=3 run verify-installments.sh --count 3
expect "--count 3 は 3 件で合格" 0 - "VERIFY ok: 開発費は 3 回請求して止まった"
SCN=live run verify-installments.sh
expect "本番の鍵なら何も作らずに exit 3" 3 0 "観測 livemode=true"
run verify-installments.sh --mode live
expect "verify に --mode は無い（exit 64）" 64 0 "テストモード専用"

# 本物の plans.json（billing.closing=month_end、2026-11-07 の決定）では、まだ実装していないので契約・解約を作らない
TODAY_JST="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
RUN_PLANS="$REAL_PLANS" FAKE_SUBS=basic_active run subscribe.sh basic --customer cus_x --service xesm --tenant 組織 --apply --mode test
expect "month_end では basic を作らない" 3 0 "まだ実装していない"
[ -z "$LOG" ] && ok "month_end の basic は curl を呼ばない" || ng "month_end の basic が curl を呼んだ"
RUN_PLANS="$REAL_PLANS" run subscribe.sh basic --customer cus_x --service xesm --tenant 組織
expect "month_end では basic の dry-run も止まる" 3 0 "billing.closing=month_end"
RUN_PLANS="$REAL_PLANS" FAKE_SUBS=basic_active run subscribe.sh devfee --customer cus_x --service business-dossier --count 8 --start align --apply --mode test
expect "month_end では開発費の schedule を作らない" 3 0 "まだ実装していない"
RUN_PLANS="$REAL_PLANS" FAKE_SUB_PLAN=basic run subscribe.sh cancel --subscription sub_x --accepted "$TODAY_JST" --apply --mode test
expect "month_end では解約を作らない" 3 0 "まだ実装していない"
RUN_PLANS="$REAL_PLANS" run verify-installments.sh
expect "month_end では verify-installments も何も作らない" 3 0 "まだ実装していない"
RUN_PLANS="$REAL_PLANS" run subscribe.sh customer --code sample-co --name テスト株式会社 --email billing@example.test
expect "month_end でも customer の dry-run は動く" 0 0 "DONE dry-run"
RUN_PLANS="$REAL_PLANS" FAKE_SUBS=basic_active run subscribe.sh status --customer cus_x --mode test
expect "month_end でも status（読むだけ）は動く" 0 0 "SUB sub_basic"
# 前の形の写しを --plans で渡しても、本番には作らない（独立レビューの指摘）
SCN=live FAKE_SUBS=basic_active run subscribe.sh basic --customer cus_x --service xesm --tenant 組織 --apply --mode live
expect "前の形の写しでも本番の basic は作らない" 3 0 "本番に契約・解約を作らない"
[ -z "$LOG" ] && ok "前の形の写しの本番は curl を呼ばない" || ng "前の形の写しの本番が curl を呼んだ"
SCN=live FAKE_SUB_PLAN=basic run subscribe.sh cancel --subscription sub_x --accepted "$TODAY_JST" --apply --mode live
expect "前の形の写しでも本番の解約は作らない" 3 0 "本番に契約・解約を作らない"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
