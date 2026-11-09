#!/usr/bin/env bash
# docs/billing/subscribe.sh — 顧客 1 社の契約と、毎月末の請求書（README 1C 章の作り方 B）。寺田が実行する。
#
# 既定は dry-run（通信しない・鍵を読まない）。書くのは --apply --mode test|live のときだけ。本番は端末で live と打つ確認がある。
# 読むだけのサブコマンド（find / status）は --mode test|live で通信する（書かない）。simulate は通信しない。
# 鍵・モードの扱いは lib.sh と同じ（鍵は表示しない・引数に載せない、書く前に livemode を確かめる）。
#
# サブコマンド:
#   customer   --code <顧客コード> --name <社名> --email <請求先のメール> --payment card|transfer [--clerk-org <org_…>]
#   find       --code <顧客コード>
#   contract   --customer <cus_…> --service <サービス> --start YYYY-MM-DD --devfee-count <0〜12> [--billing-from YYYY-MM]
#   card-setup --customer <cus_…>
#   cancel     --customer <cus_…> --service <サービス> --accepted <受理日 YYYY-MM-DD>
#   invoice    --customer <cus_…> --month YYYY-MM
#   charge     --customer <cus_…> --month YYYY-MM [--early-test]
#   mark-paid  --customer <cus_…> --month YYYY-MM --paid-on <入金日 YYYY-MM-DD>
#   simulate   --start YYYY-MM-DD --devfee-count <回数> [--end YYYY-MM-DD] [--billing-from YYYY-MM] --months <月数> [--service <サービス>]
#   status     --customer <cus_…>
#   clerk-sync --customer <cus_…>
#   hold       --customer <cus_…> --service <サービス>
#   unhold     --customer <cus_…> --service <サービス>
#   resync
#   set-payment --customer <cus_…> --payment card|transfer
#
# customer   Customer を作る（あれば作らない）。支払い方法を metadata.payment に書く
# contract   契約の開始日と開発費の回数を Customer の metadata（contract_<サービス>_start / _devfee_count）に書く。
#            前からの顧客は --billing-from で、この仕組みで請求を始める月（_bill_from）も書く（それより前の月は請求しない）
# card-setup カードを保存する Checkout のページ（mode=setup）の URL を出す（送るのは寺田）
# cancel     解約の終了日（受理日の 1 か月後の同じ日）を Customer の metadata（contract_<サービス>_end）に書く
# invoice    その月の請求書を作り、確定して送る（明細は lib.sh の billing_lines。支払期限は翌月末日）
# charge     その月の open の請求書を、保存したカードで払う（カードの顧客だけ。期限の日から。
#            --early-test はテストモードだけ期限前でも払う。本番では使えない）
# mark-paid  振込の顧客の、その月の open の請求書を「Stripe の外で支払い済み」にする（paid_out_of_band。引き落とさない）
# simulate   通信せずに、月ごとの明細と合計を出す
# status     契約の metadata、今月と先月の請求書、保存したカード（読むだけ）
# clerk-sync 契約の metadata から services を作り、Clerk の組織（clerk_org_id）の public_metadata.services に送る。
#            Clerk の更新は deep merge なので、契約の無くなったサービスは null にして消す（ADR-0028 の 2 節）。
#            既定は dry-run（顧客を読んで、送る JSON を出すだけ。Clerk の鍵は読まない）。書くのは --apply のとき
# hold       支払いが遅れているサービスを止める（Customer の metadata に contract_<サービス>_hold=true を書き、
#            clerk-sync と同じ形で Clerk の組織の services にも写す。ADR-0028 の決定 1）
# unhold     hold を外す（contract_<サービス>_hold を消し、Clerk の services の hold を false にする）
# resync     全件の送り直し（ADR-0028 の 2 節）。clerk_org_id を持つ全部の顧客の services を Clerk に送り直し、
#            組織の metadata に resync_at（時刻）も書く（Clerk に更新のイベントを起こさせる）。
#            同じ回で hold を判定する: 請求書の支払いの期限の 14 日後を過ぎても open のものがあれば hold を書き、
#            無ければ外す（決定 1）。顧客の一覧と請求書の一覧は 100 件ずつページを送る
# set-payment 支払い方法を card（当社が保存したカードで払う）か transfer（請求書のとおり振り込む）に変える（段階 5）。
#            card へ変えるときは、保存したカードがあることを確かめてから書く。発行済みの請求書は変えない（次の締めから効く）
#
# 終了コード: 0 = 成功 / 2 = plans.json の不合格 / 3 = 既存と食い違い・前提が足りない・モード違い /
#            4 = API・通信のエラー / 64 = 使い方・入力の誤り
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
# shellcheck disable=SC1091 # lib.sh は同じディレクトリにあり、-x 無しで走らせても中身は要らない（source= の指示だけでは SC1091 は消えない）
. "$SCRIPT_DIR/lib.sh"
PLANS="$SCRIPT_DIR/plans.json"
DO_APPLY=0
CMD=""
OPT_CODE=""
OPT_NAME=""
OPT_EMAIL=""
OPT_CLERK=""
OPT_PAYMENT=""
OPT_CUSTOMER=""
OPT_SERVICE=""
OPT_START=""
OPT_DEVFEE=""
OPT_ACCEPTED=""
OPT_MONTH=""
OPT_END=""
OPT_MONTHS=""
OPT_BILL_FROM=""
OPT_PAID_ON=""
TRANSFER_FOOTER=""
OPT_EARLY=0
CANCEL_END_DATE=""
DUE_DATE=""
DUE_EPOCH=""
CUST_JSON=""
INV_JSON=""
LINES=""
LINES_TOTAL=0
LINES_N=0
CARD_PM=""
CARD_SRC=""
CS_STATUS=""
CS_URL=""

usage() {
  sed -n '8,47p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'EOF'
共通: [--plans <path>] [--mode test|live] [--apply]
例:   bash docs/billing/subscribe.sh simulate --start 2026-11-15 --devfee-count 12 --end 2027-04-05 --months 6
      bash docs/billing/subscribe.sh invoice --customer cus_XXXX --month 2026-11                  （dry-run）
      bash docs/billing/subscribe.sh invoice --customer cus_XXXX --month 2026-11 --apply --mode test
EOF
}

set_opt() {
  case "$1" in
    --mode) MODE="$2" ;;
    --plans) PLANS="$2" ;;
    --code) OPT_CODE="$2" ;;
    --name) OPT_NAME="$2" ;;
    --email) OPT_EMAIL="$2" ;;
    --clerk-org) OPT_CLERK="$2" ;;
    --payment) OPT_PAYMENT="$2" ;;
    --customer) OPT_CUSTOMER="$2" ;;
    --service) OPT_SERVICE="$2" ;;
    --start) OPT_START="$2" ;;
    --devfee-count) OPT_DEVFEE="$2" ;;
    --accepted) OPT_ACCEPTED="$2" ;;
    --month) OPT_MONTH="$2" ;;
    --end) OPT_END="$2" ;;
    --months) OPT_MONTHS="$2" ;;
    --billing-from) OPT_BILL_FROM="$2" ;;
    --paid-on) OPT_PAID_ON="$2" ;;
  esac
}

parse_args() {
  [ $# -ge 1 ] || { usage >&2; die 64 "サブコマンドが要る"; }
  CMD="$1"
  shift
  case "$CMD" in
    customer | find | contract | card-setup | cancel | invoice | charge | mark-paid | simulate | status | clerk-sync | hold | unhold | resync | set-payment) ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die 64 "知らないサブコマンド: $CMD" ;;
  esac
  while [ $# -gt 0 ]; do
    case "$1" in
      --apply) DO_APPLY=1 ;;
      --early-test) OPT_EARLY=1 ;;
      --mode | --plans | --code | --name | --email | --clerk-org | --payment | --customer | --service | --start | --devfee-count | --accepted | --month | --end | --months | --billing-from | --paid-on)
        [ $# -ge 2 ] || die 64 "$1 に値が無い"
        set_opt "$1" "$2"
        shift
        ;;
      *) usage >&2; die 64 "知らない引数: $1" ;;
    esac
    shift
  done
}

need() {
  [ -n "$2" ] || die 64 "$CMD には $1 が要る"
}

# 引数は、決まったサブコマンドでだけ使う（打ち間違いで別の意味に取らないため）。
scope() {
  [ -n "$2" ] || return 0
  case " $3 " in *" $CMD "*) ;; *) die 64 "$1 は $3 でだけ使う" ;; esac
}

one_line() {
  # 1 行・空でない・上限以下
  local label="$1" value="$2" max="$3"
  [ -n "$value" ] || die 64 "$label が空"
  [[ "$value" != *$'\n'* && "$value" != *$'\t'* ]] || die 64 "$label に改行かタブが入っている"
  [ "${#value}" -le "$max" ] || die 64 "$label が $max 文字を超える（観測: ${#value} 文字）"
}

check_service() {
  plans_services | grep -qxF -- "$OPT_SERVICE" || die 64 "--service は $(plans_services | paste -sd'|' -) のどれか（観測: ${OPT_SERVICE}）"
}

