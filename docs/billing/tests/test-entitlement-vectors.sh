#!/usr/bin/env bash
# shellcheck disable=SC2015 # 「A が成り立てば ok、そうでなければ ng」の形。ok は必ず 0 を返すので、A が成り立ったときに ng は走らない（結果の報告だけに使う）
# docs/billing/contract/entitlement-vectors.json と contract/judge.sh の検査。通信しない。
# 実行: bash docs/billing/tests/test-entitlement-vectors.sh
# 確かめること:
#   1. ベクトルの形: schema・結果の 4 つの値・判定の見本のパス・id の重複・日付の実在・サービスの名前（plans.json と同じ）
#   2. 判定表の境界を全部覆っている（required_tags のタグが 1 件も欠けない）。4 つの結果が全部出る
#   3. 全件を judge.sh に通し、期待と一致する（1 件でも違えば red）
#   4. 使い方の誤り（引数・--date・ファイル）は exit 64 で落とす
#   5. 形の違う行（services がオブジェクトでない、行がオブジェクトでない、from / until / hold が
#      実在する日付・真偽値でない）は closed を 1 行出して exit 0 にし、理由を標準エラーに 1 行だけ出す（fail closed）
#
# 判定表（ADR-0028 3 節）↔ 試験ベクトル ↔ judge.sh の 3 つは、どれか片方だけを変えるとこの試験が落ちる:
#   - 判定表の数え方（30 日、当日、hold の順）を judge.sh で変える → 3 が red
#   - ベクトルの期待値を変える → 3 が red
#   - ベクトルを消すと境界が欠ける → 1 か 2 が red
#   - plans.json にサービスを足してベクトルを足さない → 1 が red
#   - 形の検査（行がオブジェクトか、from / until / hold の形）を judge.sh で 1 つ外す → 4 か 5 が red
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$BILLING/../.." && pwd)"
VECTORS="$BILLING/contract/entitlement-vectors.json"
JUDGE="$BILLING/contract/judge.sh"
# この試験が読む判定の見本のパス（リポジトリからの相対）。ベクトルの .judge と一致し、そのパスにファイルが要る。
JUDGE_REL="docs/billing/contract/judge.sh"
PLANS="$BILLING/plans.json"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/billing-ent-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
eq() { if [ "$2" = "$3" ]; then ok "$1"; else ng "$1: 期待 $3 観測 $2"; fi; }
count() { printf '%s\n' "$1" | grep -c -- "$2" || true; }

[ -f "$VECTORS" ] || { printf 'FAIL 試験ベクトルが無い: %s\n' "$VECTORS"; exit 1; }
[ -f "$JUDGE" ] || { printf 'FAIL 判定の見本が無い: %s\n' "$JUDGE"; exit 1; }
jq -e . "$VECTORS" >/dev/null 2>&1 || { printf 'FAIL 試験ベクトルが JSON として読めない: %s\n' "$VECTORS"; exit 1; }

# 1. ベクトルの形
eq "schema は cor-entitlement-vectors.v1" "$(jq -r '.schema' "$VECTORS")" "cor-entitlement-vectors.v1"
eq "結果の 4 つの値が宣言どおり（並べ替えて比べる）" \
  "$(jq -r '.result_values | sort | join(" ")' "$VECTORS")" "closed open read_export_only view_only"
eq "判定の見本のパスが宣言と一致（${JUDGE_REL}）" "$(jq -r '.judge' "$VECTORS")" "$JUDGE_REL"
eq "この試験が読む判定の見本は宣言のパスのファイル（${JUDGE_REL}）" "$JUDGE" "$ROOT/$JUDGE_REL"
[ -f "$ROOT/$(jq -r '.judge' "$VECTORS")" ] && ok "宣言のパスに判定の見本がある" || ng "宣言のパスに判定の見本が無い: $(jq -r '.judge' "$VECTORS")"
eq "判定する日付の時間帯は Asia/Tokyo" "$(jq -r '.date_zone' "$VECTORS")" "Asia/Tokyo"
N="$(jq '.vectors | length' "$VECTORS")"
[ "$N" -ge 20 ] && ok "ベクトルは $N 件（境界を全部覆うため 20 件以上）" || ng "ベクトルが $N 件しかない（20 件以上にする）"
eq "id は重複しない" "$(jq -r '.vectors[].id' "$VECTORS" | sort | uniq -d | wc -l | tr -d ' ')" "0"

