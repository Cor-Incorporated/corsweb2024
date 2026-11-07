#!/usr/bin/env bash
# docs/billing/lib.sh — apply-plans.sh / subscribe.sh が共有する部品。
# 単独では実行しない（source して使う）。呼ぶ側が set -euo pipefail と PLANS を決める。
#
# 鍵の扱い（2 本とも同じ）:
#   - 環境変数 COR_BILLING_API_KEY、無ければ端末から表示しない入力で受ける。
#   - 読み込んだ時点で環境変数の export を外し、子プロセスへ継承させない。読んだ直後に消す。
#   - 表示しない・ファイルに書かない・curl の引数に載せない
#     （curl の設定を標準入力で渡す。printf は shell の組込みなので、プロセス一覧にも出ない）。
#   - curl は -q を最初に付けて ~/.curlrc を読ませない（verbose などで鍵がログに出るのを防ぐ）。
#   - bash -x（set -x）では鍵がトレースに出るので、読み込んだ時点で止まる。
#   - 鍵を聞く文と本番の確認の文は /dev/tty に出す（パイプやログに混ざらない）。
# モード: 書く前・読む前に GET /v1/balance の livemode を読み、--mode と食い違えば止まる。
#   鍵の接頭辞では見分けない（形式を決め打ちしない）。
# 冪等: POST は Idempotency-Key 付き。Stripe が前回の結果を返したとき（Idempotent-Replayed: true）は、
#   check_replay で今の状態を読み直し、期待と違えば止まる（「作った」と誤って出さない）。

readonly API_BASE="https://api.stripe.com"
# shellcheck disable=SC2034 # apply-plans.sh と subscribe.sh が使う
readonly MANAGED_BY="corsweb/docs/billing/plans.json"
MODE=""
API_KEY=""
API_VERSION=""
RESP_BODY=""
RESP_CODE=""
RESP_REPLAYED=""
export -n COR_BILLING_API_KEY

die() {
  local code="$1"
  shift
  printf 'STOP: %s\n' "$*" >&2
  exit "$code"
}

case "$-" in
  *x*) die 64 "set -x（bash -x）では鍵がトレースに出るので実行しない" ;;
esac

require_tools() {
  local t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || die 64 "$t が要る"
  done
}