check_date() {
  [[ "$2" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die 64 "$1 は YYYY-MM-DD（観測: $2）"
  valid_date "$2" || die 64 "$1 が実在する日付ではない（観測: $2）"
}

check_month() {
  [[ "$OPT_MONTH" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || die 64 "--month は YYYY-MM（観測: ${OPT_MONTH}）"
  DUE_DATE="$(due_date_of_month "$OPT_MONTH")"
  DUE_EPOCH="$(jst_day_end_epoch "$DUE_DATE")"
}

# この仕組みで請求を始める月（前からの顧客）。開始日の月より前にはしない。
check_bill_from() {
  [ -n "$OPT_BILL_FROM" ] || return 0
  [[ "$OPT_BILL_FROM" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || die 64 "--billing-from は YYYY-MM（観測: ${OPT_BILL_FROM}）"
  [[ ! "$OPT_BILL_FROM" < "${OPT_START:0:7}" ]] || die 64 "--billing-from が開始日の月より前（観測: $OPT_BILL_FROM < ${OPT_START:0:7}）"
}

# 回数・月数は 0 で始めない整数（bash の算術は 012 を 8 進数と読むため）。
is_count() {
  [[ "$1" =~ ^(0|[1-9][0-9]*)$ ]]
}

check_devfee_count() {
  load_amounts "$OPT_SERVICE"
  is_count "$OPT_DEVFEE" && [ "$OPT_DEVFEE" -le "$DEVFEE_MAX" ] \
    || die 64 "--devfee-count は 0〜${DEVFEE_MAX}（plans.json の installments。観測: ${OPT_DEVFEE}）"
}

# 受理日は今日か過去の実在する日付。終了日は受理日の notice_months か月後の同じ日。
check_accepted() {
  local today
  check_date --accepted "$OPT_ACCEPTED"
  today="$(today_jst)"
  [[ ! "$OPT_ACCEPTED" > "$today" ]] || die 64 "--accepted に未来の日付は使わない（受理した日を入れる。観測: ${OPT_ACCEPTED}、今日: ${today}）"
  CANCEL_END_DATE="$(cancel_end_date "$OPT_ACCEPTED")"
}

# 請求書を作れるのは先月の分と、締めの日（月の末日、日本時間）からの今月の分だけ（月末締め）。
check_invoice_month() {
  local today this last end
  today="$(today_jst)"
  this="${today:0:7}"
  last="$(ym_add "$this" -1)"
  [[ ! "$OPT_MONTH" > "$this" ]] || die 64 "--month に未来の月は使わない（観測: ${OPT_MONTH}、今月: ${this}）"
  [[ ! "$OPT_MONTH" < "$last" ]] || die 64 "--month は今月か先月（${last}）だけ（観測: ${OPT_MONTH}）。それより前の月は寺田が判断"
  if [ "$OPT_MONTH" = "$this" ]; then
    end="$(month_last_date "$this")"
    [ "$today" = "$end" ] || die 64 "今月（${this}）の分は、締めの日（${end}）から作る（月末締め。今日: ${today}）"
  fi
}

# 振込の入金日は、今日か過去の実在する日付。
check_paid_on() {
  local today
  check_date --paid-on "$OPT_PAID_ON"
  today="$(today_jst)"
  [[ ! "$OPT_PAID_ON" > "$today" ]] || die 64 "--paid-on に未来の日付は使わない（入金を確かめた日を入れる。観測: ${OPT_PAID_ON}、今日: ${today}）"
}

# 保存したカードで払うのは、支払期限の日（翌月末日、日本時間）から。
# --early-test はテストモードだけ期限前でも払う（runbook の T を今日通すため。寺田 2026-11-07）。本番では受け付けない。
check_charge_day() {
  local today
  if [ "$OPT_EARLY" -eq 1 ]; then
    [ "$MODE" = "test" ] || die 64 "--early-test はテストモードだけ（--mode test と一緒に使う。本番では期限前に払わない。観測 --mode ${MODE:-なし}）"
    printf 'NOTE --early-test: テストモードなので、支払期限 %s より前でも払う\n' "$DUE_DATE"
    return 0
  fi
  today="$(today_jst)"
  [[ ! "$today" < "$DUE_DATE" ]] || die 64 "$OPT_MONTH 分の支払期限は ${DUE_DATE}。期限の日より前は払わない（今日: ${today}）"
}

check_simulate() {
  need --months "$OPT_MONTHS"
  [ -n "$OPT_SERVICE" ] || OPT_SERVICE="$(plans_services | head -1)"
  check_service
  check_date --start "$OPT_START"
  check_devfee_count
  if [ -n "$OPT_END" ]; then
    check_date --end "$OPT_END"
    [[ ! "$OPT_END" < "$OPT_START" ]] || die 64 "--end が --start より前（観測: $OPT_END < ${OPT_START}）"
  fi
  check_bill_from
  is_count "$OPT_MONTHS" && [ "$OPT_MONTHS" -ge 1 ] && [ "$OPT_MONTHS" -le 36 ] || die 64 "--months は 1〜36（観測: ${OPT_MONTHS}）"
  [ "$DO_APPLY" -eq 0 ] && [ -z "$MODE" ] || die 64 "simulate は通信しない（--apply と --mode は使わない）"
}

validate_command() {
  case "$CMD" in
    customer)
      need --code "$OPT_CODE"; need --name "$OPT_NAME"; need --email "$OPT_EMAIL"; need --payment "$OPT_PAYMENT"
      one_line --name "$OPT_NAME" 256
      [[ "$OPT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] && [ "${#OPT_EMAIL}" -le 512 ] \
        || die 64 "--email の形が違う（観測: ${OPT_EMAIL}）"
      case "$OPT_PAYMENT" in card | transfer) ;; *) die 64 "--payment は card か transfer（観測: ${OPT_PAYMENT}）" ;; esac ;;
    find) need --code "$OPT_CODE" ;;
    contract)
      need --customer "$OPT_CUSTOMER"; need --service "$OPT_SERVICE"; need --start "$OPT_START"; need --devfee-count "$OPT_DEVFEE"
      check_service; check_date --start "$OPT_START"; check_devfee_count; check_bill_from ;;
    card-setup | status | clerk-sync) need --customer "$OPT_CUSTOMER" ;;
    hold | unhold) need --customer "$OPT_CUSTOMER"; need --service "$OPT_SERVICE"; check_service ;;
    resync) ;;
    set-payment)
      need --customer "$OPT_CUSTOMER"; need --payment "$OPT_PAYMENT"
      case "$OPT_PAYMENT" in card | transfer) ;; *) die 64 "--payment は card か transfer（観測: $OPT_PAYMENT）" ;; esac ;;
    cancel)
      need --customer "$OPT_CUSTOMER"; need --service "$OPT_SERVICE"; need --accepted "$OPT_ACCEPTED"
      check_service; check_accepted ;;
    invoice) need --customer "$OPT_CUSTOMER"; need --month "$OPT_MONTH"; check_month; check_invoice_month ;;
    charge) need --customer "$OPT_CUSTOMER"; need --month "$OPT_MONTH"; check_month; check_charge_day ;;
    mark-paid) need --customer "$OPT_CUSTOMER"; need --month "$OPT_MONTH"; need --paid-on "$OPT_PAID_ON"; check_month; check_paid_on ;;
    simulate) need --start "$OPT_START"; need --devfee-count "$OPT_DEVFEE"; check_simulate ;;
  esac
}

validate_inputs() {
  case "$MODE" in "" | test | live) ;; *) die 64 "--mode は test か live（観測: ${MODE}）" ;; esac
  if [ "$DO_APPLY" -eq 1 ] && [ -z "$MODE" ]; then die 64 "--apply には --mode test か --mode live が要る"; fi
  scope --code "$OPT_CODE" "customer find"
  scope --name "$OPT_NAME" "customer"
  scope --email "$OPT_EMAIL" "customer"
  scope --clerk-org "$OPT_CLERK" "customer"
  scope --payment "$OPT_PAYMENT" "customer set-payment"
  scope --customer "$OPT_CUSTOMER" "contract card-setup cancel invoice charge mark-paid status clerk-sync hold unhold set-payment"
  scope --service "$OPT_SERVICE" "contract cancel simulate hold unhold"
  scope --start "$OPT_START" "contract simulate"
  scope --devfee-count "$OPT_DEVFEE" "contract simulate"
  scope --accepted "$OPT_ACCEPTED" "cancel"
  scope --month "$OPT_MONTH" "invoice charge mark-paid"
  scope --paid-on "$OPT_PAID_ON" "mark-paid"
  scope --end "$OPT_END" "simulate"
  scope --months "$OPT_MONTHS" "simulate"
  scope --billing-from "$OPT_BILL_FROM" "contract simulate"
  if [ "$OPT_EARLY" -eq 1 ]; then scope --early-test 1 "charge"; fi
  validate_command
  if [ -n "$OPT_CODE" ]; then
    [[ "$OPT_CODE" =~ ^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$ ]] || die 64 "--code は英小文字・数字・ハイフン（40 文字まで。観測: ${OPT_CODE}）"
  fi
  if [ -n "$OPT_CUSTOMER" ]; then
    [[ "$OPT_CUSTOMER" =~ ^cus_[A-Za-z0-9]+$ ]] || die 64 "--customer は cus_ で始まる id（観測: ${OPT_CUSTOMER}）"
  fi
  if [ -n "$OPT_CLERK" ]; then
    [[ "$OPT_CLERK" =~ ^[A-Za-z0-9_]{1,64}$ ]] || die 64 "--clerk-org は英数字と下線（64 文字まで。観測: ${OPT_CLERK}）"
  fi
  case "$CMD" in
    find | status) [ -n "$MODE" ] || die 64 "$CMD は読むだけ。--mode test か --mode live が要る（--apply は要らない）" ;;
    clerk-sync) [ -n "$MODE" ] || die 64 "clerk-sync は送る JSON を作るために顧客を読む。--mode test か --mode live が要る（書くのは --apply のとき）" ;;
  esac
}