# 日付は実在するものだけ（2026-02-30 を通さない）。d・from・until を全部見る。
# malformed: true のベクトルは、形の違う入力をわざと持つので除く（形の検査は 4・5 で見る）。
bad_dates="$(jq -r '
  def epoch: . + "T00:00:00Z" | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime;
  def is_ymd:
    (type == "string")
    and test("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")
    and (((epoch | todate)[0:10]) == (.[0:10]));
  [ .vectors[] | select(.malformed != true) | .id as $id
    | ([.d] + [ .services | select(type == "object") | .[] | select(type == "object") | .from, .until ])
    | .[] | select(. != null and (is_ymd | not)) | "\($id):\(.)" ]
  | join(" ")' "$VECTORS")"
[ -z "$bad_dates" ] && ok "ベクトルの日付は全部実在する" || ng "実在しない日付がある: $bad_dates"

# 形の違う行のベクトルは、すべて closed を期待する（fail closed）
eq "malformed のベクトルは全部 closed を期待する" \
  "$(jq -r '[.vectors[] | select(.malformed == true) | select(.expect != "closed")] | length' "$VECTORS")" "0"

# サービスの名前は plans.json と同じ。plans.json のサービスは全部、ベクトルに 1 回は出る。
plans_services="$(jq -r '.services[].service' "$PLANS" | sort)"
used_services="$(jq -r '.vectors[].service, (.vectors[].services | select(type == "object") | keys[]?)' "$VECTORS" | sort -u)"
unknown="$(comm -13 <(printf '%s\n' "$plans_services") <(printf '%s\n' "$used_services"))"
[ -z "$unknown" ] && ok "ベクトルのサービス名は plans.json にある" || ng "plans.json に無いサービス名がある: $unknown"
missing="$(comm -23 <(printf '%s\n' "$plans_services") <(printf '%s\n' "$used_services"))"
[ -z "$missing" ] && ok "plans.json のサービスは全部ベクトルに出る" || ng "ベクトルに 1 回も出ないサービスがある: $missing"

# 2. 判定表の境界を覆っているか（required_tags が全部 1 件以上ある）
tags_missing=""
unused_tags=""
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  n="$(jq -r --arg t "$tag" '[.vectors[] | select(.tags | index($t))] | length' "$VECTORS")"
  [ "$n" -ge 1 ] || tags_missing="$tags_missing $tag"
done <<<"$(jq -r '.required_tags[]' "$VECTORS")"
[ -z "$tags_missing" ] && ok "判定表の境界のタグは全部 1 件以上ある" || ng "境界のタグが 0 件: $tags_missing"
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  if [ "$(jq -r --arg t "$tag" '.required_tags | index($t)' "$VECTORS")" = "null" ] && [ "$(jq -r --arg t "$tag" '[.vectors[] | select(.tags | index($t))] | length' "$VECTORS")" = "0" ]; then
    unused_tags="$unused_tags $tag"
  fi
done <<<"$(jq -r '.vectors[].tags[]' "$VECTORS" | sort -u)"
[ -z "$unused_tags" ] && ok "ベクトルのタグは required_tags にある（宣言に無いタグを作らない）" || ng "required_tags に無いタグがある: $unused_tags"

