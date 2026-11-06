#!/usr/bin/env bash
# docs/billing/lib.sh — apply-plans.sh / subscribe.sh / verify-installments.sh が共有する部品。
# 単独では実行しない（source して使う）。呼ぶ側が set -euo pipefail と PLANS を決める。
#
# 鍵の扱い（3 本とも同じ）:
#   - 環境変数 COR_BILLING_API_KEY、無ければ端末から表示しない入力で受ける。
#   - 読んだ直後に環境変数から消す。表示しない・ファイルに書かない・curl の引数に載せない
#     （curl の設定を標準入力で渡す。printf は shell の組込みなので、プロセス一覧にも出ない）。
# モード: 書く前・読む前に GET /v1/balance の livemode を読み、--mode と食い違えば止まる。
#   鍵の接頭辞では見分けない（形式を決め打ちしない）。

readonly API_BASE="https://api.stripe.com"
readonly MANAGED_BY="corsweb/docs/billing/plans.json"
MODE="${MODE:-}"
API_KEY=""
API_VERSION=""
RESP_BODY=""
RESP_CODE=""

die() {
  local code="$1"
  shift
  printf 'STOP: %s\n' "$*" >&2
  exit "$code"
}

require_tools() {
  local t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || die 64 "$t が要る"
  done
}

load_api_version() {
  API_VERSION="$(jq -r '.stripe_api_version' "$PLANS")"
  [[ "$API_VERSION" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[a-z]+$ ]] || die 2 "plans.json の stripe_api_version の形が違う（観測: $API_VERSION）"
}

sha256_hex() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -d' ' -f1
  else
    sha256sum | cut -d' ' -f1
  fi
}

# 同じモード・同じパス・同じ引数なら同じ key。引数が 1 つでも違えば別の key になる。
idempotency_key() {
  local digest
  digest="$(printf '%s\n' "$MODE" "$@" | sha256_hex)"
  printf 'cor-billing-%s-%s' "$MODE" "${digest:0:32}"
}

# api METHOD PATH [--data-urlencode k=v ...] → RESP_CODE と RESP_BODY に入れる。
api() {
  local method="$1" path="$2"
  shift 2
  local escaped out
  local -a args=(-sS -g -X "$method" --max-time 30 -K - -H "Stripe-Version: $API_VERSION" --write-out '\n%{http_code}')
  if [ "$method" = "POST" ]; then
    args+=(-H "Idempotency-Key: $(idempotency_key "$path" "$@")")
  elif [ "$method" = "GET" ]; then
    args+=(-G)
  fi
  escaped="${API_KEY//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  out="$(printf 'header = "Authorization: Bearer %s"\n' "$escaped" | curl "${args[@]}" "$@" "$API_BASE$path")" \
    || die 4 "curl が失敗した（$method $path）"
  RESP_CODE="${out##*$'\n'}"
  RESP_BODY="${out%$'\n'*}"
}

api_error_text() {
  jq -r '.error | "\(.type // "-") \(.code // "-"): \(.message // "-")"' <<<"$RESP_BODY" 2>/dev/null \
    || printf '(本文を JSON として読めない)'
}

require_ok() {
  case "$RESP_CODE" in
    2??) ;;
    *) die 4 "API エラー（HTTP $RESP_CODE、$1）: $(api_error_text)" ;;
  esac
}

# api して 2xx でなければ止まる。
api_ok() {
  local what="$1"
  shift
  api "$@"
  require_ok "$what"
}

read_key() {
  if [ -n "${COR_BILLING_API_KEY:-}" ]; then
    API_KEY="$COR_BILLING_API_KEY"
  else
    [ -t 0 ] || die 64 "鍵が無い: COR_BILLING_API_KEY を設定するか、端末から実行する（表示しない入力で受ける）"
    printf '%s モードの鍵を貼り付けて Enter（画面には出ない）: ' "$MODE" >&2
    IFS= read -rs API_KEY
    printf '\n' >&2
  fi
  unset COR_BILLING_API_KEY
  [ -n "$API_KEY" ] || die 64 "鍵が空"
}