print_plan() {
  local s="$OPT_SERVICE"
  # shellcheck disable=SC2153 # AMT_DEVFEE は lib.sh の load_amounts が設定する（代入が別のファイルにある）
  case "$CMD" in
    customer) printf 'PLAN customer: GET /v1/customers/search で customer_code=%s を探し、無ければ POST /v1/customers（name=%s、email=%s、metadata[customer_code]=%s、metadata[payment]=%s、metadata[clerk_org_id]=%s）\n' \
      "$OPT_CODE" "$OPT_NAME" "$OPT_EMAIL" "$OPT_CODE" "$OPT_PAYMENT" "${OPT_CLERK:-（なし）}" ;;
    find) printf 'PLAN find: GET /v1/customers/search で customer_code=%s を探す（読むだけ）\n' "$OPT_CODE" ;;
    contract) printf 'PLAN contract: %s の metadata に contract_%s_start=%s、contract_%s_devfee_count=%s、contract_%s_bill_from=%s を書く（違う値が既にあれば書き換えない）。開発費は税別 %s 円 × %s 回。bill_from より前の月は請求しない\n' \
      "$OPT_CUSTOMER" "$s" "$OPT_START" "$s" "$OPT_DEVFEE" "$s" "${OPT_BILL_FROM:-（なし）}" "$AMT_DEVFEE" "$OPT_DEVFEE" ;;
    card-setup) printf 'PLAN card-setup: %s のカードを保存する Checkout のページ（mode=setup、currency=jpy、success_url=https://cor-jp.com/）を作り、URL を出す。session の id を metadata[card_setup_session] に書く。カードが保存済みか、開いているページがあれば作らない\n' "$OPT_CUSTOMER" ;;
    cancel) printf 'PLAN cancel: %s の %s の終了日 = 受理日 %s の %s か月後の同じ日 = %s を metadata[contract_%s_end] に書く。%s 分の請求書に、終了日までの日割りと、最低利用期間の中なら残りの期間分の利用料と開発費の残りが入る（返金はしない）\n' \
      "$OPT_CUSTOMER" "$s" "$OPT_ACCEPTED" "$(jq -r '.cancellation.notice_months' "$PLANS")" "$CANCEL_END_DATE" "$s" "${CANCEL_END_DATE:0:7}" ;;
    invoice) printf 'PLAN invoice: %s の %s 分の請求書（send_invoice、支払期限 %s 23:59:59 JST = due_date %s）。明細は Customer の metadata の契約から計算する。同じ月の請求書があれば作らない。draft → 明細 → 小計の照合 → finalize → send\n' \
      "$OPT_CUSTOMER" "$OPT_MONTH" "$DUE_DATE" "$DUE_EPOCH" ;;
    mark-paid) printf 'PLAN mark-paid: %s の %s 分の open の請求書を、入金日 %s で「Stripe の外で支払い済み」にする（POST /v1/invoices/{id}/pay、paid_out_of_band=true。引き落とさない）。振込の顧客（metadata.payment=transfer）だけ\n' \
      "$OPT_CUSTOMER" "$OPT_MONTH" "$OPT_PAID_ON" ;;
    charge) printf 'PLAN charge: %s の %s 分の open の請求書を、保存したカードで払う（POST /v1/invoices/{id}/pay。支払期限 %s）。カードの顧客（metadata.payment=card）だけ\n' \
      "$OPT_CUSTOMER" "$OPT_MONTH" "$DUE_DATE" ;;
    status) printf 'PLAN status: %s の契約の metadata、今月と先月の請求書、保存したカードを読む（読むだけ）\n' "$OPT_CUSTOMER" ;;
    clerk-sync) printf 'PLAN clerk-sync: %s の clerk_org_id の組織に、契約の metadata から作った services を PATCH で送る（deep merge。契約の無いサービスは null で消す）。dry-run は顧客を読むだけで、Clerk の鍵は読まない\n' "$OPT_CUSTOMER" ;;
    hold) printf 'PLAN hold: %s の %s を止める（metadata[contract_%s_hold]=true を書き、Clerk の組織の services の hold も true にする）。書き込みを止め、閲覧は残る（決定 1）\n' "$OPT_CUSTOMER" "$s" "$s" ;;
    unhold) printf 'PLAN unhold: %s の %s の hold を外す（metadata[contract_%s_hold] を消し、Clerk の組織の services の hold を false にする）\n' "$OPT_CUSTOMER" "$s" "$s" ;;
    resync) printf 'PLAN resync: clerk_org_id を持つ全部の顧客の services を Clerk に送り直し、resync_at を書く（plans.json に無いサービスは各組織の metadata から消える。顧客ごとの本文は送る前に出す）。同じ回で、請求書の支払いの期限の 14 日後を過ぎても open のものから hold を決めて書き直す（決定 1）\n' ;;
    set-payment) printf 'PLAN set-payment: %s の支払い方法を %s にする（metadata[payment]=%s）。card へ変えるときは保存したカードがあることを確かめる。発行済みの請求書は変えない（次の締めから効く）\n' "$OPT_CUSTOMER" "$OPT_PAYMENT" "$OPT_PAYMENT" ;;
  esac
}

do_find() {
  api_ok "顧客の検索" GET /v1/customers/search --data-urlencode "query=metadata['customer_code']:'$OPT_CODE'" --data-urlencode "limit=10"
  jq -r '.data[] | "FOUND \(.id) customer_code=\(.metadata.customer_code) name=\(.name) payment=\(.metadata.payment // "-")"' <<<"$RESP_BODY"
  printf 'DONE find: %s 件（作った直後は検索に出るまで最大 1 分ほどかかる）\n' "$(jq '.data | length' <<<"$RESP_BODY")"
}

existing_customer_ok() {
  local id clerk pay
  id="$(jq -r '.data[0].id' <<<"$RESP_BODY")"
  clerk="$(jq -r '.data[0].metadata.clerk_org_id // empty' <<<"$RESP_BODY")"
  pay="$(jq -r '.data[0].metadata.payment // empty' <<<"$RESP_BODY")"
  if [ -n "$OPT_CLERK" ] && [ -n "$clerk" ] && [ "$clerk" != "$OPT_CLERK" ]; then
    die 3 "顧客 ${id}（customer_code=${OPT_CODE}）の clerk_org_id が違う（期待 ${OPT_CLERK}、観測 ${clerk}）。書き換えない"
  fi
  if [ -n "$pay" ] && [ "$pay" != "$OPT_PAYMENT" ]; then
    die 3 "顧客 ${id}（customer_code=${OPT_CODE}）の payment が違う（期待 ${OPT_PAYMENT}、観測 ${pay}）。書き換えない（寺田が判断）"
  fi
  printf 'OK customer %s: customer_code=%s は既にある（作らない）\n' "$id" "$OPT_CODE"
  if [ -n "$OPT_CLERK" ] && [ -z "$clerk" ]; then
    printf 'NOTE 既存の顧客 %s に clerk_org_id が無い。このスクリプトは既存を書き換えない（付けるかは寺田）\n' "$id"
  fi
  if [ -z "$pay" ]; then
    printf 'NOTE 既存の顧客 %s に payment が無い。charge は payment=card の顧客だけを払う。付けるかは寺田（画面。文言は未確認）\n' "$id"
  fi
}

do_customer() {
  local n
  local -a clerk_meta=()
  api_ok "顧客の検索" GET /v1/customers/search --data-urlencode "query=metadata['customer_code']:'$OPT_CODE'" --data-urlencode "limit=10"
  n="$(jq '.data | length' <<<"$RESP_BODY")"
  [ "$n" -le 1 ] || die 3 "customer_code=$OPT_CODE の顧客が $n 件ある: $(jq -r '[.data[].id] | join(", ")' <<<"$RESP_BODY")（1 件のはず）"
  if [ "$n" -eq 1 ]; then
    existing_customer_ok
    return 0
  fi
  if [ -n "$OPT_CLERK" ]; then clerk_meta=(--data-urlencode "metadata[clerk_org_id]=$OPT_CLERK"); fi
  api_ok "顧客の作成 POST /v1/customers" POST /v1/customers \
    --data-urlencode "name=$OPT_NAME" \
    --data-urlencode "email=$OPT_EMAIL" \
    --data-urlencode "metadata[customer_code]=$OPT_CODE" \
    --data-urlencode "metadata[payment]=$OPT_PAYMENT" \
    --data-urlencode "metadata[managed_by]=$MANAGED_BY" \
    ${clerk_meta[@]+"${clerk_meta[@]}"}
  check_replay "顧客の作成" "/v1/customers/$(jq -r '.id' <<<"$RESP_BODY")" '(.deleted // false) == false' '{id, deleted}'
  printf 'CREATED customer %s（customer_code=%s、payment=%s、clerk_org_id=%s）\n' "$(jq -r '.id' <<<"$RESP_BODY")" "$OPT_CODE" "$OPT_PAYMENT" "${OPT_CLERK:-なし}"
}

# Customer を読み、CUST_JSON に入れる。subscribe.sh customer で作った顧客（metadata.customer_code がある）だけを使う。
load_customer() {
  api_ok "顧客 $OPT_CUSTOMER の読取" GET "/v1/customers/$OPT_CUSTOMER"
  CUST_JSON="$RESP_BODY"
  [ "$(jq -r '.deleted // false' <<<"$CUST_JSON")" != "true" ] || die 3 "顧客 $OPT_CUSTOMER は削除されている"
  [ -n "$(cust_meta customer_code)" ] || die 3 "顧客 $OPT_CUSTOMER に metadata.customer_code が無い（subscribe.sh customer で作った顧客を使う）"
}

cust_meta() {
  jq -r --arg k "$1" '.metadata[$k] // empty' <<<"$CUST_JSON"
}

# metadata を書き、書けたことを応答で確かめる。put_meta <説明> <確かめる条件（jq）> <metadata[k]=v ...>
put_meta() {
  local what="$1" cond="$2" kv
  shift 2
  local -a args=()
  for kv in "$@"; do args+=(--data-urlencode "metadata[${kv%%=*}]=${kv#*=}"); done
  api_ok "$what POST /v1/customers/$OPT_CUSTOMER" POST "/v1/customers/$OPT_CUSTOMER" "${args[@]}"
  check_replay "$what" "/v1/customers/$OPT_CUSTOMER" "$cond" '{id, metadata}'
  jq -e "$cond" <<<"$RESP_BODY" >/dev/null || die 3 "$what: 応答の metadata が期待と違う（観測: $(jq -c '.metadata' <<<"$RESP_BODY")）"
}