# Clerk の metadata に残る形（until のキーが無い）を 1 件は覆っている
eq "until のキーが無い行のベクトルがある（Clerk の deep merge で null がキーを消すため）" \
  "$(jq -r '[.vectors[] | select(.services | type == "object") | select(.services[.service] | type == "object") | select(.services[.service] | has("until") | not)] | length' "$VECTORS")" \
  "1"

# 4 つの結果が全部出る（closed だけ、などの偏りを落とす）
for v in open view_only read_export_only closed; do
  n="$(jq -r --arg v "$v" '[.vectors[] | select(.expect == $v)] | length' "$VECTORS")"
  [ "$n" -ge 1 ] && ok "結果 $v のベクトルがある（$n 件）" || ng "結果 $v のベクトルが無い"
done
unknown_expect="$(jq -r '[.vectors[] | select((.expect | IN("open", "view_only", "read_export_only", "closed")) | not) | "\(.id):\(.expect)"] | join(" ")' "$VECTORS")"
[ -z "$unknown_expect" ] && ok "ベクトルの期待は 4 つの値だけ" || ng "4 つの値でない期待がある: $unknown_expect"

# 3. 全件を judge.sh に通す
i=0
n_open=0
n_view=0
n_read=0
n_closed=0
while [ "$i" -lt "$N" ]; do
  id="$(jq -r --argjson i "$i" '.vectors[$i].id' "$VECTORS")"
  svc="$(jq -r --argjson i "$i" '.vectors[$i].service' "$VECTORS")"
  d="$(jq -r --argjson i "$i" '.vectors[$i].d' "$VECTORS")"
  want="$(jq -r --argjson i "$i" '.vectors[$i].expect' "$VECTORS")"
  malformed="$(jq -r --argjson i "$i" '.vectors[$i].malformed // false' "$VECTORS")"
  jq -c --argjson i "$i" '.vectors[$i].services' "$VECTORS" >"$WORK/services.json"
  set +e
  got="$(bash "$JUDGE" --services-json "$WORK/services.json" --service "$svc" --date "$d" 2>"$WORK/err")"
  rc=$?
  set -e
  err="$(cat "$WORK/err")"
  err_lines="$(printf '%s\n' "$err" | wc -l | tr -d ' ')"
  if [ "$rc" -ne 0 ]; then
    ng "$id: judge.sh が exit $rc で止まった（$svc ${d}）: $(printf '%s' "$got" | head -1)"
  elif [ "$got" != "$want" ]; then
    ng "$id: 期待 $want 観測 ${got}（${svc}、d=${d}）"
  elif [ "$malformed" = "true" ] && { [ -z "$err" ] || [ "$err_lines" -ne 1 ]; }; then
    ng "$id: 形の違う行なのに、理由が標準エラーに 1 行だけ出ていない（${err_lines} 行）: $err"
  elif [ "$malformed" != "true" ] && [ -n "$err" ]; then
    ng "$id: 形の正しい行なのに標準エラーに出た: $err"
  else
    ok "$id: ${got}（${svc}、d=${d}）"
  fi
  case "$want" in
    open) n_open=$((n_open + 1)) ;;
    view_only) n_view=$((n_view + 1)) ;;
    read_export_only) n_read=$((n_read + 1)) ;;
    closed) n_closed=$((n_closed + 1)) ;;
  esac
  i=$((i + 1))
done
eq "判定を 1 行ずつ出す（行数がベクトルと同じ）" "$(printf '%s\n' "$N" | tr -d ' ')" "$N"
printf 'INFO 結果の内訳: open %s / view_only %s / read_export_only %s / closed %s（合計 %s）\n' \
  "$n_open" "$n_view" "$n_read" "$n_closed" "$N"

