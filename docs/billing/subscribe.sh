#!/usr/bin/env bash
# docs/billing/subscribe.sh — 顧客 1 社の契約（Customer・basic・開発費の schedule）と解約。寺田が実行する。
#
# 既定は dry-run（通信しない・鍵を読まない）。書くのは --apply --mode test|live のときだけ。
# 読むだけのサブコマンド（find / status）は --mode test|live で通信する（書かない）。
# 鍵・モードの扱いは lib.sh と同じ（鍵は表示しない・引数に載せない、書く前に livemode を確かめる）。
#
# サブコマンド:
#   customer --code <顧客コード> --name <社名> --email <請求先のメール> [--clerk-org <Clerk の組織の id>]  Customer を作る（あれば作らない）
#   find     --code <顧客コード>                                          Customer の id を探す（読むだけ）
#   basic    --customer <cus_…> --service <サービス> --tenant <製品側の組織>  basic の subscription と最初の支払いページ
#   devfee   --customer <cus_…> --service <サービス> --count <回数> --start align|now|YYYY-MM-DD
#                                                                         開発費の schedule（count 回で止まる）
#   status   --customer <cus_…>                                           契約の一覧（読むだけ）
#   cancel   --subscription <sub_…> --accepted <受理日 YYYY-MM-DD>         basic を受理日の 1 か月後の同じ日の終わりで止める（basic 以外は止めない）
#
# 終了コード: 0 = 成功 / 2 = plans.json の不合格 / 3 = 既存と食い違い・前提が足りない・モード違い /
#            4 = API・通信のエラー / 64 = 使い方・入力の誤り
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
PLANS="$SCRIPT_DIR/plans.json"
DO_APPLY=0
CMD=""
OPT_CODE=""
OPT_NAME=""
OPT_EMAIL=""
OPT_CUSTOMER=""
OPT_SERVICE=""
OPT_TENANT=""
OPT_COUNT=""
OPT_START=""
OPT_SUB=""
OPT_CLERK=""
OPT_ACCEPTED=""
CANCEL_END_DATE=""
CANCEL_AT=""

usage() {
  sed -n '8,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'EOF'
共通: [--plans <path>] [--mode test|live] [--apply]
例:   bash docs/billing/subscribe.sh basic --customer cus_XXXX --service xesm --tenant 組織名            （dry-run）
      bash docs/billing/subscribe.sh basic --customer cus_XXXX --service xesm --tenant 組織名 --apply --mode test
EOF
}

set_opt() {
  case "$1" in
    --mode) MODE="$2" ;;
    --plans) PLANS="$2" ;;
    --code) OPT_CODE="$2" ;;
    --name) OPT_NAME="$2" ;;
    --email) OPT_EMAIL="$2" ;;
    --customer) OPT_CUSTOMER="$2" ;;
    --service) OPT_SERVICE="$2" ;;
    --tenant) OPT_TENANT="$2" ;;
    --count) OPT_COUNT="$2" ;;
    --start) OPT_START="$2" ;;
    --subscription) OPT_SUB="$2" ;;
    --clerk-org) OPT_CLERK="$2" ;;
    --accepted) OPT_ACCEPTED="$2" ;;
  esac
}

parse_args() {
  [ $# -ge 1 ] || { usage >&2; die 64 "サブコマンドが要る"; }
  CMD="$1"
  shift
  case "$CMD" in
    customer | find | basic | devfee | status | cancel) ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die 64 "知らないサブコマンド: $CMD" ;;
  esac
  while [ $# -gt 0 ]; do
    case "$1" in
      --apply) DO_APPLY=1 ;;
      --mode | --plans | --code | --name | --email | --customer | --service | --tenant | --count | --start | --subscription | --clerk-org | --accepted)
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

one_line() {
  # 1 行・空でない・上限以下
  local label="$1" value="$2" max="$3"
  [ -n "$value" ] || die 64 "$label が空"
  [[ "$value" != *$'\n'* && "$value" != *$'\t'* ]] || die 64 "$label に改行かタブが入っている"
  [ "${#value}" -le "$max" ] || die 64 "$label が $max 文字を超える（観測: ${#value} 文字）"
}