do_contract() {
  local ks="contract_${OPT_SERVICE}_start" kc="contract_${OPT_SERVICE}_devfee_count" kb="contract_${OPT_SERVICE}_bill_from" cur_s cur_c cur_b cond
  [ "${#kc}" -le 40 ] && [ "${#kb}" -le 40 ] || die 64 "metadata の名前 $kc か $kb が 40 文字を超える（サービス名を短くする）"
  load_customer
  cur_s="$(cust_meta "$ks")"
  cur_c="$(cust_meta "$kc")"
  cur_b="$(cust_meta "$kb")"
  if [ "$cur_s" = "$OPT_START" ] && [ "$cur_c" = "$OPT_DEVFEE" ] && [ "$cur_b" = "$OPT_BILL_FROM" ]; then
    printf 'OK contract %s %s: 既に start=%s devfee_count=%s bill_from=%s（書かない）\n' "$OPT_CUSTOMER" "$OPT_SERVICE" "$cur_s" "$cur_c" "${cur_b:-なし}"
    return 0
  fi
  [ -z "$cur_s" ] || [ "$cur_s" = "$OPT_START" ] || die 3 "$OPT_CUSTOMER の $ks が違う（期待 ${OPT_START}、観測 ${cur_s}）。書き換えない（寺田が判断）"
  [ -z "$cur_c" ] || [ "$cur_c" = "$OPT_DEVFEE" ] || die 3 "$OPT_CUSTOMER の $kc が違う（期待 ${OPT_DEVFEE}、観測 ${cur_c}）。書き換えない（寺田が判断）"
  # 請求を始める月は、一度書いたら変えない。既に契約があって bill_from が無い顧客に、あとから足すこともしない（二重請求の元になる）
  [ "$cur_b" = "$OPT_BILL_FROM" ] || [ -z "$cur_s" ] || die 3 "$OPT_CUSTOMER の $kb が違う（期待 ${OPT_BILL_FROM:-なし}、観測 ${cur_b:-なし}）。書き換えない（寺田が判断）"
  cond=".metadata[\"$ks\"] == \"$OPT_START\" and .metadata[\"$kc\"] == \"$OPT_DEVFEE\""
  local -a kv=("$ks=$OPT_START" "$kc=$OPT_DEVFEE")
  if [ -n "$OPT_BILL_FROM" ]; then
    cond="$cond and .metadata[\"$kb\"] == \"$OPT_BILL_FROM\""
    kv+=("$kb=$OPT_BILL_FROM")
  fi
  put_meta "契約を書く" "$cond" "${kv[@]}"
  printf 'CONTRACT %s %s: start=%s devfee_count=%s bill_from=%s\n' "$OPT_CUSTOMER" "$OPT_SERVICE" "$OPT_START" "$OPT_DEVFEE" "${OPT_BILL_FROM:-なし}"
}

# 保存したカードを探す（subshell にしないで呼ぶ）。CARD_PM・CARD_SRC と、card-setup の session の CS_STATUS・CS_URL を決める。
# 順: Customer の invoice_settings.default_payment_method → metadata.card_setup_session の session（complete なら
# session の setup_intent → SetupIntent の payment_method）。
find_saved_card() {
  local cs seti
  CARD_PM="$(jq -r '.invoice_settings.default_payment_method // empty | if type == "object" then .id else . end' <<<"$CUST_JSON")"
  CARD_SRC="invoice_settings.default_payment_method"
  CS_STATUS=""
  CS_URL=""
  [ -z "$CARD_PM" ] || return 0
  CARD_SRC=""
  cs="$(cust_meta card_setup_session)"
  [ -n "$cs" ] || return 0
  [[ "$cs" =~ ^cs_[A-Za-z0-9_]+$ ]] || die 3 "metadata.card_setup_session の形が違う（観測: ${cs}）"
  api_ok "カードの保存のページの読取" GET "/v1/checkout/sessions/$cs"
  CS_STATUS="$(jq -r '.status // "-"' <<<"$RESP_BODY")"
  CS_URL="$(jq -r '.url // empty' <<<"$RESP_BODY")"
  [ "$CS_STATUS" = "complete" ] || return 0
  seti="$(jq -r '.setup_intent // empty | if type == "object" then .id else . end' <<<"$RESP_BODY")"
  [[ "$seti" =~ ^seti_[A-Za-z0-9_]+$ ]] || die 3 "session $cs の setup_intent を読めない（観測: ${seti:-なし}）"
  api_ok "SetupIntent の読取" GET "/v1/setup_intents/$seti"
  CARD_PM="$(jq -r '.payment_method // empty | if type == "object" then .id else . end' <<<"$RESP_BODY")"
  if [ -n "$CARD_PM" ]; then CARD_SRC="card-setup（$cs → ${seti}）"; fi
}

do_card_setup() {
  local id url
  load_customer
  find_saved_card
  if [ -n "$CARD_PM" ]; then
    printf 'OK card-setup %s: カードは保存済み（%s、%s）。作らない\n' "$OPT_CUSTOMER" "$CARD_PM" "$CARD_SRC"
    return 0
  fi
  if [ "$CS_STATUS" = "open" ] && [ -n "$CS_URL" ]; then
    printf 'OK card-setup %s: 開いているページがある（作らない）\nSETUP_URL %s\n' "$OPT_CUSTOMER" "$CS_URL"
    return 0
  fi
  api_ok "カードの保存のページの作成 POST /v1/checkout/sessions" POST /v1/checkout/sessions \
    --data-urlencode "mode=setup" --data-urlencode "currency=jpy" --data-urlencode "customer=$OPT_CUSTOMER" \
    --data-urlencode "success_url=https://cor-jp.com/" \
    --data-urlencode "metadata[customer_code]=$(cust_meta customer_code)" --data-urlencode "metadata[managed_by]=$MANAGED_BY"
  id="$(jq -r '.id' <<<"$RESP_BODY")"
  check_replay "カードの保存のページの作成" "/v1/checkout/sessions/$id" '.status | IN("open", "complete")' '{id, status}'
  url="$(jq -r '.url // empty' <<<"$RESP_BODY")"
  [ -n "$url" ] || die 3 "session $id に URL が無い（観測 status=$(jq -r '.status // "-"' <<<"$RESP_BODY")）"
  printf 'CREATED card-setup %s（期限 %s）\n' "$id" "$(fmt_jst "$(jq -r '.expires_at // "-"' <<<"$RESP_BODY")")"
  put_meta "session の id を書く" ".metadata.card_setup_session == \"$id\"" "card_setup_session=$id"
  printf 'SETUP_URL %s\n' "$url"
  printf 'NOTE この URL を顧客へ送る（送信は寺田）。カードを入れ終わると、charge がそのカードで払う\n'
}

# その月の当社の請求書を探し、INV_JSON に入れる（無ければ空）。2 件以上なら止まる。
# 検索（metadata）は反映に最大 1 分（障害時 1 時間）かかるので、一覧（customer で絞り、metadata は手元で見る）でも探す。
find_month_invoice() {
  local ym="$1" a b n
  # shellcheck disable=SC2016 # jq のプログラム。$ は jq の変数で、シェルが展開しないのが正しい
  local filter='[.data[] | select(.metadata.billing_month == $m and .metadata.managed_by == $mb)]'
  api_ok "請求書の検索" GET /v1/invoices/search \
    --data-urlencode "query=customer:\"$OPT_CUSTOMER\" AND metadata[\"billing_month\"]:\"$ym\"" --data-urlencode "limit=10"
  a="$(jq -c --arg m "$ym" --arg mb "$MANAGED_BY" "$filter" <<<"$RESP_BODY")"
  api_ok "請求書の一覧" GET /v1/invoices --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "limit=100"
  b="$(jq -c --arg m "$ym" --arg mb "$MANAGED_BY" "$filter" <<<"$RESP_BODY")"
  INV_JSON="$(jq -cn --argjson a "$a" --argjson b "$b" '$a + $b | unique_by(.id)')"
  n="$(jq 'length' <<<"$INV_JSON")"
  [ "$n" -le 1 ] || die 3 "$ym 分の請求書が $n 件ある: $(jq -r 'map("\(.id)(\(.status))") | join(" ")' <<<"$INV_JSON")（1 件のはず。寺田が判断）"
  INV_JSON="$(jq -c '.[0] // empty' <<<"$INV_JSON")"
}

