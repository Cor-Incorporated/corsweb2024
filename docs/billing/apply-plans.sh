#!/usr/bin/env bash
# docs/billing/apply-plans.sh — plans.json の商品・価格・税率を Stripe に冪等に作る。
#
# 既定は dry-run（通信しない・鍵を読まない）。作るのは --apply --mode test|live のときだけで、
# 実行するのは寺田だけ（AI のレーンは --apply を実行しない。手順は docs/billing/runbook.md）。
#
# 鍵:   環境変数 COR_BILLING_API_KEY。無ければ端末から表示しない入力で受ける。
#       鍵は表示しない・ファイルに書かない・curl の引数に載せない（curl の設定を標準入力で渡す）。
#       読んだ直後に環境変数から消し、子プロセス（curl / jq）へ継承させない。
# モード: 書く前に GET /v1/balance の livemode を読み、--mode と食い違えば何も書かずに止まる。
#       鍵の接頭辞では判定しない（形式を決め打ちしない）。
# 冪等: 商品は固定 id、価格は lookup_key、税率は metadata.plan_key で既存を探す。
#       あれば中身を照合し、食い違えば期待値と観測値を出して止まる。
#       価格の金額は作成後に変えられない（prices/update に unit_amount が無い）ので上書きしない。
# 分割（開発費の 12 回）: 価格は月額の定期価格として作るだけ。回数は顧客ごとの
#       subscription schedule の phases[].duration で止める（README.md 3 章）。
#
# 終了コード: 0 = 成功 / 2 = plans.json の検査で不合格 / 3 = Stripe 側の既存と食い違い・モード違い /
#            4 = API・通信のエラー / 64 = 使い方の誤り
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
PLANS="$SCRIPT_DIR/plans.json"
DO_APPLY=0

usage() {
  cat <<'EOF'
使い方:
  bash docs/billing/apply-plans.sh [--plans <path>]                     dry-run（既定。通信しない・鍵を読まない）
  bash docs/billing/apply-plans.sh --apply --mode test [--plans <path>] テストモードに作る（寺田が実行）
  bash docs/billing/apply-plans.sh --apply --mode live [--plans <path>] 本番に作る（寺田が実行。端末で live と打つ確認あり）
鍵: 環境変数 COR_BILLING_API_KEY。無ければ表示しない入力で受ける。
EOF
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --apply) DO_APPLY=1 ;;
      --dry-run) DO_APPLY=0 ;;
      --mode)
        [ $# -ge 2 ] || { usage >&2; die 64 "--mode に値が無い"; }
        MODE="$2"
        shift
        ;;
      --plans)
        [ $# -ge 2 ] || { usage >&2; die 64 "--plans に値が無い"; }
        PLANS="$2"
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        die 64 "知らない引数: $1"
        ;;
    esac
    shift
  done
  if [ "$DO_APPLY" -eq 1 ]; then
    case "$MODE" in
      test | live) ;;
      *) die 64 "--apply には --mode test か --mode live が要る（観測: '${MODE}'）" ;;
    esac
  elif [ -n "$MODE" ]; then
    die 64 "--mode は --apply と一緒に使う（dry-run は通信しないのでモードを持たない）"
  fi
}

# jq の共通定義: 3 桁区切りと整数判定。
readonly JQ_LIB='
def comma: tostring | if length <= 3 then . else (.[0:length-3] | comma) + "," + .[length-3:] end;
def isint: type == "number" and . == floor;
'