check_service() {
  plans_services | grep -qxF -- "$OPT_SERVICE" || die 64 "--service は $(plans_services | paste -sd'|' -) のどれか（観測: $OPT_SERVICE）"
}

check_count() {
  local max
  [[ "$OPT_COUNT" =~ ^[0-9]+$ ]] || die 64 "--count は整数（観測: $OPT_COUNT）"
  max="$(jq -r --arg lk "$(plans_lookup "$OPT_SERVICE" dev_fee)" '.prices[] | select(.lookup_key == $lk) | .installments' "$PLANS")"
  [ "$OPT_COUNT" -ge 1 ] && [ "$OPT_COUNT" -le "$max" ] || die 64 "--count は 1〜$max（plans.json の installments。観測: $OPT_COUNT）"
}

check_start() {
  local today
  case "$OPT_START" in
    align | now) return 0 ;;
  esac
  [[ "$OPT_START" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die 64 "--start は align / now / YYYY-MM-DD（観測: $OPT_START）"
  jst_date_epoch "$OPT_START" >/dev/null
  today="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
  [[ ! "$OPT_START" < "$today" ]] || die 64 "--start に過去の日付は使わない（過去の日付は遡って請求される。観測: $OPT_START、今日: $today）"
}

# 受理日は今日か過去の実在する日付。終了日（受理日の 1 か月後の同じ日の終わり）は未来であること。
check_accepted() {
  local today now
  [[ "$OPT_ACCEPTED" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die 64 "--accepted は受理日 YYYY-MM-DD（観測: $OPT_ACCEPTED）"
  valid_date "$OPT_ACCEPTED" || die 64 "--accepted が実在する日付ではない（観測: $OPT_ACCEPTED）"
  today="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
  [[ ! "$OPT_ACCEPTED" > "$today" ]] || die 64 "--accepted に未来の日付は使わない（受理した日を入れる。観測: $OPT_ACCEPTED、今日: $today）"
  set_cancel_at "$OPT_ACCEPTED"
  now="$(date '+%s')"
  [ "$CANCEL_AT" -gt "$now" ] || die 64 "終了日 $CANCEL_END_DATE は既に過ぎている（受理日 $OPT_ACCEPTED。Stripe は過去の終了日を受け付けない。寺田が判断）"
}

validate_inputs() {
  case "$MODE" in "" | test | live) ;; *) die 64 "--mode は test か live（観測: $MODE）" ;; esac
  if [ "$DO_APPLY" -eq 1 ] && [ -z "$MODE" ]; then die 64 "--apply には --mode test か --mode live が要る"; fi
  case "$CMD" in
    customer)
      need --code "$OPT_CODE"; need --name "$OPT_NAME"; need --email "$OPT_EMAIL"
      one_line --name "$OPT_NAME" 256
      [[ "$OPT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] && [ "${#OPT_EMAIL}" -le 512 ] \
        || die 64 "--email の形が違う（観測: $OPT_EMAIL）" ;;
    find) need --code "$OPT_CODE" ;;
    basic)
      need --customer "$OPT_CUSTOMER"; need --service "$OPT_SERVICE"; need --tenant "$OPT_TENANT"
      check_service; one_line --tenant "$OPT_TENANT" 200 ;;
    devfee)
      need --customer "$OPT_CUSTOMER"; need --service "$OPT_SERVICE"; need --count "$OPT_COUNT"; need --start "$OPT_START"
      check_service; check_count; check_start ;;
    status) need --customer "$OPT_CUSTOMER" ;;
    cancel)
      need --subscription "$OPT_SUB"; need --accepted "$OPT_ACCEPTED"
      [[ "$OPT_SUB" =~ ^sub_[A-Za-z0-9]+$ ]] || die 64 "--subscription は sub_ で始まる id（観測: $OPT_SUB）"
      check_accepted ;;
  esac
  if [ -n "$OPT_ACCEPTED" ] && [ "$CMD" != "cancel" ]; then die 64 "--accepted は cancel でだけ使う"; fi
  if [ -n "$OPT_CODE" ]; then
    [[ "$OPT_CODE" =~ ^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$ ]] || die 64 "--code は英小文字・数字・ハイフン（40 文字まで。観測: $OPT_CODE）"
  fi
  if [ -n "$OPT_CUSTOMER" ]; then
    [[ "$OPT_CUSTOMER" =~ ^cus_[A-Za-z0-9]+$ ]] || die 64 "--customer は cus_ で始まる id（観測: $OPT_CUSTOMER）"
  fi
  if [ -n "$OPT_CLERK" ]; then
    [ "$CMD" = "customer" ] || die 64 "--clerk-org は customer でだけ使う"
    [[ "$OPT_CLERK" =~ ^[A-Za-z0-9_]{1,64}$ ]] || die 64 "--clerk-org は英数字と下線（64 文字まで。観測: $OPT_CLERK）"
  fi
  case "$CMD" in
    find | status) [ -n "$MODE" ] || die 64 "$CMD は読むだけ。--mode test か --mode live が要る（--apply は要らない）" ;;
  esac
}