# 契約のある全サービスの、その月の明細を LINES（サービス 種類 金額 初日 末日 説明）・LINES_TOTAL・LINES_N に入れる。
invoice_lines() {
  local ym="$1" s start count end bf out l contracts=0
  LINES=""
  LINES_TOTAL=0
  LINES_N=0
  while IFS= read -r s; do
    start="$(cust_meta "contract_${s}_start")"
    [ -n "$start" ] || continue
    count="$(cust_meta "contract_${s}_devfee_count")"
    end="$(cust_meta "contract_${s}_end")"
    bf="$(cust_meta "contract_${s}_bill_from")"
    contracts=$((contracts + 1))
    load_amounts "$s"
    valid_date "$start" || die 3 "contract_${s}_start が実在する日付ではない（観測: ${start}）"
    is_count "$count" && [ "$count" -le "$DEVFEE_MAX" ] || die 3 "contract_${s}_devfee_count が 0〜$DEVFEE_MAX でない（観測: ${count:-なし}）"
    [ -z "$end" ] || valid_date "$end" || die 3 "contract_${s}_end が実在する日付ではない（観測: ${end}）"
    if [ -n "$bf" ]; then
      [[ "$bf" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || die 3 "contract_${s}_bill_from が YYYY-MM でない（観測: ${bf}）"
      # 前からの顧客: bill_from より前の月は請求書払いで請求済み。二重に請求しないよう、その月の請求書は作らない
      [[ ! "$ym" < "$bf" ]] || die 3 "$OPT_CUSTOMER の $s は $bf より前を請求しない（contract_${s}_bill_from=${bf}、観測 --month ${ym}）。その月はほかの方法で請求済み。何も作っていない"
    fi
    out="$(billing_lines "$s" "$start" "$count" "$end" "$ym" "$bf")"
    while IFS= read -r l; do
      [ -n "$l" ] || continue
      LINES="$LINES$s"$'\t'"$l"$'\n'
      LINES_N=$((LINES_N + 1))
      LINES_TOTAL=$((LINES_TOTAL + $(printf '%s' "$l" | cut -f2)))
    done <<<"$out"
  done < <(plans_services)
  [ "$contracts" -ge 1 ] || die 3 "$OPT_CUSTOMER に契約が無い（metadata に contract_<サービス>_start が無い。contract を先に）"
}

print_lines() {
  local s kind amount ps pe desc
  while IFS=$'\t' read -r s kind amount ps pe desc; do
    [ -n "$kind" ] || continue
    printf 'LINE %s %s %s %s %s〜%s %s\n' "$1" "$s" "$kind" "$amount" "$ps" "$pe" "$desc"
  done <<<"$LINES"
  printf 'TOTAL %s %s 円（税別、明細 %s 行）\n' "$1" "$LINES_TOTAL" "$LINES_N"
}

create_draft() {
  api_ok "請求書の作成 POST /v1/invoices" POST /v1/invoices \
    --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "currency=$(jq -r '.currency' "$PLANS")" \
    --data-urlencode "collection_method=send_invoice" --data-urlencode "due_date=$DUE_EPOCH" \
    --data-urlencode "auto_advance=false" --data-urlencode "pending_invoice_items_behavior=exclude" \
    --data-urlencode "metadata[billing_month]=$OPT_MONTH" --data-urlencode "metadata[customer_code]=$(cust_meta customer_code)" \
    --data-urlencode "metadata[managed_by]=$MANAGED_BY" \
    ${TRANSFER_FOOTER:+--data-urlencode "footer=$TRANSFER_FOOTER"}
  check_replay "請求書の作成" "/v1/invoices/$(jq -r '.id' <<<"$RESP_BODY")" '.status == "draft"' '{id, status}'
  INV_JSON="$RESP_BODY"
  printf 'CREATED invoice %s（draft、%s 分）\n' "$(jq -r '.id' <<<"$INV_JSON")" "$OPT_MONTH"
}

add_items() {
  local inv="$1" txr="$2" s kind amount ps pe desc
  while IFS=$'\t' read -r s kind amount ps pe desc; do
    [ -n "$kind" ] || continue
    api_ok "明細の追加 POST /v1/invoiceitems（$s ${kind}）" POST /v1/invoiceitems \
      --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "invoice=$inv" \
      --data-urlencode "amount=$amount" --data-urlencode "currency=$(jq -r '.currency' "$PLANS")" \
      --data-urlencode "description=$desc" --data-urlencode "tax_rates[0]=$txr" \
      --data-urlencode "period[start]=$(jst_midnight_epoch "$ps")" --data-urlencode "period[end]=$(jst_day_end_epoch "$pe")" \
      --data-urlencode "metadata[service]=$s" --data-urlencode "metadata[kind]=$kind" \
      --data-urlencode "metadata[billing_month]=$OPT_MONTH" --data-urlencode "metadata[managed_by]=$MANAGED_BY"
    check_replay "明細の追加" "/v1/invoiceitems/$(jq -r '.id' <<<"$RESP_BODY")" ".invoice == \"$inv\"" '{id, invoice}'
    printf 'ADDED %s %s %s 円（税別）\n' "$s" "$kind" "$amount"
  done <<<"$LINES"
}

# 小計（税別）と明細の数を計算値と照らしてから、確定して送る。違えば確定しない。
finish_invoice() {
  local inv="$1" sub n
  api_ok "請求書の読取" GET "/v1/invoices/$inv"
  sub="$(jq -r '.subtotal // "-"' <<<"$RESP_BODY")"
  n="$(jq -r '.lines.total_count // (.lines.data | length)' <<<"$RESP_BODY")"
  [ "$sub" = "$LINES_TOTAL" ] && [ "$n" = "$LINES_N" ] \
    || die 3 "請求書 $inv の小計か明細の数が計算と違う（期待 小計 ${LINES_TOTAL}・$LINES_N 行、観測 小計 ${sub}・$n 行）。確定しない。Stripe の画面で下書きを確かめ、消してからもう一度実行する（画面の文言は未確認）"
  printf 'CHECK ok: 小計 %s 円（税別）・明細 %s 行は計算と一致\n' "$sub" "$n"
  api_ok "請求書の確定 POST /v1/invoices/$inv/finalize" POST "/v1/invoices/$inv/finalize"
  check_replay "請求書の確定" "/v1/invoices/$inv" '.status | IN("open", "paid")' '{id, status}'
  [ "$(jq -r '.status' <<<"$RESP_BODY")" = "open" ] || die 3 "確定した請求書 $inv が open でない（観測 status=$(jq -r '.status' <<<"$RESP_BODY")）"
  send_invoice "$inv"
  printf 'INVOICE %s %s: status=%s 税込 %s 円（うち消費税 %s 円）支払期限 %s\n' "$inv" "$OPT_MONTH" "$(jq -r '.status' <<<"$RESP_BODY")" \
    "$(jq -r '.total' <<<"$RESP_BODY")" "$(jq -r '[.total_taxes[]?.amount] | add // 0' <<<"$RESP_BODY")" "$(fmt_jst "$(jq -r '.due_date // "-"' <<<"$RESP_BODY")")"
  printf 'INVOICE_URL %s\n' "$(jq -r '.hosted_invoice_url // "（無い）"' <<<"$RESP_BODY")"
}

# 同じ月の請求書があるとき: open / paid は作らない。draft は前回が途中で止まったもの（明細が 0 行なら足し、計算と合えば確定する）。
# 送ったことを Customer の metadata.invoice_sent（「YYYY-MM:in_…」を新しい順に 3 件まで、カンマ区切り）に書く。
# 確定のあと送付が失敗したとき、やり直しで送り直すため（請求書の metadata を確定のあと変えられるかは文書に無い）。
invoice_sent_entry() { printf '%s:%s' "$OPT_MONTH" "$1"; }
was_sent() {
  case ",$(cust_meta invoice_sent)," in *",$(invoice_sent_entry "$1"),"*) return 0 ;; *) return 1 ;; esac
}
send_invoice() {
  local inv="$1" entry list
  api_ok "請求書の送付 POST /v1/invoices/$inv/send" POST "/v1/invoices/$inv/send"
  check_replay "請求書の送付" "/v1/invoices/$inv" '.status | IN("open", "paid")' '{id, status}'
  local sent="$RESP_BODY"
  entry="$(invoice_sent_entry "$inv")"
  list="$(jq -rn --arg cur "$(cust_meta invoice_sent)" --arg e "$entry" '[$e] + ([$cur | split(",")[] | select(. != "" and . != $e)] | .[0:2]) | join(",")')"
  put_meta "送ったことを書く" "(.metadata.invoice_sent // \"\") | split(\",\") | index(\"$entry\") != null" "invoice_sent=$list"
  CUST_JSON="$RESP_BODY"
  RESP_BODY="$sent"
}

resume_invoice() {
  local id status n
  id="$(jq -r '.id' <<<"$INV_JSON")"
  status="$(jq -r '.status' <<<"$INV_JSON")"
  case "$status" in
    open | paid)
      if [ "$status" = "open" ] && ! was_sent "$id"; then
        printf 'NOTE %s 分の請求書 %s は確定済みだが、送った記録が無い（前回は送付の前後で止まった）。送り直す\n' "$OPT_MONTH" "$id"
        confirm_live
        send_invoice "$id"
        printf 'SENT %s %s: 送り直した（status=%s）\n' "$id" "$OPT_MONTH" "$(jq -r '.status' <<<"$RESP_BODY")"
        return 0
      fi
      printf 'OK invoice %s: %s 分の請求書 %s は既にある（status=%s、税込 %s 円）。作らない\n' "$OPT_CUSTOMER" "$OPT_MONTH" "$id" "$status" "$(jq -r '.total // "-"' <<<"$INV_JSON")"
      return 0 ;;
    draft) ;;
    *) die 3 "$OPT_MONTH 分の請求書 $id は status=${status}。作り直さない（寺田が判断）" ;;
  esac
  printf 'NOTE %s 分の下書き %s がある（前回が途中で止まった）。続きから行う\n' "$OPT_MONTH" "$id"
  confirm_live
  api_ok "下書きの読取" GET "/v1/invoices/$id"
  n="$(jq -r '.lines.total_count // (.lines.data | length)' <<<"$RESP_BODY")"
  if [ "$n" = "0" ]; then
    local txr
    txr="$(tax_rate_id)"
    add_items "$id" "$txr"
  fi
  finish_invoice "$id"
}

# 振込の顧客の請求書には、振込先を footer に入れる。値は COR_BILLING_TRANSFER_FOOTER（寺田が端末で入れる。リポジトリに書かない）。
load_transfer_footer() {
  TRANSFER_FOOTER=""
  [ "$(cust_meta payment)" = "transfer" ] || return 0
  TRANSFER_FOOTER="${COR_BILLING_TRANSFER_FOOTER:-}"
  [ -n "$TRANSFER_FOOTER" ] || die 3 "$OPT_CUSTOMER は振込の顧客だが、振込先（環境変数 COR_BILLING_TRANSFER_FOOTER）が無い。請求書に振込先を載せられないので作らない（runbook M1）"
  [ "${#TRANSFER_FOOTER}" -le 2000 ] || die 64 "COR_BILLING_TRANSFER_FOOTER が 2000 文字を超える（観測: ${#TRANSFER_FOOTER} 文字）"
  printf 'NOTE 振込の顧客: 請求書の footer に振込先（%s 文字）を入れる\n' "${#TRANSFER_FOOTER}"
}

do_invoice() {
  local id
  load_customer
  load_transfer_footer
  invoice_lines "$OPT_MONTH"
  print_lines "$OPT_MONTH"
  if [ "$LINES_N" -eq 0 ]; then
    printf 'DONE invoice: %s 分に請求するものが無い（契約の開始の月より前か、終了の月より後）。作らない\n' "$OPT_MONTH"
    return 0
  fi
  find_month_invoice "$OPT_MONTH"
  if [ -n "$INV_JSON" ]; then
    resume_invoice
    return 0
  fi
  confirm_live
  local txr
  txr="$(tax_rate_id)"
  create_draft
  id="$(jq -r '.id' <<<"$INV_JSON")"
  add_items "$id" "$txr"
  finish_invoice "$id"
}

# --month より前の月の当社の請求書が open のまま残っていれば止める（振込はふつう古い月から。
# 月を取り違えて新しい月を支払い済みにすると、支払い済みは取り消せず、古い月は open のまま残る）。
refuse_older_open() {
  local older
  api_ok "open の請求書の一覧" GET /v1/invoices --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "status=open" --data-urlencode "limit=100"
  older="$(jq -r --arg m "$OPT_MONTH" --arg mb "$MANAGED_BY" '[.data[] | select(.metadata.managed_by == $mb and (.metadata.billing_month // "") < $m and (.metadata.billing_month // "") != "") | "\(.metadata.billing_month)（\(.id)）"] | join(" ")' <<<"$RESP_BODY")"
  [ -z "$older" ] || die 3 "$OPT_CUSTOMER には $OPT_MONTH より前の open の請求書がある: ${older}。入金がどの月の分かを台帳で確かめ、古い月から --month に入れる。何もしていない"
}