# plans.json の検査。誤りを 1 行ずつ出す（観測値つき）。
readonly JQ_VALIDATE='
. as $r
| ($r.limits // {}) as $l
| (reduce ($r.products // [])[] as $p ({}; .[($p.id // "") | tostring] = $p)) as $prod
| ([($r.services // [])[] | .service]) as $svcs
| ($r.tax_rate // {}) as $t
| [
    (if $r.schema != "cor-billing-plans.v1" then "schema が cor-billing-plans.v1 でない（観測: \($r.schema)）" else empty end),
    (if $r.currency != "jpy" then "currency が jpy でない（観測: \($r.currency)）" else empty end),
    (if ($r.stripe_api_version | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}\\.[a-z]+$")) | not
      then "stripe_api_version の形が違う（観測: \($r.stripe_api_version)）" else empty end),
    (if ([$l.min_unit_amount_jpy, $l.max_unit_amount_jpy, $l.max_installments] | all(isint)) | not
      then "limits の 3 項目は整数（観測: \($l)）" else empty end),
    (if ($t.id | type == "string" and test("^[a-z0-9_]+$")) | not then "tax_rate.id の形が違う（観測: \($t.id)）" else empty end),
    (if ($t.percentage | type) != "number" or $t.percentage <= 0 or $t.percentage >= 100
      then "tax_rate.percentage は 0 より大きく 100 未満（観測: \($t.percentage)）" else empty end),
    (if $t.inclusive != false then "tax_rate.inclusive は false（税別で統一。観測: \($t.inclusive)）" else empty end),
    (if $t.country != "JP" then "tax_rate.country は JP（観測: \($t.country)）" else empty end),
    (if ($t.display_name | type == "string" and length > 0 and length <= 50) | not
      then "tax_rate.display_name は 1〜50 文字（観測: \($t.display_name)）" else empty end),
    (($r.products // []) | group_by(.id)[] | select(length > 1) | "products の id が重複: \(.[0].id)"),
    (($r.products // [])[]
      | (if (.id | type == "string" and test("^[a-z0-9_]+$")) | not then "products の id の形が違う（観測: \(.id)）" else empty end),
        (if (.kind | IN("service", "dev_fee")) | not then "products[\(.id)].kind は service か dev_fee（観測: \(.kind)）" else empty end),
        (if (.service | IN($svcs[])) | not then "products[\(.id)].service が services に無い（観測: \(.service)）" else empty end),
        (if (.name | type == "string" and length > 0) | not then "products[\(.id)].name が空" else empty end)),
    (($r.prices // []) | group_by(.lookup_key)[] | select(length > 1) | "prices の lookup_key が重複: \(.[0].lookup_key)"),
    (($r.prices // [])[] | . as $x | $prod[($x.product // "") | tostring] as $p | $x.unit_amount_jpy_excl_tax as $a
      | (if ($x.lookup_key | type == "string" and test("^[a-z0-9_]+$")) | not then "prices の lookup_key の形が違う（観測: \($x.lookup_key)）" else empty end),
        (if $p == null then "prices[\($x.lookup_key)].product が products に無い（観測: \($x.product)）" else empty end),
        (if $x.tax_behavior != "exclusive" then "prices[\($x.lookup_key)].tax_behavior は exclusive（税別で統一。観測: \($x.tax_behavior)）" else empty end),
        (if $x.interval != "month" then "prices[\($x.lookup_key)].interval は month（観測: \($x.interval)）" else empty end),
        (if ($x.enabled | type) != "boolean" then "prices[\($x.lookup_key)].enabled は true / false（観測: \($x.enabled)）" else empty end),
        (if ($x.plan | IN("basic", "premium", "dev_fee")) | not then "prices[\($x.lookup_key)].plan は basic / premium / dev_fee（観測: \($x.plan)）" else empty end),
        (if $x.enabled == true and (($a | isint) | not)
          then "prices[\($x.lookup_key)].unit_amount_jpy_excl_tax は整数の円（JPY はゼロ小数。観測: \($a)）"
         elif $x.enabled == true and ($a < $l.min_unit_amount_jpy or $a > $l.max_unit_amount_jpy)
          then "prices[\($x.lookup_key)].unit_amount_jpy_excl_tax が範囲外（\($l.min_unit_amount_jpy)〜\($l.max_unit_amount_jpy) 円。観測: \($a)）"
         else empty end),
        (if $x.enabled == false and $a != null then "prices[\($x.lookup_key)] は enabled=false なので unit_amount_jpy_excl_tax は null（観測: \($a)）" else empty end),
        (if $p != null and $x.plan == "dev_fee" and $p.kind != "dev_fee" then "prices[\($x.lookup_key)] は dev_fee なのに商品の kind が \($p.kind)" else empty end),
        (if $p != null and $x.plan != "dev_fee" and $p.kind != "service" then "prices[\($x.lookup_key)] は \($x.plan) なのに商品の kind が \($p.kind)" else empty end),
        (if $x.plan == "dev_fee" and $x.enabled == true
            and ((($x.installments | isint) and $x.installments >= 1 and $x.installments <= $l.max_installments) | not)
          then "prices[\($x.lookup_key)].installments は 1〜\($l.max_installments) の整数（観測: \($x.installments)）" else empty end),
        (if $x.plan != "dev_fee" and $x.installments != null then "prices[\($x.lookup_key)] は \($x.plan) なので installments を持たない（観測: \($x.installments)）" else empty end)),
    (($r.services // [])[] | . as $s
      | (if ($prod[($s.product // "") | tostring] | (. == null) or (.service != $s.service) or (.kind != "service"))
          then "services[\($s.service)].product が同じ service の service 商品を指していない（観測: \($s.product)）" else empty end),
        (if ($prod[($s.dev_fee_product // "") | tostring] | (. == null) or (.service != $s.service) or (.kind != "dev_fee"))
          then "services[\($s.service)].dev_fee_product が同じ service の dev_fee 商品を指していない（観測: \($s.dev_fee_product)）" else empty end)),
    ($svcs[] as $sv
      | ([($r.prices // [])[] | select(.plan == "basic" and .enabled == true and (($prod[(.product // "") | tostring] // {}).service == $sv))] | length) as $n
      | if $n != 1 then "service \($sv) の有効な basic の価格がちょうど 1 つでない（観測: \($n) 件）" else empty end)
  ]
| .[]
'

readonly JQ_SUMMARY='
"CHECK ok: plans.json の検査（products \(.products | length)、prices \(.prices | length)（有効 \([.prices[] | select(.enabled)] | length)、枠 \([.prices[] | select(.enabled | not)] | length)）、tax_rate 1）"
'

readonly JQ_PLAN='
. as $r | $r.tax_rate as $t
| "PLAN tax_rate \($t.id): 「\($t.display_name)」\($t.percentage)% 税別（inclusive=false）country=\($t.country) jurisdiction=\($t.jurisdiction) tax_type=\($t.tax_type) → GET /v1/tax_rates で metadata.plan_key を探し、無ければ POST /v1/tax_rates",
  ($r.products[] | "PLAN product \(.id): 「\(.name)」service=\(.service) kind=\(.kind) → GET /v1/products/\(.id)、404 なら POST /v1/products"),
  ($r.prices[]
    | if .enabled then
        .unit_amount_jpy_excl_tax as $a | ($a * $t.percentage / 100 | round) as $tax
        | "PLAN price \(.lookup_key): \($a | comma) 円（税別）/月、参考 税込 \(($a + $tax) | comma) 円/月、tax_behavior=\(.tax_behavior) product=\(.product)"
          + (if .plan == "dev_fee" then "、× \(.installments) 回（税別の総額 \(($a * .installments) | comma) 円。回数は価格ではなく顧客ごとの subscription schedule で止める）" else "" end)
          + " → GET /v1/prices?lookup_keys[]=\(.lookup_key)、無ければ POST /v1/prices"
      else "SKIP price \(.lookup_key): 枠だけ（enabled=false。金額が決まってから enabled=true にする）"
      end)
'

validate_plans() {
  [ -f "$PLANS" ] || die 2 "plans.json が無い: $PLANS"
  jq -e . "$PLANS" >/dev/null 2>&1 || die 2 "plans.json が JSON として読めない: $PLANS"
  local errors
  errors="$(jq -r "$JQ_LIB$JQ_VALIDATE" "$PLANS")" || die 2 "plans.json の検査が jq で失敗した: $PLANS"
  if [ -n "$errors" ]; then
    printf '%s\n' "$errors" | sed 's/^/NG: /' >&2
    die 2 "plans.json の検査で不合格（$(printf '%s\n' "$errors" | wc -l | tr -d ' ') 件）。何も作っていない"
  fi
  jq -r "$JQ_SUMMARY" "$PLANS"
}

ensure_tax_rate() {
  local want key matches n diff
  want="$(jq -c '.tax_rate' "$PLANS")"
  key="$(jq -r '.id' <<<"$want")"
  api GET /v1/tax_rates --data-urlencode "active=true" --data-urlencode "limit=100"
  require_ok "税率の一覧 GET /v1/tax_rates"
  [ "$(jq -r '.has_more' <<<"$RESP_BODY")" != "true" ] || die 3 "有効な税率が 100 件を超える。手で確かめてから実行する"
  matches="$(jq -c --arg k "$key" '[.data[] | select(.metadata.plan_key == $k)]' <<<"$RESP_BODY")"
  n="$(jq 'length' <<<"$matches")"
  [ "$n" -le 1 ] || die 3 "metadata.plan_key=$key の税率が $n 件ある（1 件のはず）: $(jq -r 'map(.id) | join(", ")' <<<"$matches")"
  if [ "$n" -eq 1 ]; then
    diff="$(jq -r --argjson w "$want" '.[0] as $o | [
      (if $o.percentage != $w.percentage then "percentage 期待 \($w.percentage) 観測 \($o.percentage)" else empty end),
      (if $o.inclusive != $w.inclusive then "inclusive 期待 \($w.inclusive) 観測 \($o.inclusive)" else empty end),
      (if $o.country != $w.country then "country 期待 \($w.country) 観測 \($o.country)" else empty end),
      (if $o.tax_type != $w.tax_type then "tax_type 期待 \($w.tax_type) 観測 \($o.tax_type)" else empty end)
      ] | join("; ")' <<<"$matches")"
    [ -z "$diff" ] || die 3 "既存の税率 $(jq -r '.[0].id' <<<"$matches") が plans.json と違う: $diff（率と国は作成後に変えられない。作り直すかは寺田判断）"
    printf 'OK tax_rate %s: 既存 %s と一致\n' "$key" "$(jq -r '.[0].id' <<<"$matches")"
    return 0
  fi
  api POST /v1/tax_rates \
    --data-urlencode "display_name=$(jq -r '.display_name' <<<"$want")" \
    --data-urlencode "percentage=$(jq -r '.percentage' <<<"$want")" \
    --data-urlencode "inclusive=false" \
    --data-urlencode "country=$(jq -r '.country' <<<"$want")" \
    --data-urlencode "jurisdiction=$(jq -r '.jurisdiction' <<<"$want")" \
    --data-urlencode "tax_type=$(jq -r '.tax_type' <<<"$want")" \
    --data-urlencode "metadata[plan_key]=$key" \
    --data-urlencode "metadata[managed_by]=$MANAGED_BY"
  require_ok "税率の作成 POST /v1/tax_rates"
  check_replay "税率の作成" "/v1/tax_rates/$(jq -r '.id' <<<"$RESP_BODY")" '.active == true' '{id, active, percentage}'
  printf 'CREATED tax_rate %s: %s\n' "$key" "$(jq -r '.id' <<<"$RESP_BODY")"
}

ensure_product() {
  local id="$1" want diff
  want="$(jq -c --arg id "$id" '.products[] | select(.id == $id)' "$PLANS")"
  api GET "/v1/products/$id"
  if [ "$RESP_CODE" = "404" ]; then
    api POST /v1/products \
      --data-urlencode "id=$id" \
      --data-urlencode "name=$(jq -r '.name' <<<"$want")" \
      --data-urlencode "metadata[service]=$(jq -r '.service' <<<"$want")" \
      --data-urlencode "metadata[kind]=$(jq -r '.kind' <<<"$want")" \
      --data-urlencode "metadata[managed_by]=$MANAGED_BY"
    require_ok "商品 $id の作成 POST /v1/products"
    check_replay "商品 $id の作成" "/v1/products/$id" '.active == true' '{id, active, name}'
    printf 'CREATED product %s\n' "$id"
    return 0
  fi
  require_ok "商品 $id の読取 GET /v1/products/$id"
  diff="$(jq -r --argjson w "$want" '[
    (if .name != $w.name then "name 期待「\($w.name)」観測「\(.name)」" else empty end),
    (if .active != true then "active 期待 true 観測 \(.active)" else empty end),
    (if .metadata.service != $w.service then "metadata.service 期待 \($w.service) 観測 \(.metadata.service)" else empty end),
    (if .metadata.kind != $w.kind then "metadata.kind 期待 \($w.kind) 観測 \(.metadata.kind)" else empty end)
    ] | join("; ")' <<<"$RESP_BODY")"
  [ -z "$diff" ] || die 3 "既存の商品 $id が plans.json と違う: $diff（上書きしない。直すかは寺田判断）"
  printf 'OK product %s: 既存と一致\n' "$id"
}

ensure_price() {
  local lk="$1" want currency diff product
  want="$(jq -c --arg k "$lk" '.prices[] | select(.lookup_key == $k)' "$PLANS")"
  currency="$(jq -r '.currency' "$PLANS")"
  api GET /v1/prices --data-urlencode "lookup_keys[]=$lk" --data-urlencode "limit=10"
  require_ok "価格 $lk の読取 GET /v1/prices"
  if [ "$(jq '.data | length' <<<"$RESP_BODY")" -ge 1 ]; then
    diff="$(jq -r --argjson w "$want" --arg cur "$currency" '.data[0] as $o | [
      (if $o.unit_amount != $w.unit_amount_jpy_excl_tax then "unit_amount 期待 \($w.unit_amount_jpy_excl_tax) 観測 \($o.unit_amount)" else empty end),
      (if $o.currency != $cur then "currency 期待 \($cur) 観測 \($o.currency)" else empty end),
      (if $o.type != "recurring" then "type 期待 recurring 観測 \($o.type)" else empty end),
      (if ($o.recurring // {}).interval != $w.interval then "recurring.interval 期待 \($w.interval) 観測 \(($o.recurring // {}).interval)" else empty end),
      (if $o.tax_behavior != $w.tax_behavior then "tax_behavior 期待 \($w.tax_behavior) 観測 \($o.tax_behavior)" else empty end),
      (if (($o.product | if type == "object" then .id else . end)) != $w.product then "product 期待 \($w.product) 観測 \($o.product)" else empty end)
      ] | join("; ")' <<<"$RESP_BODY")"
    [ -z "$diff" ] || die 3 "既存の価格 $lk（$(jq -r '.data[0].id' <<<"$RESP_BODY")）が plans.json と違う: $diff（金額は作成後に変えられないので上書きしない。新しい lookup_key で作るかは寺田判断）"
    printf 'OK price %s: 既存 %s と一致\n' "$lk" "$(jq -r '.data[0].id' <<<"$RESP_BODY")"
    return 0
  fi
  product="$(jq -r '.product' <<<"$want")"
  local -a extra=()
  if [ "$(jq -r '.plan' <<<"$want")" = "dev_fee" ]; then
    extra=(--data-urlencode "metadata[installments]=$(jq -r '.installments' <<<"$want")")
  fi
  api POST /v1/prices \
    --data-urlencode "lookup_key=$lk" \
    --data-urlencode "product=$product" \
    --data-urlencode "currency=$currency" \
    --data-urlencode "unit_amount=$(jq -r '.unit_amount_jpy_excl_tax' <<<"$want")" \
    --data-urlencode "recurring[interval]=$(jq -r '.interval' <<<"$want")" \
    --data-urlencode "tax_behavior=$(jq -r '.tax_behavior' <<<"$want")" \
    --data-urlencode "nickname=$lk" \
    --data-urlencode "metadata[plan]=$(jq -r '.plan' <<<"$want")" \
    --data-urlencode "metadata[service]=$(jq -r --arg p "$product" '.products[] | select(.id == $p) | .service' "$PLANS")" \
    --data-urlencode "metadata[managed_by]=$MANAGED_BY" \
    ${extra[@]+"${extra[@]}"}
  require_ok "価格 $lk の作成 POST /v1/prices"
  check_replay "価格 $lk の作成" "/v1/prices/$(jq -r '.id' <<<"$RESP_BODY")" '.active == true' '{id, active, unit_amount}'
  printf 'CREATED price %s: %s\n' "$lk" "$(jq -r '.id' <<<"$RESP_BODY")"
}

apply_all() {
  local id lk
  require_curl
  read_key
  check_mode
  confirm_live
  ensure_tax_rate
  while IFS= read -r id; do ensure_product "$id"; done < <(jq -r '.products[].id' "$PLANS")
  while IFS= read -r lk; do ensure_price "$lk"; done < <(jq -r '.prices[] | select(.enabled) | .lookup_key' "$PLANS")
  printf 'DONE apply --mode %s: 上の CREATED / OK が全件\n' "$MODE"
}

main() {
  parse_args "$@"
  command -v jq >/dev/null 2>&1 || die 64 "jq が要る"
  if [ "$DO_APPLY" -eq 1 ]; then
    printf 'mode: apply --mode %s\n' "$MODE"
  else
    printf 'mode: dry-run（通信しない・鍵を読まない）\n'
  fi
  validate_plans
  load_api_version
  printf 'api_version: %s\nplans: %s\n' "$API_VERSION" "$PLANS"
  jq -r "$JQ_LIB$JQ_PLAN" "$PLANS"
  if [ "$DO_APPLY" -eq 0 ]; then
    printf 'DONE dry-run: 何も作っていない。作るのは寺田が --apply --mode test で（docs/billing/runbook.md）\n'
    return 0
  fi
  apply_all
}

main "$@"