# 価格の要約（税別・参考の税込）。plans.json だけから作る。
price_summary() {
  jq -r --arg lk "$1" --argjson n "${2:-1}" '
    def comma: tostring | if length <= 3 then . else (.[0:length-3] | comma) + "," + .[length-3:] end;
    .tax_rate.percentage as $pct | .prices[] | select(.lookup_key == $lk)
    | .unit_amount_jpy_excl_tax as $a | ($a * $pct / 100 | round) as $t
    | "税別 \($a | comma) 円（参考 税込 \(($a + $t) | comma) 円）" + (if $n > 1 then " × \($n) 回 = 税別 \(($a * $n) | comma) 円" else "" end)' "$PLANS"
}

# plans.json の価格 1 回分の税込の額（検算用）。
expected_total() {
  jq -r --arg lk "$1" '.tax_rate.percentage as $p | .prices[] | select(.lookup_key == $lk)
    | .unit_amount_jpy_excl_tax + (.unit_amount_jpy_excl_tax * $p / 100 | round)' "$PLANS"
}

print_plan() {
  case "$CMD" in
    customer) printf 'PLAN customer: GET /v1/customers/search で customer_code=%s を探し、無ければ POST /v1/customers（name=%s、email=%s、metadata[customer_code]=%s、metadata[clerk_org_id]=%s）\n' \
      "$OPT_CODE" "$OPT_NAME" "$OPT_EMAIL" "$OPT_CODE" "${OPT_CLERK:-（なし）}" ;;
    find) printf 'PLAN find: GET /v1/customers/search で customer_code=%s を探す（読むだけ）\n' "$OPT_CODE" ;;
    basic) printf 'PLAN basic: %s の basic（%s、%s/月）を %s に。default_incomplete・カードは最初の支払いで保存・消費税を付ける・metadata[tenant]=%s。最初の請求書の支払いページの URL を出す（23 時間で失効）\n' \
      "$OPT_SERVICE" "$(plans_lookup "$OPT_SERVICE" basic)" "$(price_summary "$(plans_lookup "$OPT_SERVICE" basic)")" "$OPT_CUSTOMER" "$OPT_TENANT" ;;
    devfee) printf 'PLAN devfee: %s の開発費（%s、%s）を %s に schedule で。start=%s、end_behavior=cancel、カードは %s の basic の subscription のもの\n' \
      "$OPT_SERVICE" "$(plans_lookup "$OPT_SERVICE" dev_fee)" "$(price_summary "$(plans_lookup "$OPT_SERVICE" dev_fee)" "$OPT_COUNT")" "$OPT_CUSTOMER" "$OPT_START" "$OPT_SERVICE" ;;
    status) printf 'PLAN status: %s の subscription・schedule・開発費の支払い回数を読む（読むだけ）\n' "$OPT_CUSTOMER" ;;
    cancel) printf 'PLAN cancel: %s を %s の終わり（cancel_at=%s、%s）で止める。受理日 %s の %s か月後の同じ日。終了日を含む期間は日割りで請求され、返金はしない。metadata.plan が basic でなければ止めない。終了日が支払い済みの期間の中なら止めない\n' \
      "$OPT_SUB" "$CANCEL_END_DATE" "$CANCEL_AT" "$(fmt_jst "$CANCEL_AT")" "$OPT_ACCEPTED" "$(jq -r '.cancellation.notice_months' "$PLANS")" ;;
  esac
}

