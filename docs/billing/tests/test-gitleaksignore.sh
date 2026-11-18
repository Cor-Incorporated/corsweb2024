#!/usr/bin/env bash
# shellcheck disable=SC2015 # 「A が成り立てば ok、そうでなければ ng」の形。ok は必ず 0 を返すので、A が成り立ったときに ng は走らない（結果の報告だけに使う）
# リポジトリ直下の .gitleaksignore の検査。gitleaks も通信も使わない（git の履歴と jq だけ）。
# 実行: bash docs/billing/tests/test-gitleaksignore.sh
# 確かめること:
#   1. 除く検出は docs/billing/plans.json の税率の識別子と、
#      workers/contact-chat/src/__tests__/storage.test.ts の試験の冪等の key と、
#      workers/contact-chat/src/__tests__/case-sync.test.ts の試験専用トークンの
#      SHA256 定数の generic-api-key だけ（ほかのファイルや規則を除かない）
#   2. 除く commit がこのリポジトリの履歴にある
#   3. 除く行の中身が、どれも秘密でないと分かる形である
#      （plans.json は今の tax_rate.id と同じ値、storage は試験の作り物の値、
#      case-sync は同じ commit の FIXTURE_TOKEN の SHA256）。
#      plans.json と storage は、行の中身が違えば期待と観測の両方を出して落ちる。
#      case-sync の失敗報告ではトークンとハッシュの値は出さない。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
IGNORE="${GITLEAKSIGNORE:-$ROOT/.gitleaksignore}"
PLANS="$ROOT/docs/billing/plans.json"
IDEMPOTENCY_PATH="workers/contact-chat/src/__tests__/storage.test.ts"
CASE_SYNC_PATH="workers/contact-chat/src/__tests__/case-sync.test.ts"
FIXTURE_PREFIX="TEST_ONLY_NOT_A_SECRET_"
# 期待する行は key 名と値に分けて持ち、検査の file 自身が秘密と見なされない形にする
IDEMPOTENCY_FIELD="idempotencyKey"
IDEMPOTENCY_VALUE="idempotency-1"
IDEMPOTENCY_LINE="${IDEMPOTENCY_FIELD}: '${IDEMPOTENCY_VALUE}',"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }

[ -f "$IGNORE" ] || { printf 'FAIL .gitleaksignore が無い: %s\n' "$IGNORE"; exit 1; }
want="$(jq -r '.tax_rate.id' "$PLANS")"
if printf '%s' "$want" | grep -Eq '^[a-z0-9_]+$'; then
  ok "plans.json の tax_rate.id は識別子の形（観測: ${want}）"
else
  ng "plans.json の tax_rate.id が識別子の形でない（観測: ${want}）"
fi

entries=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in '' | '#'*) continue ;; esac
  entries=$((entries + 1))
  IFS=: read -r commit path rule lineno extra <<<"$line"
  [ -z "${extra:-}" ] && [ -n "${lineno:-}" ] || { ng "fingerprint の形が commit:path:rule:line でない（観測: ${line}）"; continue; }
  [ "$rule" = "generic-api-key" ] && ok "$commit の規則は generic-api-key" || ng "$commit の規則が generic-api-key でない（観測: ${rule}）"
  if ! git -C "$ROOT" cat-file -e "$commit^{commit}" 2>/dev/null; then
    ng "$commit が履歴に無い"
    continue
  fi
  ok "$commit は履歴にある"
  got="$(git -C "$ROOT" show "$commit:$path" | sed -n "${lineno}p")"
  case "$path" in
  docs/billing/plans.json)
    if printf '%s\n' "$got" | grep -Eq "^[[:space:]]*\"[a-z_]+\": \"${want}\",?$"; then
      ok "$commit の $lineno 行目は税率の識別子（${want}）"
    else
      ng "$commit の $lineno 行目が税率の識別子でない（期待: \"…\": \"$want\" 観測: ${got}）"
    fi
    ;;
  "$IDEMPOTENCY_PATH")
    trimmed="${got#"${got%%[![:space:]]*}"}"
    if [ "$trimmed" = "$IDEMPOTENCY_LINE" ]; then
      ok "$commit の $lineno 行目は試験の冪等の key（作り物の値）"
    else
      ng "$commit の $lineno 行目が試験の冪等の key でない（期待: $IDEMPOTENCY_LINE 観測: ${got}）"
    fi
    ;;
  "$CASE_SYNC_PATH")
    if ! printf '%s\n' "$got" | grep -Eq "^const FIXTURE_TOKEN_SHA256 = '[0-9a-f]{64}';$"; then
      ng "$commit の $lineno 行目が試験専用トークンの SHA256 定数の形でない（const FIXTURE_TOKEN_SHA256 = '<64桁hex>';）"
    else
      n_token="$(git -C "$ROOT" show "$commit:$path" | grep -c '^const FIXTURE_TOKEN = ' || true)"
      token="$(git -C "$ROOT" show "$commit:$path" | sed -n "s/^const FIXTURE_TOKEN = '\\(.*\\)';$/\\1/p")"
      if [ "$n_token" -ne 1 ] || [ -z "$token" ]; then
        ng "$commit に FIXTURE_TOKEN 定数が 1 件で取れない（観測: ${n_token} 件）"
      elif [ "${#token}" -ne 50 ] || [ "${token#"$FIXTURE_PREFIX"}" = "$token" ]; then
        ng "$commit の FIXTURE_TOKEN が試験専用の形でない（接頭辞 TEST_ONLY_NOT_A_SECRET_、長さ 50）"
      else
        got_hash=""
        if [[ "$got" =~ ^const\ FIXTURE_TOKEN_SHA256\ =\ \'([0-9a-f]{64})\'\;$ ]]; then
          got_hash="${BASH_REMATCH[1]}"
        fi
        want_hash="$(printf '%s' "$token" | shasum -a 256 | cut -d ' ' -f1)"
        if [ -n "$got_hash" ] && [ "$got_hash" = "$want_hash" ]; then
          ok "$commit の $lineno 行目は試験専用トークンの SHA256 定数（同じ commit の FIXTURE_TOKEN と一致）"
        else
          ng "$commit の $lineno 行目の SHA256 が同じ commit の FIXTURE_TOKEN と一致しない"
        fi
      fi
    fi
    ;;
  *)
    ng "$commit の対象が想定の file でない（観測: ${path}）"
    ;;
  esac
done <"$IGNORE"

[ "$entries" -eq 3 ] && ok ".gitleaksignore の検出は $entries 件" || ng ".gitleaksignore の検出が 3 件でない（観測: ${entries} 件）"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
