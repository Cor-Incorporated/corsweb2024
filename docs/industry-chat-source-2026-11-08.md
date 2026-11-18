# 業種ごとの最初の相談（2026-11-08）

文の状態は言語ごとに持ちます。ja は `page-body-checked-2026-11-13` です。5 業種のページの掲載用本文（issue #525）と 1 文ずつ照らし、本文に無い約束を足していないこと、本文の提供範囲と矛盾しないことを確かめました（本文の締め: 最初は業務の概要だけで足りること、業種ごとに含めないもの、最初に聞くこと）。en は `provisional-2026-11-08` です。ja にそろえた訳で、まだ確かめていません。最初の一文（「〇〇のページから開いています。」）は、画面との照合の目印なので変えません。

## Worker が読む source

完全一致だけを業種にします。

- `industry-medical`
- `industry-shigyo`
- `industry-construction`
- `industry-manufacturing`
- `industry-education`

既知だが業種ではないタグは `corsweb-contact-primary`、`corsweb-launcher`、`corsweb-launcher-fallback`、`cloudia` です。これ以外は、保存用の1行としては残します。モデルへ渡す文には、その文字列を入れません。

最初の返事は業種と intent で変わります。続報の system prompt も、同じ固定文だけを足します。患者の記録、症状、依頼者名、案件の中身、図面、契約書、顧客の仕様、生徒の名前と成績は聞かない、と書いてあります。診断、法律・税務の結論、工期や安全の適合、品質・歩留まり・学習効果の保証はしない、とも書いてあります。営業と判定されても、業種が空でも、その理由だけでは会話を終わらせません。

## Cloudia との照合

Cloudia は、許可した source（上の 5 業種と、`corsweb-contact-primary`・`corsweb-launcher`・`corsweb-launcher-fallback`）だけを Worker に送り、それ以外は `cloudia` に置き換えます。

業種の一覧、一般のタグ、受付の言語の落とし先、最初の一文は、`workers/contact-chat/src/__tests__/fixtures/industry-reception-contract.v1.json` に固定しています。Cloudia の repo も同じ fixture を持ち、両方の試験がそれぞれの値と照らします。片方だけを変えると、どちらかの試験が落ちます。