# 振込を受けたら、その月の請求書を「Stripe の外で支払い済み」にする（引き落とさない）。
# open のままだと、請求書のページから二重に払われうる。
do_mark_paid() {
  local pay id status
  load_customer
  pay="$(cust_meta payment)"
  [ "$pay" = "transfer" ] || die 3 "$OPT_CUSTOMER の支払い方法が transfer でない（観測 payment=${pay:-なし}）。カードの顧客は charge で払う"
  refuse_older_open
  find_month_invoice "$OPT_MONTH"
  [ -n "$INV_JSON" ] || die 3 "$OPT_MONTH 分の請求書が無い（invoice を先に）"
  id="$(jq -r '.id' <<<"$INV_JSON")"
  status="$(jq -r '.status' <<<"$INV_JSON")"
  case "$status" in
    paid) printf 'OK mark-paid %s: %s 分の請求書 %s は支払い済み（何もしない）\n' "$OPT_CUSTOMER" "$OPT_MONTH" "$id"; return 0 ;;
    open) ;;
    *) die 3 "$OPT_MONTH 分の請求書 $id は status=${status}（open でない）。何もしない" ;;
  esac
  printf 'PLAN mark-paid: 請求書 %s（%s 分、税込 %s 円）を、入金日 %s の振込で支払い済みにする（paid_out_of_band=true）\n' "$id" "$OPT_MONTH" "$(jq -r '.total // "-"' <<<"$INV_JSON")" "$OPT_PAID_ON"
  confirm_live
  api_ok "支払い済みにする POST /v1/invoices/$id/pay" POST "/v1/invoices/$id/pay" --data-urlencode "paid_out_of_band=true"
  check_replay "支払い済みにする" "/v1/invoices/$id" '.status == "paid"' '{id, status}'
  [ "$(jq -r '.status' <<<"$RESP_BODY")" = "paid" ] || die 3 "請求書 $id が支払い済みにならなかった（観測 status=$(jq -r '.status' <<<"$RESP_BODY")）"
  printf 'MARKED_PAID %s %s: 入金日 %s の振込で支払い済みにした（税込 %s 円）。台帳の入金日に %s を書く\n' "$id" "$OPT_MONTH" "$OPT_PAID_ON" "$(jq -r '.total // "-"' <<<"$RESP_BODY")" "$OPT_PAID_ON"
}

do_charge() {
  local pay id status due total
  load_customer
  pay="$(cust_meta payment)"
  [ "$pay" = "card" ] || die 3 "$OPT_CUSTOMER の支払い方法が card でない（観測 payment=${pay:-なし}）。振込の顧客は請求書のとおり振り込んでもらう（charge しない）"
  find_month_invoice "$OPT_MONTH"
  [ -n "$INV_JSON" ] || die 3 "$OPT_MONTH 分の請求書が無い（invoice を先に）"
  id="$(jq -r '.id' <<<"$INV_JSON")"
  status="$(jq -r '.status' <<<"$INV_JSON")"
  case "$status" in
    paid) printf 'OK charge %s: %s 分の請求書 %s は支払い済み（払わない）\n' "$OPT_CUSTOMER" "$OPT_MONTH" "$id"; return 0 ;;
    open) ;;
    *) die 3 "$OPT_MONTH 分の請求書 $id は status=${status}（open でない）。払わない" ;;
  esac
  due="$(jq -r '.due_date // "-"' <<<"$INV_JSON")"
  [ "$due" = "$DUE_EPOCH" ] || die 3 "請求書 $id の支払期限が計算と違う（期待 $DUE_EPOCH = $DUE_DATE 23:59:59 JST、観測 $due = $(fmt_jst "$due")）。払わない（寺田が判断）"
  find_saved_card
  [ -n "$CARD_PM" ] || die 3 "$OPT_CUSTOMER に保存したカードが無い（card-setup のページ: ${CS_STATUS:-まだ作っていない}）。払わない"
  total="$(jq -r '.total // "-"' <<<"$INV_JSON")"
  printf 'PLAN charge: 請求書 %s（%s 分、税込 %s 円、期限 %s）を %s（%s）で払う\n' "$id" "$OPT_MONTH" "$total" "$DUE_DATE" "$CARD_PM" "$CARD_SRC"
  confirm_live
  api_ok "支払い POST /v1/invoices/$id/pay" POST "/v1/invoices/$id/pay" --data-urlencode "payment_method=$CARD_PM"
  check_replay "支払い" "/v1/invoices/$id" '.status == "paid"' '{id, status}'
  [ "$(jq -r '.status' <<<"$RESP_BODY")" = "paid" ] || die 3 "請求書 $id が支払い済みにならなかった（観測 status=$(jq -r '.status' <<<"$RESP_BODY")）"
  printf 'PAID %s %s: 税込 %s 円を %s で払った\n' "$id" "$OPT_MONTH" "$(jq -r '.amount_paid // .total' <<<"$RESP_BODY")" "$CARD_PM"
}

do_cancel() {
  local ks="contract_${OPT_SERVICE}_start" ke="contract_${OPT_SERVICE}_end" start cur
  load_customer
  start="$(cust_meta "$ks")"
  [ -n "$start" ] || die 3 "$OPT_CUSTOMER に $OPT_SERVICE の契約が無い（metadata に $ks が無い）"
  [[ ! "$CANCEL_END_DATE" < "$start" ]] || die 64 "終了日 $CANCEL_END_DATE が契約の開始日 $start より前（受理日 $OPT_ACCEPTED を確かめる）"
  cur="$(cust_meta "$ke")"
  if [ "$cur" = "$CANCEL_END_DATE" ]; then
    printf 'OK cancel %s %s: 既に終了日 %s（書かない）\n' "$OPT_CUSTOMER" "$OPT_SERVICE" "$cur"
    return 0
  fi
  [ -z "$cur" ] || die 3 "$OPT_CUSTOMER の $ke に別の終了日がある（期待 ${CANCEL_END_DATE}、観測 ${cur}）。書き換えない（寺田が判断）"
  find_month_invoice "${CANCEL_END_DATE:0:7}"
  [ -z "$INV_JSON" ] || die 3 "終了日を含む月 ${CANCEL_END_DATE:0:7} の請求書 $(jq -r '.id' <<<"$INV_JSON") が既にある。終了日を書いても、その月の日割りと残りは請求されない。書かない（寺田が判断）"
  put_meta "終了日を書く" ".metadata[\"$ke\"] == \"$CANCEL_END_DATE\"" "$ke=$CANCEL_END_DATE"
  printf 'CANCEL %s %s: 受理日 %s → 終了日 %s。%s 分の請求書（%s に invoice）に、次の明細が入る\n' \
    "$OPT_CUSTOMER" "$OPT_SERVICE" "$OPT_ACCEPTED" "$CANCEL_END_DATE" "${CANCEL_END_DATE:0:7}" "$(next_date "$(month_last_date "${CANCEL_END_DATE:0:7}")")"
  CUST_JSON="$RESP_BODY"
  invoice_lines "${CANCEL_END_DATE:0:7}"
  print_lines "${CANCEL_END_DATE:0:7}"
  printf 'NOTE 終了日を過ぎたら入口を閉じる（runbook D3）\n'
}

# hold / unhold: Customer の metadata の印を書き、clerk-sync と同じ形で Clerk へ写す。
# 印は contract_<サービス>_hold=true。外すときは空の値にして key を消す（Stripe は空の値で metadata の key を消す）。
do_hold() { do_set_hold true; }
do_unhold() { do_set_hold false; }
do_set_hold() {
  local on="$1" ks="contract_${OPT_SERVICE}_start" kh="contract_${OPT_SERVICE}_hold" org cur newv cond what
  load_customer
  [ -n "$(cust_meta "$ks")" ] || die 3 "$OPT_CUSTOMER に $OPT_SERVICE の契約が無い（metadata に $ks が無い）。hold を書かない"
  org="$(cust_meta clerk_org_id)"
  [ -n "$org" ] || die 3 "$OPT_CUSTOMER に clerk_org_id が無い（customer --clerk-org で作った顧客を使う）。Clerk に写せないので書かない"
  [[ "$org" =~ ^[A-Za-z0-9_]{1,64}$ ]] || die 3 "clerk_org_id の形が違う（観測: $org）。書かない"
  cur="$(cust_meta "$kh")"
  if [ "$on" = "true" ]; then
    if [ "$cur" = "true" ]; then
      printf 'OK hold %s %s: 既に hold（書かない。Clerk へも写さない。写し直すなら resync）\n' "$OPT_CUSTOMER" "$OPT_SERVICE"
      return 0
    fi
    newv="true"
    cond=".metadata[\"$kh\"] == \"true\""
    what="hold を書く"
  else
    if [ -z "$cur" ] || [ "$cur" = "false" ]; then
      printf 'OK unhold %s %s: hold は付いていない（書かない。Clerk へも写さない。写し直すなら resync）\n' "$OPT_CUSTOMER" "$OPT_SERVICE"
      return 0
    fi
    newv=""
    cond="(.metadata[\"$kh\"] // \"\") == \"\""
    what="hold を外す"
  fi
  # これから書く値を重ねた状態で Clerk に送る本文を作り、本番の確認より前に見せる
  # （plans.json に無いサービスの削除も、確認の前に表示する）。
  CUST_JSON="$(jq -c --arg k "$kh" --arg v "$newv" '.metadata = ((.metadata // {}) + {($k): $v})' <<<"$CUST_JSON")"
  check_clerk_rows
  print_clerk_rows "$(clerk_services_json)"
  clerk_build_payload "$org"
  confirm_live
  put_meta "$what" "$cond" "$kh=$newv"
  CUST_JSON="$RESP_BODY"
  if [ "$on" = "true" ]; then
    printf 'HOLD %s %s: metadata に印を書いた。Clerk の組織に写す\n' "$OPT_CUSTOMER" "$OPT_SERVICE"
  else
    printf 'UNHOLD %s %s: metadata の印を消した。Clerk の組織に写す\n' "$OPT_CUSTOMER" "$OPT_SERVICE"
  fi
  clerk_send_payload "$org"
}

# --- 照合（全件の送り直しと hold の判定。ADR-0028 の 2 節・決定 1） ---