customer_code_of() {
  local code
  api_ok "顧客 $1 の読取" GET "/v1/customers/$1"
  code="$(jq -r '.metadata.customer_code // empty' <<<"$RESP_BODY")"
  [ -n "$code" ] || die 3 "顧客 $1 に metadata.customer_code が無い（subscribe.sh customer で作った顧客を使う）"
  printf '%s' "$code"
}

do_find() {
  api_ok "顧客の検索" GET /v1/customers/search --data-urlencode "query=metadata['customer_code']:'$OPT_CODE'" --data-urlencode "limit=10"
  jq -r '.data[] | "FOUND \(.id) customer_code=\(.metadata.customer_code) name=\(.name)"' <<<"$RESP_BODY"
  printf 'DONE find: %s 件（作った直後は検索に出るまで最大 1 分ほどかかる）\n' "$(jq '.data | length' <<<"$RESP_BODY")"
}

existing_customer_ok() {
  local id clerk
  id="$(jq -r '.data[0].id' <<<"$RESP_BODY")"
  clerk="$(jq -r '.data[0].metadata.clerk_org_id // empty' <<<"$RESP_BODY")"
  if [ -n "$OPT_CLERK" ] && [ -n "$clerk" ] && [ "$clerk" != "$OPT_CLERK" ]; then
    die 3 "顧客 $id（customer_code=$OPT_CODE）の clerk_org_id が違う（期待 $OPT_CLERK、観測 $clerk）。書き換えない"
  fi
  printf 'OK customer %s: customer_code=%s は既にある（作らない）\n' "$id" "$OPT_CODE"
  if [ -n "$OPT_CLERK" ] && [ -z "$clerk" ]; then
    printf 'NOTE 既存の顧客 %s に clerk_org_id が無い。このスクリプトは既存を書き換えない（付けるかは寺田）\n' "$id"
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
    --data-urlencode "metadata[managed_by]=$MANAGED_BY" \
    ${clerk_meta[@]+"${clerk_meta[@]}"}
  check_replay "顧客の作成" "/v1/customers/$(jq -r '.id' <<<"$RESP_BODY")" '(.deleted // false) == false' '{id, deleted}'
  printf 'CREATED customer %s（customer_code=%s、clerk_org_id=%s）\n' "$(jq -r '.id' <<<"$RESP_BODY")" "$OPT_CODE" "${OPT_CLERK:-なし}"
}

# 最初の請求書の額を plans.json と照らし、支払いページの URL を出す（RESP_BODY は latest_invoice を展開した subscription）。
report_first_invoice() {
  local lk="$1" want total taxes url
  want="$(expected_total "$lk")"
  total="$(jq -r '.latest_invoice.total // empty' <<<"$RESP_BODY")"
  taxes="$(jq -r '[.latest_invoice.total_taxes[]?.amount] | add // 0' <<<"$RESP_BODY")"
  [ "$total" = "$want" ] || die 3 "最初の請求書の税込の額が違う（期待 $want、観測 ${total:-なし}、税 $taxes）。支払いページの URL を送らない（払われなければ 23 時間で失効する）"
  printf 'CHECK ok: 最初の請求書 税込 %s 円（うち消費税 %s 円）\n' "$total" "$taxes"
  url="$(jq -r '.latest_invoice.hosted_invoice_url // empty' <<<"$RESP_BODY")"
  [ -n "$url" ] || die 3 "最初の請求書に支払いページの URL が無い（観測 status=$(jq -r '.latest_invoice.status // "-"' <<<"$RESP_BODY")）。status で確かめる"
  printf 'PAY_URL %s\n' "$url"
  printf 'NOTE この URL を顧客へ送る（送信は寺田）。23 時間以内に払われないと subscription は incomplete_expired になり、作り直しになる\n'
}