# %header{} を使うので curl 7.84 以上が要る。
require_curl() {
  local v major minor
  require_tools curl
  v="$(curl --version | head -1 | cut -d' ' -f2)"
  major="${v%%.*}"
  minor="${v#*.}"
  minor="${minor%%.*}"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || die 64 "curl の版を読めない（観測: $v）"
  if [ "$major" -lt 7 ] || { [ "$major" -eq 7 ] && [ "$minor" -lt 84 ]; }; then
    die 64 "curl 7.84 以上が要る（観測: $v）"
  fi
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

# api METHOD PATH [--data-urlencode k=v ...] → RESP_CODE・RESP_REPLAYED・RESP_BODY に入れる。
api() {
  local method="$1" path="$2"
  shift 2
  local escaped out rest
  local -a args=(-q -sS -g -X "$method" --max-time 30 -K - -H "Stripe-Version: $API_VERSION"
    --write-out '\n%header{idempotent-replayed}\n%{http_code}')
  if [ "$method" = "POST" ]; then
    args+=(-H "Idempotency-Key: $(idempotency_key "$path" "$@")")
  elif [ "$method" = "GET" ]; then
    args+=(-G)
  fi
  escaped="${API_KEY//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  out="$(printf 'header = "Authorization: Bearer %s"\n' "$escaped" | curl "${args[@]}" "$@" "$API_BASE$path")" \
    || die 4 "curl が失敗した（$method $path）。POST なら書き込みが届いた可能性がある。同じコマンドを続けて実行せず、status か Stripe の画面で今の状態を確かめる"
  RESP_CODE="${out##*$'\n'}"
  rest="${out%$'\n'*}"
  RESP_REPLAYED="${rest##*$'\n'}"
  RESP_REPLAYED="$(printf '%s' "${RESP_REPLAYED%$'\r'}" | tr '[:upper:]' '[:lower:]')"
  RESP_BODY="${rest%$'\n'*}"
}

# 直前の POST が「同じ Idempotency-Key の前回の結果」だったら、今の状態を読み直して確かめる。
# check_replay <説明> <GET のパス> <今の状態として正しい条件（jq）> <観測として出す値（jq）> [GET の引数 ...]
# 正しければ RESP_BODY は読み直した結果になる。違えば止まる。
check_replay() {
  local what="$1" path="$2" cond="$3" shown="$4"
  shift 4
  [ "$RESP_REPLAYED" = "true" ] || return 0
  printf 'NOTE %s: 24 時間以内に同じ内容で送った要求の、前回の結果が返った（Idempotent-Replayed）。今の状態を読み直す\n' "$what"
  api_ok "$what の読み直し" GET "$path" "$@"
  jq -e "$cond" <<<"$RESP_BODY" >/dev/null \
    || die 3 "$what: 前回の結果が返ったが、今の状態が期待と違う（観測: $(jq -c "$shown" <<<"$RESP_BODY")）。何も変わっていない。24 時間以上あけて実行し直すか、status で確かめる"
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
    printf '%s モードの鍵を貼り付けて Enter（画面には出ない）: ' "$MODE" >/dev/tty
    IFS= read -rs API_KEY
    printf '\n' >/dev/tty
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
  printf '本番（live）に上の PLAN を実行します。続けるなら live と打って Enter: ' >/dev/tty
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
  key="$(jq -r '.tax_rate.id' "$PLANS")"
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

# このスクリプト群が実装している請求の形。plans.json の billing.closing と違えば、テストモードでも本番でも、
# dry-run でも、契約・解約・請求書のサブコマンドは何もせずに止まる（exit 3）。
# 2026-11-07 に寺田が「月末締め翌月末払い」（closing=month_end）と作り方 B（毎月末の請求書。README 1C 章）に決めた。
# 前の形（same_day_advance。subscription で前払い）の部品は、B の実装で外した。
# この値と plans.json の billing.closing は tests/test-subscribe.sh が結ぶ（片方だけ変えると落ちる）。
readonly IMPLEMENTED_BILLING_CLOSING="month_end"

require_implemented_billing() {
  local closing
  closing="$(jq -r '.billing.closing // "-"' "$PLANS")"
  [ "$closing" = "$IMPLEMENTED_BILLING_CLOSING" ] \
    || die 3 "plans.json の請求の形（billing.closing=$closing）は、このスクリプトの実装（$IMPLEMENTED_BILLING_CLOSING。README 1C 章の B）と違う。何もしていない"
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

# 年と月から、その月の日数（うるう年を含む）。
days_in_month() {
  local y="$1" m="$2"
  case "$m" in
    1 | 3 | 5 | 7 | 8 | 10 | 12) printf '31' ;;
    4 | 6 | 9 | 11) printf '30' ;;
    2) if (((y % 4 == 0 && y % 100 != 0) || y % 400 == 0)); then printf '29'; else printf '28'; fi ;;
    *) die 64 "月は 1〜12（観測: $m）" ;;
  esac
}