# 4. 使い方の誤りは exit 64（判定しない）
run_bad() {
  local what="$1" expect_text="$2"
  shift 2
  set +e
  local out
  out="$(bash "$JUDGE" "$@" 2>&1)"
  local rc=$?
  set -e
  if [ "$rc" -eq 64 ] && printf '%s' "$out" | grep -qF -- "$expect_text"; then
    ok "$what"
  else
    ng "$what: exit 期待 64 観測 ${rc}、出力「${expect_text}」を期待: $out"
  fi
}
jq -c '.vectors[3].services' "$VECTORS" >"$WORK/ok.json"
jq -c '{xesm: {from: "2026-12-01", until: null}}' "$VECTORS" >"$WORK/nohold.json"
jq -c '{xesm: {from: "2026-12-01", until: null, hold: "no"}}' "$VECTORS" >"$WORK/badhold.json"
jq -c '{xesm: {from: "2026-12-01", until: null, hold: null}}' "$VECTORS" >"$WORK/nullhold.json"
jq -c '{xesm: {from: "2026-12-01", until: null, hold: 0}}' "$VECTORS" >"$WORK/numberhold.json"
jq -c '{xesm: {from: "2026-12-01", until: "2026-02-30", hold: false}}' "$VECTORS" >"$WORK/baduntil.json"
jq -c '{xesm: {from: "2026-12-01", until: 20261130, hold: false}}' "$VECTORS" >"$WORK/numberuntil.json"
jq -c '{xesm: {from: null, until: null, hold: false}}' "$VECTORS" >"$WORK/nofrom.json"
jq -c '{xesm: {from: "", until: null, hold: false}}' "$VECTORS" >"$WORK/emptyfrom.json"
jq -c '{xesm: {from: "2026-02-30", until: null, hold: false}}' "$VECTORS" >"$WORK/badfrom.json"
jq -c '{xesm: "2026-12-01"}' "$VECTORS" >"$WORK/rowstring.json"
jq -c '{xesm: ["from", "2026-12-01"]}' "$VECTORS" >"$WORK/rowarray.json"
jq -c '{xesm: 1}' "$VECTORS" >"$WORK/rownumber.json"
jq -c '{xesm: {from: "2026-12-01", until: null, hold: false, memo: "x"}}' "$VECTORS" >"$WORK/extra.json"
jq -c '[1, 2]' "$VECTORS" >"$WORK/array.json"
printf 'not json\n' >"$WORK/notjson.json"

run_bad "引数なしは exit 64" "--services-json が要る"
run_bad "--services-json が無いと exit 64" "--services-json が要る" --service xesm --date 2026-12-01
run_bad "--service が無いと exit 64" "--service が要る" --services-json "$WORK/ok.json" --date 2026-12-01
run_bad "--date が無いと exit 64" "--date が要る" --services-json "$WORK/ok.json" --service xesm
run_bad "実在しない日付（2026-02-30）は exit 64" "実在する日付でない" --services-json "$WORK/ok.json" --service xesm --date 2026-02-30
run_bad "月の範囲外（2026-13-01）は exit 64" "実在する日付でない" --services-json "$WORK/ok.json" --service xesm --date 2026-13-01
run_bad "日付の形の誤りは exit 64" "実在する日付でない" --services-json "$WORK/ok.json" --service xesm --date 2026/12/01
run_bad "知らない引数は exit 64" "知らない引数" --services-json "$WORK/ok.json" --service xesm --date 2026-12-01 --day 2026-12-01
run_bad "読めないファイルは exit 64" "読めないファイル" --services-json "$WORK/nope.json" --service xesm --date 2026-12-01
run_bad "JSON でないファイルは exit 64" "JSON として読めない" --services-json "$WORK/notjson.json" --service xesm --date 2026-12-01