do_basic() {
  local lk price txr code existing
  lk="$(plans_lookup "$OPT_SERVICE" basic)"
  price="$(price_id_by_lookup "$lk")"
  txr="$(tax_rate_id)"
  code="$(customer_code_of "$OPT_CUSTOMER")"
  api_ok "subscription の一覧" GET /v1/subscriptions --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "status=all" --data-urlencode "limit=100"
  existing="$(jq -r --arg s "$OPT_SERVICE" '[.data[] | select(.metadata.service == $s and .metadata.plan == "basic"
    and (.status | IN("active", "trialing", "past_due", "unpaid", "incomplete", "paused"))) | "\(.id)(\(.status))"] | join(" ")' <<<"$RESP_BODY")"
  [ -z "$existing" ] || die 3 "この顧客には $OPT_SERVICE の basic が既にある: $existing（作らない）"
  build_basic_args "$OPT_CUSTOMER" "$price" "$txr" "$OPT_SERVICE"
  api_ok "basic の作成 POST /v1/subscriptions" POST /v1/subscriptions "${BASIC_ARGS[@]}" \
    --data-urlencode "metadata[customer_code]=$code" \
    --data-urlencode "metadata[tenant]=$OPT_TENANT"
  check_replay "basic の作成" "/v1/subscriptions/$(jq -r '.id' <<<"$RESP_BODY")" \
    '.status == "incomplete" and .latest_invoice.status == "open"' '{id, status, invoice: .latest_invoice.status}' \
    --data-urlencode "expand[0]=latest_invoice"
  printf 'CREATED subscription %s（%s basic、status=%s）\n' "$(jq -r '.id' <<<"$RESP_BODY")" "$OPT_SERVICE" "$(jq -r '.status' <<<"$RESP_BODY")"
  report_first_invoice "$lk"
}

basic_for_devfee() {
  api_ok "subscription の一覧" GET /v1/subscriptions --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "status=active" --data-urlencode "limit=100"
  jq -c --arg s "$OPT_SERVICE" '[.data[] | select(.metadata.service == $s and .metadata.plan == "basic")][0] // empty' <<<"$RESP_BODY"
}

devfee_start() {
  local basic_json="$1" ts
  case "$OPT_START" in
    now) printf 'now' ;;
    align)
      ts="$(jq -r '.items.data[0].current_period_end // empty' <<<"$basic_json")"
      [[ "$ts" =~ ^[0-9]+$ ]] || die 3 "basic の current_period_end を読めない（観測: ${ts:-なし}）。--start を日付で指定する"
      printf '%s' "$ts" ;;
    *) jst_date_epoch "$OPT_START" ;;
  esac
}