# YYYY-MM-DD が実在する日付か（2026-02-30 を通さない。date は日付をずらして受け付けることがあるため自前で見る）。
valid_date() {
  [[ "$1" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]] || return 1
  local y=$((10#${BASH_REMATCH[1]})) m=$((10#${BASH_REMATCH[2]})) d=$((10#${BASH_REMATCH[3]}))
  [ "$m" -ge 1 ] && [ "$m" -le 12 ] && [ "$d" -ge 1 ] && [ "$d" -le "$(days_in_month "$y" "$m")" ]
}

# YYYY-MM-DD の n か月後の同じ日。同じ日が無い月は、その月の末日（1/31 の 1 か月後は 2/28 か 2/29）。
add_months_clamped() {
  local date="$1" n="$2"
  valid_date "$date" || die 64 "実在する日付ではない（観測: $date）"
  [[ "$n" =~ ^[0-9]+$ ]] || die 64 "月数は整数（観測: $n）"
  [[ "$date" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]]
  local y=$((10#${BASH_REMATCH[1]})) m=$((10#${BASH_REMATCH[2]})) d=$((10#${BASH_REMATCH[3]})) ny nm last
  nm=$(((m - 1 + n) % 12 + 1))
  ny=$((y + (m - 1 + n) / 12))
  last="$(days_in_month "$ny" "$nm")"
  [ "$d" -le "$last" ] || d="$last"
  printf '%04d-%02d-%02d' "$ny" "$nm" "$d"
}

# YYYY-MM-DD の日本時間 0:00 を epoch 秒にする（日本時間に夏時間は無い）。
jst_midnight_epoch() {
  local e
  e="$(jst_date_epoch "$1")"
  printf '%s' "$((e - 9 * 3600))"
}

# YYYY-MM-DD の日本時間 23:59:59 の epoch 秒（請求書の明細の期間の終わりと、支払期限に使う）。
jst_day_end_epoch() {
  local e
  e="$(jst_midnight_epoch "$1")"
  printf '%s' "$((e + 86399))"
}

# 解約の終了日 = 受理日（YYYY-MM-DD）の plans.json の cancellation.notice_months か月後の同じ日
# （同じ日が無い月は末日）。特商法ページの「1 か月後の同じ日」と同じ数え方。
cancel_end_date() {
  local months
  months="$(jq -r '.cancellation.notice_months' "$PLANS")"
  add_months_clamped "$1" "$months"
}

# --- 月の計算（YYYY-MM）。日付の計算は自前で行い、date の解釈の違い（macOS と GNU）に頼らない ---

# YYYY-MM を「0 年 1 月からの月数」にする。
ym_index() {
  [[ "$1" =~ ^([0-9]{4})-(0[1-9]|1[0-2])$ ]] || die 64 "月は YYYY-MM（観測: $1）"
  printf '%s' "$((10#${BASH_REMATCH[1]} * 12 + 10#${BASH_REMATCH[2]} - 1))"
}

# YYYY-MM の n か月後（n は負でもよい）。
ym_add() {
  local i
  i=$(($(ym_index "$1") + $2))
  printf '%04d-%02d' "$((i / 12))" "$((i % 12 + 1))"
}

# YYYY-MM の末日（YYYY-MM-DD）。
month_last_date() {
  ym_index "$1" >/dev/null
  printf '%s-%02d' "$1" "$(days_in_month "$((10#${1:0:4}))" "$((10#${1:5:2}))")"
}

# YYYY-MM-DD の翌日。
next_date() {
  local ym="${1:0:7}" d=$((10#${1:8:2}))
  if [ "$d" -lt "$(days_in_month "$((10#${1:0:4}))" "$((10#${1:5:2}))")" ]; then
    printf '%s-%02d' "$ym" "$((d + 1))"
  else
    printf '%s-01' "$(ym_add "$ym" 1)"
  fi
}

# YYYY-MM 分の請求書の支払期限の日 = 翌月の末日（plans.json の billing.payment_due = end_of_next_month）。
due_date_of_month() {
  month_last_date "$(ym_add "$1" 1)"
}

today_jst() {
  TZ=Asia/Tokyo date '+%Y-%m-%d'
}

# --- 明細の計算（invoice と simulate が同じものを使う） ---

# サービスの金額と名前を plans.json から読む（subshell にしないで呼ぶ）。
# AMT_BASIC = basic の月額、AMT_DEVFEE = 開発費の 1 回分、DEVFEE_MAX = 開発費の回数の上限、
# TERM_MONTHS = 最低利用期間の月数、NAME_BASIC / NAME_DEVFEE = 請求書に出す商品名。どれも税別の円。
load_amounts() {
  local row
  row="$(jq -r --arg s "$1" '
    [.services[] | select(.service == $s)][0] as $v | select($v != null) | . as $r
    | [([$r.prices[] | select(.product == $v.product and .plan == "basic" and .enabled == true)][0].unit_amount_jpy_excl_tax),
       ([$r.prices[] | select(.product == $v.dev_fee_product and .plan == "dev_fee" and .enabled == true)][0] | .unit_amount_jpy_excl_tax, .installments),
       $r.minimum_term.months,
       ([$r.products[] | select(.id == $v.product)][0].name),
       ([$r.products[] | select(.id == $v.dev_fee_product)][0].name)]
    | map(tostring) | join("\t")' "$PLANS")"
  [ -n "$row" ] || die 64 "plans.json に service=$1 が無い"
  IFS=$'\t' read -r AMT_BASIC AMT_DEVFEE DEVFEE_MAX TERM_MONTHS NAME_BASIC NAME_DEVFEE <<<"$row"
  local v
  for v in "$AMT_BASIC" "$AMT_DEVFEE" "$DEVFEE_MAX" "$TERM_MONTHS"; do
    [[ "$v" =~ ^[0-9]+$ ]] || die 2 "plans.json の service=$1 の金額・回数・最低利用期間を読めない（観測: $row）"
  done
}

emit_line() {
  printf '%s\t%s\t%s\t%s\t%s\n' "$@"
}

# 1 サービスの 1 か月分の明細。金額は税別の円で、円未満は切り捨て（README 1C 章の数え方）。
# billing_lines <service> <開始日> <開発費の回数> <終了日（無ければ空）> <請求する月 YYYY-MM>
# 出力は 1 行に 1 明細（タブ区切り）: 種類 金額 期間の初日 期間の末日 説明。開始の月より前と、終了の月より後は何も出さない。
#   usage_first     開始の月の利用料。開始日にかかわらず 1 か月分（billing.first_month = full_month）
#   usage           1 か月分の利用料
#   usage_prorated  終了の月の利用料。終了日までの日割り（cancellation.final_period = prorated）
#   devfee          開発費の 1 回分（開始の月を 1 回目として、契約した回数まで）
#   remaining_usage 終了の月に足す、最低利用期間の残りの期間分の利用料（12 か月分 − 終了日までに請求した利用料、0 未満は 0）
#   remaining_devfee 終了の月に足す、開発費の残りの回数分（1 回分 × (契約した回数 − 終了の月までに請求した回数)）
# 開始の月を 1 か月目と数え、TERM_MONTHS か月目の末日までが最低利用期間。それより後の終了日では、
# 請求済みの利用料が TERM_MONTHS か月分を超えるので、残りの期間分は 0 になる（明細を出さない）。
billing_lines() {
  local service="$1" start="$2" count="$3" end="$4" ym="$5" k k_end="" first last usage d dim rem left
  load_amounts "$service"
  k=$(($(ym_index "$ym") - $(ym_index "${start:0:7}") + 1))
  [ "$k" -ge 1 ] || return 0
  if [ -n "$end" ]; then
    k_end=$(($(ym_index "${end:0:7}") - $(ym_index "${start:0:7}") + 1))
    [ "$k" -le "$k_end" ] || return 0
  fi
  first="$ym-01"
  last="$(month_last_date "$ym")"
  if [ "$k" -eq 1 ]; then
    usage="$AMT_BASIC" # 初月は開始日にかかわらず 1 か月分
    emit_line usage_first "$usage" "$start" "$last" "$NAME_BASIC $ym（初月。1 か月分）"
  elif [ "$k" = "$k_end" ]; then
    d=$((10#${end:8:2}))
    dim="$(days_in_month "$((10#${ym:0:4}))" "$((10#${ym:5:2}))")"
    usage=$((AMT_BASIC * d / dim))
    emit_line usage_prorated "$usage" "$first" "$end" "$NAME_BASIC $ym（終了日 $end まで。$d/$dim 日の日割り）"
  else
    usage="$AMT_BASIC"
    emit_line usage "$usage" "$first" "$last" "$NAME_BASIC $ym"
  fi
  if [ "$k" -le "$count" ]; then
    emit_line devfee "$AMT_DEVFEE" "$first" "$last" "$NAME_DEVFEE $k/$count 回目"
  fi
  [ "$k" = "$k_end" ] || return 0
  rem=$((AMT_BASIC * TERM_MONTHS - (AMT_BASIC * (k - 1) + usage)))
  [ "$rem" -ge 0 ] || rem=0
  if [ "$rem" -ne 0 ]; then
    emit_line remaining_usage "$rem" "$(next_date "$end")" "$(month_last_date "$(ym_add "${start:0:7}" $((TERM_MONTHS - 1)))")" \
      "$NAME_BASIC 残りの期間分（最低利用期間 $TERM_MONTHS か月の残り）"
  fi
  left=$((count - (k < count ? k : count)))
  if [ "$left" -gt 0 ]; then
    emit_line remaining_devfee "$((AMT_DEVFEE * left))" "$(ym_add "$ym" 1)-01" "$(month_last_date "$(ym_add "${start:0:7}" $((count - 1)))")" \
      "$NAME_DEVFEE 残り $left 回（$((k + 1))〜$count 回目）"
  fi
}