check_mode() {
  local live want="false"
  api_ok "モードの確認 GET /v1/balance" GET /v1/balance
  live="$(jq -r '.livemode' <<<"$RESP_BODY")"
  if [ "$MODE" = "live" ]; then want="true"; fi
  [ "$live" = "$want" ] || die 3 "鍵のモードが --mode と違う（--mode $MODE、観測 livemode=$live）。何も書いていない"
  printf 'CHECK ok: 鍵のモード = %s（観測 livemode=%s）\n' "$MODE" "$live"
}

confirm_live() {
  local ans=""
  [ "$MODE" = "live" ] || return 0
  [ -t 0 ] || die 64 "本番は端末から実行する（live と打つ確認が要る）。何も書いていない"
  printf '本番（live）に上の PLAN を実行します。続けるなら live と打って Enter: ' >&2
  IFS= read -r ans
  [ "$ans" = "live" ] || die 64 "確認の入力が live でないので止めた（観測: '${ans}'）。何も書いていない"
}

# lookup_key から有効な価格の id を返す。無ければ止まる。
price_id_by_lookup() {
  local lk="$1" id
  api_ok "価格 $lk の読取 GET /v1/prices" GET /v1/prices --data-urlencode "lookup_keys[]=$lk" --data-urlencode "limit=10"
  id="$(jq -r '.data[0].id // empty' <<<"$RESP_BODY")"
  [ -n "$id" ] || die 3 "価格 $lk が無い。先に apply-plans.sh --apply --mode $MODE を実行する"
  printf '%s' "$id"
}

# plans.json の税率（metadata.plan_key）の id を返す。無いか 2 件以上なら止まる。
tax_rate_id() {
  local key n
  key="$(jq -r '.tax_rate.key' "$PLANS")"
  api_ok "税率の一覧 GET /v1/tax_rates" GET /v1/tax_rates --data-urlencode "active=true" --data-urlencode "limit=100"
  n="$(jq --arg k "$key" '[.data[] | select(.metadata.plan_key == $k)] | length' <<<"$RESP_BODY")"
  [ "$n" -eq 1 ] || die 3 "metadata.plan_key=$key の税率が $n 件（1 件のはず）。先に apply-plans.sh --apply --mode $MODE を実行する"
  jq -r --arg k "$key" '[.data[] | select(.metadata.plan_key == $k)][0].id' <<<"$RESP_BODY"
}

# plans.json から、サービスの有効な価格の lookup_key を返す（plan = basic か dev_fee）。
plans_lookup() {
  local service="$1" plan="$2" product_key="product" lk
  if [ "$plan" = "dev_fee" ]; then product_key="dev_fee_product"; fi
  lk="$(jq -r --arg s "$service" --arg pl "$plan" --arg pk "$product_key" '
    (.services[] | select(.service == $s) | .[$pk]) as $prod
    | [.prices[] | select(.product == $prod and .plan == $pl and .enabled == true) | .lookup_key][0] // empty' "$PLANS")"
  [ -n "$lk" ] || die 64 "plans.json に service=$service の有効な $plan の価格が無い"
  printf '%s' "$lk"
}

plans_services() {
  jq -r '.services[].service' "$PLANS"
}

# epoch 秒を日本時間の日付と時刻にする（macOS と GNU の date の両方）。
fmt_jst() {
  local epoch="$1"
  [[ "$epoch" =~ ^[0-9]+$ ]] || { printf '%s' "$epoch"; return 0; }
  TZ=Asia/Tokyo date -r "$epoch" '+%Y-%m-%d %H:%M JST' 2>/dev/null \
    || TZ=Asia/Tokyo date -d "@$epoch" '+%Y-%m-%d %H:%M JST'
}

# YYYY-MM-DD の日本時間 09:00 を epoch 秒にする（macOS と GNU の date の両方）。
jst_date_epoch() {
  local d="$1"
  [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die 64 "日付は YYYY-MM-DD（観測: $d）"
  TZ=Asia/Tokyo date -j -f '%Y-%m-%d %H:%M:%S' "$d 09:00:00" '+%s' 2>/dev/null \
    || TZ=Asia/Tokyo date -d "$d 09:00:00" '+%s' 2>/dev/null \
    || die 64 "日付として読めない（観測: $d）"
}