do_devfee() {
  local lk price txr code basic_json pm start existing
  lk="$(plans_lookup "$OPT_SERVICE" dev_fee)"
  price="$(price_id_by_lookup "$lk")"
  txr="$(tax_rate_id)"
  code="$(customer_code_of "$OPT_CUSTOMER")"
  basic_json="$(basic_for_devfee)"
  [ -n "$basic_json" ] || die 3 "$OPT_SERVICE の basic が active でない（最初の支払いがまだ）。basic の支払いが済んでから開発費を作る"
  pm="$(jq -r '.default_payment_method // empty | if type == "object" then .id else . end' <<<"$basic_json")"
  [ -n "$pm" ] || die 3 "basic の subscription $(jq -r '.id' <<<"$basic_json") にカードが保存されていない（default_payment_method が空）"
  start="$(devfee_start "$basic_json")"
  api_ok "schedule の一覧" GET /v1/subscription_schedules --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "limit=100"
  existing="$(jq -r --arg s "$OPT_SERVICE" '[.data[] | select(.metadata.service == $s and .metadata.plan == "dev_fee"
    and (.status | IN("not_started", "active"))) | "\(.id)(\(.status))"] | join(" ")' <<<"$RESP_BODY")"
  [ -z "$existing" ] || die 3 "この顧客には $OPT_SERVICE の開発費の schedule が既にある: $existing（作らない）"
  build_devfee_args "$OPT_CUSTOMER" "$start" "$pm" "$price" "$txr" "$OPT_COUNT" "$OPT_SERVICE"
  api_ok "開発費の schedule の作成 POST /v1/subscription_schedules" POST /v1/subscription_schedules "${DEVFEE_ARGS[@]}" \
    --data-urlencode "phases[0][metadata][customer_code]=$code" \
    --data-urlencode "metadata[customer_code]=$code"
  check_replay "開発費の schedule の作成" "/v1/subscription_schedules/$(jq -r '.id' <<<"$RESP_BODY")" \
    '.status | IN("not_started", "active")' '{id, status}'
  printf 'CREATED schedule %s（%s 開発費、status=%s、%s 回）\n' "$(jq -r '.id' <<<"$RESP_BODY")" "$OPT_SERVICE" "$(jq -r '.status' <<<"$RESP_BODY")" "$OPT_COUNT"
  printf 'CHECK phases[0]: 開始 %s → 終了 %s\n' "$(fmt_jst "$(jq -r '.phases[0].start_date' <<<"$RESP_BODY")")" "$(fmt_jst "$(jq -r '.phases[0].end_date' <<<"$RESP_BODY")")"
}

do_status() {
  local devs id
  api_ok "顧客の読取" GET "/v1/customers/$OPT_CUSTOMER"
  printf 'CUSTOMER %s customer_code=%s name=%s\n' "$OPT_CUSTOMER" "$(jq -r '.metadata.customer_code // "-"' <<<"$RESP_BODY")" "$(jq -r '.name // "-"' <<<"$RESP_BODY")"
  api_ok "subscription の一覧" GET /v1/subscriptions --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "status=all" \
    --data-urlencode "limit=100" --data-urlencode "expand[0]=data.latest_invoice"
  jq -r '.data[] | "SUB \(.id) service=\(.metadata.service // "-") plan=\(.metadata.plan // "-") status=\(.status) cancel_at_period_end=\(.cancel_at_period_end) cancel_at=\(.cancel_at // "-") period_end=\(.items.data[0].current_period_end // "-") card=\(if .default_payment_method then "保存済み" else "なし" end)"' <<<"$RESP_BODY"
  jq -r '.data[] | select(.status == "incomplete" and (.latest_invoice | type) == "object" and .latest_invoice.status == "open")
    | "PAY_URL \(.id) \(.latest_invoice.hosted_invoice_url // "（無い）")"' <<<"$RESP_BODY"
  devs="$(jq -r '.data[] | select(.metadata.plan == "dev_fee") | .id' <<<"$RESP_BODY")"
  api_ok "schedule の一覧" GET /v1/subscription_schedules --data-urlencode "customer=$OPT_CUSTOMER" --data-urlencode "limit=100"
  jq -r '.data[] | "SCHEDULE \(.id) service=\(.metadata.service // "-") status=\(.status) installments_in_stripe=\(.metadata.installments_in_stripe // "-") subscription=\(.subscription // "-")"' <<<"$RESP_BODY"
  for id in $devs; do
    api_ok "開発費の請求書" GET /v1/invoices --data-urlencode "subscription=$id" --data-urlencode "status=paid" --data-urlencode "limit=100"
    printf 'PAID %s: 支払い済みの請求書 %s 件\n' "$id" "$(jq '.data | length' <<<"$RESP_BODY")"
  done
}