# 顧客の一覧。100 件ずつ、starting_after でページを送る（#506 の既知の LOW: 100 件で切れる）。
list_all_customers() {
  local after="" all="[]" page more n=0
  while :; do
    n=$((n + 1))
    [ "$n" -le 1000 ] || die 3 "顧客の一覧のページが 1000 を超えた。全件を見ていない"
    if [ -z "$after" ]; then
      api_ok "顧客の一覧" GET /v1/customers --data-urlencode "limit=100"
    else
      api_ok "顧客の一覧（続き）" GET /v1/customers --data-urlencode "limit=100" --data-urlencode "starting_after=$after"
    fi
    page="$RESP_BODY"
    all="$(jq -c -n --argjson a "$all" --argjson b "$(jq -c '.data // []' <<<"$page")" '$a + $b')"
    more="$(jq -r '.has_more // false' <<<"$page")"
    [ "$more" = "true" ] || break
    after="$(jq -r '.data[-1].id // empty' <<<"$page")"
    [ -n "$after" ] || die 3 "顧客の一覧の続きの位置（starting_after）を読めない。全件を見ていない"
  done
  printf '%s' "$all"
}

# その顧客の、支払いの期限の 14 日後を過ぎても open の請求書が含むサービス（決定 1）。
# 期限の日（日本時間）の 14 日後を過ぎたものだけ。1 件でもあれば、そのサービスは hold。
# 請求書の一覧も 100 件ずつページを送る。
overdue_services() {
  local cus="$1" today="$2" after="" page more ids id svcs out="" n=0
  while :; do
    n=$((n + 1))
    [ "$n" -le 1000 ] || die 3 "請求書の一覧のページが 1000 を超えた（顧客 $cus）。全件を見ていない"
    if [ -z "$after" ]; then
      api_ok "open の請求書の一覧" GET /v1/invoices --data-urlencode "customer=$cus" --data-urlencode "status=open" --data-urlencode "limit=100"
    else
      api_ok "open の請求書の一覧（続き）" GET /v1/invoices --data-urlencode "customer=$cus" --data-urlencode "status=open" --data-urlencode "limit=100" --data-urlencode "starting_after=$after"
    fi
    page="$RESP_BODY"
    ids="$(jq -r --arg t "$today" '.data[]? | select((.due_date // 0) > 0) | select((((.due_date + 1209600) | todate)[0:10]) < $t) | .id' <<<"$page")"
    while IFS= read -r id; do
      [ -n "$id" ] || continue
      api_ok "請求書 $id の明細" GET "/v1/invoices/$id"
      svcs="$(jq -r '[.lines.data[]? | .metadata.service // empty] | unique | .[]' <<<"$RESP_BODY")"
      [ -z "$svcs" ] || out="$out$svcs"$'\n'
    done <<<"$ids"
    more="$(jq -r '.has_more // false' <<<"$page")"
    [ "$more" = "true" ] || break
    after="$(jq -r '.data[-1].id // empty' <<<"$page")"
    [ -n "$after" ] || die 3 "請求書の一覧の続きの位置（starting_after）を読めない。全件を見ていない"
  done
  printf '%s' "$out" | sed '/^$/d' | sort -u
}

# 全件の送り直しと hold の判定。顧客ごとに、契約しているサービスの hold を「期限の 14 日後を過ぎても open の
# 請求書があるか」で決め直し、変わったところだけ metadata に書く。clerk_org_id があれば services と resync_at を送る。
do_resync() {
  local today ts all n i cus overdue svc cur want cond
  local -a kvs=()
  local customers=0 holds=0 sent=0
  today="$(today_jst)"
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'NOTE resync: 全件の送り直し（今日 %s JST、resync_at %s）。hold は請求書の支払いの期限の 14 日後を過ぎても open のものから決める\n' "$today" "$ts"
  all="$(list_all_customers)"
  n="$(jq 'length' <<<"$all")"
  printf 'RESYNC 顧客 %s 件を見る\n' "$n"
  i=0
  while [ "$i" -lt "$n" ]; do
    cus="$(jq -r --argjson i "$i" '.[$i].id' <<<"$all")"
    i=$((i + 1))
    OPT_CUSTOMER="$cus"
    api_ok "顧客 $cus の読取" GET "/v1/customers/$cus"
    CUST_JSON="$RESP_BODY"
    if [ "$(jq -r '.deleted // false' <<<"$CUST_JSON")" = "true" ]; then
      printf 'NOTE %s は削除されている（飛ばす）\n' "$cus"
      continue
    fi
    customers=$((customers + 1))
    overdue="$(overdue_services "$cus" "$today")"
    kvs=()
    cond="true"
    while IFS= read -r svc; do
      [ -n "$(cust_meta "contract_${svc}_start")" ] || continue
      cur="$(cust_meta "contract_${svc}_hold")"
      [ "$cur" = "true" ] && cur="true" || cur="false"
      if printf '%s\n' "$overdue" | grep -qxF -- "$svc"; then want="true"; else want="false"; fi
      [ "$cur" = "$want" ] && continue
      if [ "$want" = "true" ]; then
        kvs+=("contract_${svc}_hold=true")
        cond="$cond and (.metadata[\"contract_${svc}_hold\"] == \"true\")"
        printf 'PLAN hold %s %s: 支払いの期限の 14 日後を過ぎても open の請求書がある\n' "$cus" "$svc"
      else
        kvs+=("contract_${svc}_hold=")
        cond="$cond and ((.metadata[\"contract_${svc}_hold\"] // \"\") == \"\")"
        printf 'PLAN unhold %s %s: 期限を過ぎた open の請求書が無い（払われたか、まだ期限の 14 日後を過ぎていない）\n' "$cus" "$svc"
      fi
    done < <(plans_services)
    if [ "${#kvs[@]}" -gt 0 ]; then
      put_meta "hold を書く（resync）" "$cond" "${kvs[@]}"
      CUST_JSON="$RESP_BODY"
      holds=$((holds + 1))
    fi
    if [ -n "$(cust_meta clerk_org_id)" ]; then
      check_clerk_rows
      # 読むだけの build（NOTE と本文を出す）→ send。本番の確認（live と打つ）は main で 1 回済ませてある
      clerk_build_payload "$(cust_meta clerk_org_id)" "$(jq -cn --arg t "$ts" '{resync_at: $t}')"
      clerk_send_payload "$(cust_meta clerk_org_id)"
      sent=$((sent + 1))
      printf 'RESYNC %s: Clerk の組織 %s に services と resync_at を送った\n' "$cus" "$(cust_meta clerk_org_id)"
    else
      printf 'NOTE %s に clerk_org_id が無い（Clerk へは送らない）\n' "$cus"
    fi
  done
  printf 'RESYNC 完了: 顧客 %s 件、hold を書き直した顧客 %s 件、Clerk へ送った顧客 %s 件（resync_at %s）\n' "$customers" "$holds" "$sent" "$ts"
}

# --- Clerk の組織の metadata（services の写し。ADR-0028 の 2 節） ---

# Customer の metadata から、Clerk の組織の public_metadata.services に送る JSON を作る。
# 契約の無いサービスは null（Clerk の更新は deep merge なので、null でその項目が消える）。
clerk_services_json() {
  local names
  names="$(plans_services | jq -R -s 'split("\n") | map(select(length > 0))')"
  jq -cn --argjson names "$names" --argjson m "$(jq -c '.metadata // {}' <<<"$CUST_JSON")" '
    # 空の値は key が無いのと同じに扱う（空の from を送ると、判定する側が止まる）
    def v($k): $m[$k] | if . == null or . == "" then null else . end;
    reduce $names[] as $s ({};
      (v("contract_\($s)_start")) as $start
      | if $start == null then . + {($s): null}
        else . + {($s): {from: $start, until: (v("contract_\($s)_end")), hold: ($m["contract_\($s)_hold"] == "true")}}
        end)'
}

# Clerk に送る前に、契約の metadata の形を確かめる（形の違う値を送ると、サービスがトークンを拒否する）。
check_clerk_rows() {
  local s start end hold
  while IFS= read -r s; do
    start="$(cust_meta "contract_${s}_start")"
    end="$(cust_meta "contract_${s}_end")"
    hold="$(cust_meta "contract_${s}_hold")"
    if [ -z "$start" ]; then
      # key が無ければ契約なし。key があって値が空なら形が違う（黙って契約なしにしない）
      if jq -e --arg k "contract_${s}_start" '.metadata | has($k)' <<<"$CUST_JSON" >/dev/null; then
        die 3 "contract_${s}_start が空（形が違う）。Clerk に送らない"
      fi
      continue
    fi
    valid_date "$start" || die 3 "contract_${s}_start が実在する日付ではない（観測: $start）。Clerk に送らない"
    [ -z "$end" ] || valid_date "$end" || die 3 "contract_${s}_end が実在する日付ではない（観測: $end）。Clerk に送らない"
    case "$hold" in "" | true | false) ;; *) die 3 "contract_${s}_hold が true か false でも空でもない（観測: $hold）。Clerk に送らない" ;; esac
  done < <(plans_services)
}

print_clerk_rows() {
  jq -r 'to_entries[] | if .value == null then "PLAN services.\(.key) = null（契約が無い。Clerk から消す）" else "PLAN services.\(.key) from=\(.value.from) until=\(.value.until // "null") hold=\(.value.hold)" end' <<<"$1"
}

# 組織の public_metadata.services を、顧客の契約から作った services で置き換える（deep merge。null のサービスは消える）。
# 応答の services を送った値と比べ、違えば止まる（書いたあとは戻せないので、観測値を出して寺田に渡す）。
# 送る本文を作る（読むだけ。GET で今の metadata を読み、plans.json に無いサービスも null で消す）。
# NOTE と JSON をここで出す（本番の確認より前に、消えるキーまで見せる）。本文は CLERK_BODY_JSON に入れる。
clerk_build_payload() {
  local org="$1" extra="${2:-}" names stale
  clerk_api GET "/organizations/$org"
  require_ok "Clerk の metadata の読取 GET /organizations/$org"
  names="$(plans_services | jq -R -s 'split("\n") | map(select(length > 0))')"
  stale="$(jq -c --argjson names "$names" '[(.public_metadata.services // {}) | keys[] | select(. as $k | $names | index($k) | not)]' <<<"$RESP_BODY")"
  CLERK_SERVICES="$(clerk_services_json | jq -c --argjson stale "$stale" '. + ($stale | map({key: ., value: null}) | from_entries)')"
  if [ "$(jq 'length' <<<"$stale")" -gt 0 ]; then
    printf 'NOTE plans.json に無いサービスを Clerk から消す: %s\n' "$(jq -r 'join(", ")' <<<"$stale")"
  fi
  if [ -n "$extra" ]; then
    CLERK_BODY_JSON="$(jq -cn --argjson s "$CLERK_SERVICES" --argjson e "$extra" '{public_metadata: ({services: $s} + $e)}')"
  else
    CLERK_BODY_JSON="$(jq -cn --argjson s "$CLERK_SERVICES" '{public_metadata: {services: $s}}')"
  fi
  printf 'JSON %s\n' "$CLERK_BODY_JSON"
  if jq -e '[to_entries[] | select(.value != null and (.value.until // null) == null)] | length > 0' <<<"$CLERK_SERVICES" >/dev/null; then
    printf 'NOTE until の null は Clerk の deep merge でキーを消す（残る形は from と hold。until が無い = 終了日なし）\n'
  fi
}

