# 業種ごとの最初の相談（2026-11-08）

文案は暫定です。定数は `INDUSTRY_COPY_STATUS = provisional-2026-11-08`。最終の文は、本人の壁打ちが来るまで置きません。

## Worker が読む source

完全一致だけを業種にします。

- `industry-medical`
- `industry-shigyo`
- `industry-construction`
- `industry-manufacturing`
- `industry-education`

既知だが業種ではないタグは `corsweb-contact-primary`、`corsweb-launcher`、`corsweb-launcher-fallback`、`cloudia` です。これ以外は、保存用の1行としては残します。モデルへ渡す文には、その文字列を入れません。

最初の返事は業種と intent で変わります。続報の system prompt も、同じ固定文だけを足します。患者の記録、症状、依頼者名、案件の中身、図面、契約書、顧客の仕様、生徒の名前と成績は聞かない、と書いてあります。診断、法律・税務の結論、工期や安全の適合、品質・歩留まり・学習効果の保証はしない、とも書いてあります。営業と判定されても、業種が空でも、その理由だけでは会話を終わらせません。

## Cloudia（7d969c1）との差

Cloudia は変えていません。読んだ範囲では、許可した source だけを Worker に送り、それ以外は `cloudia` に置き換えます。許可リストは上の5業種と `corsweb-contact-primary`、`corsweb-launcher` です。

Worker は、それに加えて `cloudia` と `corsweb-launcher-fallback` を既知のタグとして扱います。`corsweb-launcher-fallback` は、このサイトのランチャーが既に付けています。Cloudia の許可リストには無いので、Cloudia を経由すると `cloudia` になります。Worker を直接呼ぶ場合だけ、fallback の文字が残ります。

Cloudia の画面は、業種の案内を別の文として持っています。Worker の最初の返事も、同じ境界（書かないもの、断定しないこと）を言うようにしました。両方が画面に出ると、案内が2回見えることがあります。どちらかを画面から外すかは Cloudia 側の判断です。このリポジトリでは Cloudia を変えていません。