# 解約: cancel_at を「受理日の 1 か月後の同じ日の終わり」に置く（特商法ページと plans.json の cancellation）。
# 終了日が次の期間に入るとき、Stripe はその期間を必ず日割りで請求する（proration_behavior では止められない）。
# 終了日が支払い済みの期間の中だと、差額が顧客の残高に戻る（返金しない方針と合わない）ので止める。
do_cancel() {
  local plan status existing cur_end
  api_ok "subscription の読取" GET "/v1/subscriptions/$OPT_SUB"
  plan="$(jq -r '.metadata.plan // "-"' <<<"$RESP_BODY")"
  status="$(jq -r '.status' <<<"$RESP_BODY")"
  [ "$plan" = "basic" ] || die 3 "$OPT_SUB は basic でない（観測 plan=$plan）。開発費は止めない（契約書に従う）"
  case "$status" in
    active | past_due | trialing) ;;
    *) die 3 "$OPT_SUB は解約できる状態でない（観測 status=$status）" ;;
  esac
  existing="$(jq -r '.cancel_at // empty' <<<"$RESP_BODY")"
  if [ "$existing" = "$CANCEL_AT" ]; then
    printf 'OK cancel %s: 既に %s に終わる設定（status=%s）\n' "$OPT_SUB" "$(fmt_jst "$CANCEL_AT")" "$status"
    return 0
  fi
  [ -z "$existing" ] || die 3 "$OPT_SUB には既に別の終了日時がある（期待 $(fmt_jst "$CANCEL_AT")、観測 $(fmt_jst "$existing")）。書き換えない（寺田が判断）"
  [ "$(jq -r '.cancel_at_period_end' <<<"$RESP_BODY")" != "true" ] \
    || die 3 "$OPT_SUB は期間末で止まる設定（cancel_at_period_end=true）。受理日から数えた終了日 $CANCEL_END_DATE と違うので書き換えない（寺田が判断）"
  cur_end="$(jq -r '.items.data[0].current_period_end // empty' <<<"$RESP_BODY")"
  [[ "$cur_end" =~ ^[0-9]+$ ]] || die 3 "$OPT_SUB の current_period_end を読めない（観測: ${cur_end:-なし}）"
  [ "$CANCEL_AT" -ge "$cur_end" ] \
    || die 3 "終了日時 $(fmt_jst "$CANCEL_AT") が支払い済みの期間（$(fmt_jst "$cur_end") まで）の中にある。このまま止めると差額が顧客の残高に戻り、返金しない方針と合わない。止めない（寺田が判断）"
  api_ok "終了日時を付ける POST /v1/subscriptions/$OPT_SUB" POST "/v1/subscriptions/$OPT_SUB" --data-urlencode "cancel_at=$CANCEL_AT"
  check_replay "終了日時を付ける" "/v1/subscriptions/$OPT_SUB" ".cancel_at == $CANCEL_AT" '{id, status, cancel_at}'
  [ "$(jq -r '.cancel_at // empty' <<<"$RESP_BODY")" = "$CANCEL_AT" ] \
    || die 3 "$OPT_SUB の cancel_at が $CANCEL_AT にならなかった（観測: $(jq -r '.cancel_at // "なし"' <<<"$RESP_BODY")）"
  printf 'CANCEL_AT %s: %s に終わる（受理日 %s → 終了日 %s の終わり）。終了日を含む期間は日割りで請求される。終わったら Access の許可から外す（runbook D2）\n' \
    "$OPT_SUB" "$(fmt_jst "$CANCEL_AT")" "$OPT_ACCEPTED" "$CANCEL_END_DATE"
}

main() {
  parse_args "$@"
  require_tools jq
  bash "$SCRIPT_DIR/apply-plans.sh" --plans "$PLANS" >/dev/null || die 2 "plans.json の検査で不合格（bash docs/billing/apply-plans.sh を実行して NG の行を見る）"
  # 契約・解約を作るサブコマンドは、plans.json の請求の形をこのスクリプトが実装しているときだけ動く（dry-run も止める）
  case "$CMD" in basic | devfee | cancel) require_implemented_billing ;; esac
  validate_inputs
  if [ -n "$MODE" ]; then printf 'mode: %s --mode %s\n' "$CMD" "$MODE"; else printf 'mode: %s dry-run（通信しない・鍵を読まない）\n' "$CMD"; fi
  print_plan
  case "$CMD" in
    find | status) ;;
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
  case "$CMD" in
    find | status) ;;
    *) confirm_live ;;
  esac
  "do_$CMD"
}

main "$@"