# clerk_build_payload が作った本文を送り、応答を送ったキーだけについて照合する。
clerk_send_payload() {
  local org="$1" key
  clerk_api PATCH "/organizations/$org/metadata" "$CLERK_BODY_JSON"
  require_ok "Clerk の metadata の更新 PATCH /organizations/$org/metadata"
  jq -e --argjson want "$CLERK_SERVICES" '
    def canon: {from: .from, until: (.until // null), hold: (.hold // false)};
    (.public_metadata.services // {}) as $got
    | [ $want | to_entries[] as $e
        | if $e.value == null then ($got[$e.key] == null)
          elif ($got[$e.key] | type) != "object" then false
          else (($got[$e.key] | canon) == ($e.value | canon))
          end ]
    | all' <<<"$RESP_BODY" >/dev/null \
    || die 3 "Clerk の応答の services が送った値と違う（観測: $(jq -c '.public_metadata.services // {}' <<<"$RESP_BODY")）。送ったあとなので戻せない。clerk-sync の dry-run か Clerk の画面で確かめる"
  key="$(jq -r --argjson want "$CLERK_SERVICES" '(.public_metadata.services // {}) as $got | [$want | keys[] | select(($want[.] != null) and ($got[.] == null))] | join(", ")' <<<"$RESP_BODY")"
  [ -z "$key" ] || die 3 "Clerk の応答に、送ったはずのサービスが無い（観測: $key）。送ったあとなので戻せない"
  printf 'SENT clerk %s: services を送った（%s）\n' "$org" "$(jq -r 'to_entries | map(if .value == null then "\(.key)=null" else "\(.key)(from=\(.value.from))" end) | join(", ")' <<<"$CLERK_SERVICES")"
}

# 呼ぶ側（hold・unhold・resync）は、clerk_build_payload（読むだけ・NOTE と JSON を出す）→
# confirm_live（本番の確認）→ clerk_send_payload（送る）の順に書く。build と send をまとめた
# 便利な関数は置かない（確認より後に消えるキーが出る形を作らないため）。

do_clerk_sync() {
  local org services
  load_customer
  org="$(cust_meta clerk_org_id)"
  [ -n "$org" ] || die 3 "$OPT_CUSTOMER に clerk_org_id が無い（customer --clerk-org で作った顧客を使う）。Clerk に送らない"
  [[ "$org" =~ ^[A-Za-z0-9_]{1,64}$ ]] || die 3 "clerk_org_id の形が違う（観測: $org）。Clerk に送らない"
  check_clerk_rows
  services="$(clerk_services_json)"
  print_clerk_rows "$services"
  if [ "$DO_APPLY" -eq 0 ]; then
    printf 'JSON %s\n' "$(jq -cn --argjson s "$services" '{public_metadata: {services: $s}}')"
    printf 'PLAN clerk-sync: PATCH %s/organizations/%s/metadata に上の JSON を送る（deep merge。null のサービスは消える）。送る前に今の metadata を読み、plans.json に無いサービスも null で消す\n' "$CLERK_API_BASE" "$org"
    printf 'DONE dry-run: 顧客の metadata を読んだだけ。Clerk へは送っていない（Clerk の鍵も読まない）。実行は --apply --mode test|live（寺田）\n'
    return 0
  fi
  # 本番の確認より前に、送る本文（消えるキーを含む）を出す。確認した内容だけを送る。
  read_clerk_key
  clerk_build_payload "$org"
  confirm_live
  clerk_send_payload "$org"
}

# 支払い方法を変える（段階 5）。発行済みの請求書は変えない（次の締めから効く）。
# card へ変えるときは、保存したカードがあることを確かめてから書く（無いまま card にすると、期限の日に払えない）。
do_set_payment() {
  local cur
  load_customer
  cur="$(cust_meta payment)"
  if [ "$cur" = "$OPT_PAYMENT" ]; then
    printf 'OK set-payment %s: 既に payment=%s（書かない）\n' "$OPT_CUSTOMER" "$cur"
    return 0
  fi
  if [ "$OPT_PAYMENT" = "card" ]; then
    find_saved_card
    [ -n "$CARD_PM" ] || die 3 "$OPT_CUSTOMER に保存したカードが無い（card-setup のページ: ${CS_STATUS:-まだ作っていない}）。card にしない（期限の日に払えない）"
    printf 'NOTE card に変える: 保存したカード %s（%s）\n' "$CARD_PM" "$CARD_SRC"
  fi
  put_meta "支払い方法を書く" ".metadata.payment == \"$OPT_PAYMENT\"" "payment=$OPT_PAYMENT"
  printf 'SET_PAYMENT %s: %s→%s。発行済みの請求書は変えない（次の締めから効く）\n' "$OPT_CUSTOMER" "${cur:-なし}" "$OPT_PAYMENT"
}

do_status() {
  local s ym this
  load_customer
  printf 'CUSTOMER %s customer_code=%s name=%s payment=%s\n' "$OPT_CUSTOMER" "$(cust_meta customer_code)" "$(jq -r '.name // "-"' <<<"$CUST_JSON")" "$(cust_meta payment)"
  while IFS= read -r s; do
    [ -n "$(cust_meta "contract_${s}_start")" ] || continue
    printf 'CONTRACT %s start=%s devfee_count=%s end=%s bill_from=%s\n' "$s" "$(cust_meta "contract_${s}_start")" \
      "$(cust_meta "contract_${s}_devfee_count")" "$(cust_meta "contract_${s}_end")" "$(cust_meta "contract_${s}_bill_from")"
  done < <(plans_services)
  this="$(today_jst)"
  this="${this:0:7}"
  for ym in "$this" "$(ym_add "$this" -1)"; do
    find_month_invoice "$ym"
    if [ -z "$INV_JSON" ]; then printf 'INVOICE %s なし\n' "$ym"; continue; fi
    jq -r --arg m "$ym" '"INVOICE \($m) \(.id) status=\(.status) total=\(.total) due_date=\(.due_date)"' <<<"$INV_JSON"
  done
  find_saved_card
  if [ -n "$CARD_PM" ]; then printf 'CARD %s（%s）\n' "$CARD_PM" "$CARD_SRC"; else printf 'CARD なし（card-setup のページ: %s）\n' "${CS_STATUS:-まだ作っていない}"; fi
  if [ "$CS_STATUS" = "open" ] && [ -n "$CS_URL" ]; then printf 'SETUP_URL %s\n' "$CS_URL"; fi
}

# 通信しない。開始の月から --months か月分の明細と、月ごとの合計（税別）を出す。
do_simulate() {
  local i ym out l t sum=0
  printf 'mode: simulate（通信しない）service=%s start=%s devfee_count=%s end=%s billing_from=%s months=%s\n' \
    "$OPT_SERVICE" "$OPT_START" "$OPT_DEVFEE" "${OPT_END:-なし}" "${OPT_BILL_FROM:-なし}" "$OPT_MONTHS"
  for ((i = 0; i < OPT_MONTHS; i++)); do
    ym="$(ym_add "${OPT_START:0:7}" "$i")"
    out="$(billing_lines "$OPT_SERVICE" "$OPT_START" "$OPT_DEVFEE" "$OPT_END" "$ym" "$OPT_BILL_FROM")"
    t=0
    while IFS= read -r l; do
      [ -n "$l" ] || continue
      printf 'LINE %s %s\n' "$ym" "$(printf '%s' "$l" | awk -F'\t' '{ printf "%s %s %s〜%s %s", $1, $2, $3, $4, $5 }')"
      t=$((t + $(printf '%s' "$l" | cut -f2)))
    done <<<"$out"
    printf 'TOTAL %s %s\n' "$ym" "$t"
    sum=$((sum + t))
  done
  printf 'SUM %s 円（税別、%s か月）\n' "$sum" "$OPT_MONTHS"
}

main() {
  parse_args "$@"
  require_tools jq
  bash "$SCRIPT_DIR/apply-plans.sh" --plans "$PLANS" >/dev/null || die 2 "plans.json の検査で不合格（bash docs/billing/apply-plans.sh を実行して NG の行を見る）"
  # 契約・解約・請求書のサブコマンドは、plans.json の請求の形をこのスクリプトが実装しているときだけ動く（dry-run も止める）
  case "$CMD" in customer | find | status) ;; *) require_implemented_billing ;; esac
  validate_inputs
  if [ "$CMD" = "simulate" ]; then do_simulate; return 0; fi
  if [ -n "$MODE" ]; then printf 'mode: %s --mode %s\n' "$CMD" "$MODE"; else printf 'mode: %s dry-run（通信しない・鍵を読まない）\n' "$CMD"; fi
  print_plan
  case "$CMD" in
    find | status) ;;
    clerk-sync) ;; # dry-run でも顧客を読む（読むだけ）。Clerk へ送るのは --apply のとき
    *)
      if [ "$DO_APPLY" -eq 0 ]; then
        printf 'DONE dry-run: 何もしていない。実行は --apply --mode test|live（寺田）\n'
        return 0
      fi
      ;;
  esac
  require_curl
  load_api_version
  read_key
  check_mode
  # hold と unhold は、Stripe の metadata と Clerk の両方に書く。書き始める前に両方の鍵を読む（片方だけ書いた状態を作らない）
  case "$CMD" in hold | unhold | resync) read_clerk_key ;; esac
  # invoice と charge は、明細と額を読んで出してから、本番の確認をする（do_invoice / do_charge の中）
  case "$CMD" in find | status | invoice | charge | mark-paid | clerk-sync | hold | unhold) ;; *) confirm_live ;; esac
  "do_${CMD//-/_}"
}

main "$@"
