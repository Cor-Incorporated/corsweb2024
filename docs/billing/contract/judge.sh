#!/usr/bin/env bash
# docs/billing/contract/judge.sh — 権利（entitlement）の判定の見本。ADR-0028 の 3 節の判定表を、そのまま 1 か所に書いたもの。
#
# 入力: --services-json <file>  Clerk の組織の public_metadata.services（{"<サービス>": {"from", "until", "hold"}}）
#       --service <名前>        plans.json の services[].service と同じ名前
#       --date YYYY-MM-DD       判定する日（日本時間の今日の日付。日本時間に夏時間は無いので日付だけで決まる）
# 出力: 1 行だけ。open / view_only / read_export_only / closed のどれか。
#
# 判定の順（上から当てて、当てはまった行で決まる。ADR-0028 3 節の表の順）:
#   1. 自分のサービスの行が無い                    → closed
#   2. d が from より前                            → closed
#   3. until があり、d が until の翌日から 30 日以内 → read_export_only（終了日の当日までは開ける）
#   4. until があり、d が until の翌日から 30 日を過ぎた後 → closed
#   5. hold が true                                → view_only（書き込みだけを止める）
#   6. それ以外                                    → open
#
# 30 日は「until の翌日」を 1 日目として数える（until + 30 日が 30 日目）。
# hold が true でも、3 か 4 が先に当たればそちら（hold の行は、それより前の行に当てはまらないときだけ効く）。
#
# 使う道具は jq だけ（date の解釈は macOS と GNU で違うので使わない）。jq の strptime / mktime / todate は UTC で計算するが、
# 日付だけを比べるので、日本時間の日付と同じ順序になる（夏時間が無いため）。実在しない日付（2026-02-30 など）は止める。
#
# 行の形が違うとき（services がオブジェクトでない、行がオブジェクトでない、from / until / hold が
# 実在する日付・真偽値でない）は、判定表に当てる前に closed を 1 行出して exit 0 にする（fail closed）。
# 理由は標準エラーに 1 行だけ出す。exit 64 は「使い方の誤り」（引数・--date・ファイル）にだけ残す。
#
# 終了コード: 0 = 判定した（形の違う行は closed）/ 64 = 使い方の誤り（引数・--date・ファイル。何も判定していない）
set -euo pipefail

SERVICES_JSON=""
SERVICE=""
DATE=""

die() {
  printf 'STOP: %s\n' "$*" >&2
  exit 64
}

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

require_value() {
  [ $# -ge 2 ] || die "$1 に値が無い"
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --services-json) require_value "$@"; SERVICES_JSON="$2"; shift ;;
      --service) require_value "$@"; SERVICE="$2"; shift ;;
      --date) require_value "$@"; DATE="$2"; shift ;;
      -h | --help) usage; exit 0 ;;
      *) usage >&2; die "知らない引数: $1" ;;
    esac
    shift
  done
}

main() {
  local out
  parse_args "$@"
  command -v jq >/dev/null 2>&1 || die "jq が要る"
  [ -n "$SERVICES_JSON" ] || die "--services-json が要る"
  [ -n "$SERVICE" ] || die "--service が要る"
  [ -n "$DATE" ] || die "--date が要る"
  [ -f "$SERVICES_JSON" ] || die "読めないファイル（観測: ${SERVICES_JSON}）"
  jq -e . "$SERVICES_JSON" >/dev/null 2>&1 || die "JSON として読めない（観測: ${SERVICES_JSON}）"

  # 判定は jq だけで行う。形の違う行は "MALFORMED: ..." を返し、下で closed + exit 0 にする。
  # 使い方の誤り（--date）は "STOP: ..." のまま残し、下で exit 64 にする。
  out="$(jq -r --arg service "$SERVICE" --arg date "$DATE" '
    def epoch: . + "T00:00:00Z" | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime;
    def is_ymd:
      (type == "string")
      and test("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")
      and (((epoch | todate)[0:10]) == (.[0:10]));
    def malformed($why): "MALFORMED: " + $why;

    (. | if type == "object" then . else malformed("services が JSON のオブジェクトでない") end) as $sv
    | ($date | if is_ymd then . else "STOP: --date が実在する日付でない（観測: " + ($date | tostring) + "）" end) as $d0
    | if ($sv | type) != "object" then $sv
      elif ($d0 | startswith("STOP:")) then $d0
      else
        ($sv[$service] // null) as $row
        | if $row == null then "closed"
          else
            ($row | if type == "object" then . else malformed("services." + $service + " がオブジェクトでない") end) as $r
            | if ($r | type) != "object" then $r
              else
                (if ($r | has("from")) then $r.from else null end) as $from
                | (if ($r | has("until")) then $r.until else null end) as $until
                | (if ($r | has("hold")) then $r.hold else null end) as $hold
                | if ($from == null) or (($from | is_ymd) | not) then
                    malformed("services." + $service + ".from が実在する日付でない（観測: " + ($from | tostring) + "）")
                  elif ($until != null) and (($until | is_ymd) | not) then
                    malformed("services." + $service + ".until が null でも実在する日付でもない（観測: " + ($until | tostring) + "）")
                  elif ($hold | type) != "boolean" then
                    malformed("services." + $service + ".hold が true か false でない（観測: " + ($hold | tostring) + "）")
                  else
                    ($d0 | epoch) as $dt
                    | ($from | epoch) as $ft
                    | (if $until == null then null else ($until | epoch) end) as $ut
                    | if $dt < $ft then "closed"
                      elif ($ut != null) and ($dt > $ut) and ($dt <= $ut + 2592000) then "read_export_only"
                      elif ($ut != null) and ($dt > $ut + 2592000) then "closed"
                      elif $hold then "view_only"
                      else "open"
                      end
                  end
              end
          end
      end
  ' "$SERVICES_JSON")" || die "判定できなかった（観測: ${SERVICES_JSON}）"

  case "$out" in
    open | view_only | read_export_only | closed) printf '%s\n' "$out" ;;
    "MALFORMED: "*)
      # 形の違う行は閉じる。理由は標準エラーに 1 行だけ出す（判定は exit 0 で返す）。
      printf 'closed\n'
      printf '%s\n' "${out#MALFORMED: }" >&2
      ;;
    "STOP: "*) die "${out#STOP: }" ;;
    *) die "判定の値を読めない（観測: ${out}）" ;;
  esac
}

main "$@"