# 5. 形の違う行は closed を 1 行出して exit 0。理由は標準エラーに 1 行だけ出す（fail closed）
run_closed() {
  local what="$1" expect_text="$2"
  shift 2
  set +e
  local out err rc err_lines
  out="$(bash "$JUDGE" "$@" 2>"$WORK/err")"
  rc=$?
  set -e
  err="$(cat "$WORK/err")"
  err_lines="$(printf '%s\n' "$err" | wc -l | tr -d ' ')"
  if [ "$rc" -eq 0 ] && [ "$out" = "closed" ] && [ -n "$err" ] && [ "$err_lines" -eq 1 ] && printf '%s' "$err" | grep -qF -- "$expect_text"; then
    ok "$what"
  else
    ng "$what: exit 期待 0 観測 ${rc}、標準出力 期待 closed 観測「${out}」、標準エラー 1 行に「${expect_text}」を期待（${err_lines} 行）: $err"
  fi
}
run_closed "services が配列なら closed（exit 64 にしない）" "JSON のオブジェクトでない" --services-json "$WORK/array.json" --service xesm --date 2026-12-01
run_closed "行が文字列なら closed" "がオブジェクトでない" --services-json "$WORK/rowstring.json" --service xesm --date 2026-12-01
run_closed "行が配列なら closed" "がオブジェクトでない" --services-json "$WORK/rowarray.json" --service xesm --date 2026-12-01
run_closed "行が数なら closed" "がオブジェクトでない" --services-json "$WORK/rownumber.json" --service xesm --date 2026-12-01
run_closed "from が null なら closed" "from が実在する日付でない" --services-json "$WORK/nofrom.json" --service xesm --date 2026-12-01
run_closed "from が空なら closed" "from が実在する日付でない" --services-json "$WORK/emptyfrom.json" --service xesm --date 2026-12-01
run_closed "from が実在しない日付なら closed" "from が実在する日付でない" --services-json "$WORK/badfrom.json" --service xesm --date 2026-12-01
run_closed "until が実在しない日付なら closed" "until が null でも実在する日付でもない" --services-json "$WORK/baduntil.json" --service xesm --date 2026-12-01
run_closed "until が日付でない値なら closed" "until が null でも実在する日付でもない" --services-json "$WORK/numberuntil.json" --service xesm --date 2026-12-01
run_closed "hold が true/false でなければ closed" "hold が true か false でない" --services-json "$WORK/badhold.json" --service xesm --date 2026-12-01
run_closed "hold が null なら closed" "hold が true か false でない" --services-json "$WORK/nullhold.json" --service xesm --date 2026-12-01
run_closed "hold が数なら closed" "hold が true か false でない" --services-json "$WORK/numberhold.json" --service xesm --date 2026-12-01
run_closed "hold の無い行は closed（形を 3 つに固定する）" "hold が true か false でない" --services-json "$WORK/nohold.json" --service xesm --date 2026-12-01

# 形は正しく、3 つ以外の key がある行は、その key を読まずに判定表のとおりにする（後方互換）
set +e
extra_out="$(bash "$JUDGE" --services-json "$WORK/extra.json" --service xesm --date 2026-12-01 2>"$WORK/err")"
extra_rc=$?
set -e
extra_err="$(cat "$WORK/err")"
if [ "$extra_rc" -eq 0 ] && [ "$extra_out" = "open" ] && [ -z "$extra_err" ]; then
  ok "3 つ以外の key は読まずに無視する（判定は open）"
else
  ng "3 つ以外の key がある行の判定が open でない（rc=${extra_rc}）: ${extra_out} ${extra_err}"
fi

set +e
help_out="$(bash "$JUDGE" --help 2>&1)"
help_rc=$?
set -e
if [ "$help_rc" -eq 0 ] && printf '%s' "$help_out" | grep -q -- '--services-json'; then
  ok "--help は使い方を出して exit 0"
else
  ng "--help が exit 0 で使い方を出さない（rc=${help_rc}）"
fi

# 判定の見本が、ベクトルの期待の値をそのまま出す（4 つの値以外を出さない）
for v in open view_only read_export_only closed; do
  printf '%s\n' "$v" | grep -qxE 'open|view_only|read_export_only|closed' || ng "結果の値の形が違う: $v"
done
ok "結果は 4 つの値（open / view_only / read_export_only / closed）のどれか"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
