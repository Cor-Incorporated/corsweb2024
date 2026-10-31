# cor-jp.com のブログ記事を新しく書いて、公開の準備をするまで

この手順書は cor-jp.com に新しいブログ記事を書く新入スタッフ向けです。記事を書き、公開の準備が整うまでを扱います。merge と公開は代表が行います。

コマンドの実行が必要な場面は、エンジニアに依頼してください。

## 記事を書く方法

記事は管理画面（Sveltia CMS、https://cor-jp-cms-admin.web.app/）で書きます。エンジニアは CMS を使わずに `src/content/blog/ja/<記事名>.md` を直接作ってもかまいません。エンジニア以外は CMS を使ってください。

## 手順

1. 管理画面（Sveltia CMS、https://cor-jp-cms-admin.web.app/）を開きます。

2. 管理画面で、新しいブログ記事を作ります。

3. 記事の設定項目（frontmatter）を入力します。

   | 項目 | 入力する内容 |
   | --- | --- |
   | title | 記事のタイトル |
   | description | 記事の説明。空にしない |
   | pubDate | 公開日 |
   | category | `ai`、`engineering`、`founder`、`lab` のどれか |
   | tags | タグ |
   | author | `"Terisuke"` |
   | lang | `"ja"` |
   | summary | 任意。2〜3 文。記事の上の「この記事の要点」に出る |
   | image | 任意。画像 |

   summary と image は任意です。description は空にしないでください。category は `ai`、`engineering`、`founder`、`lab` から選びます。

4. 本文を書きます。

5. 記事の最後に `## 参考資料` という見出しを作り、その下に出典をリンクの箇条書きで置きます。

6. 本文の決まりを確認します。

   本文に営業の誘い文句を入れません。

   ISMS について書くときは、次の内容までにします。

   「2026年10月に ISO/IEC 27001 の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいる」

   「取得済み」とは書きません。

7. 記事を保存します。保存すると、develop 向けの PR ができます。

   その PR には、CI が英語・中国語・韓国語・スペイン語の訳を作って足します。訳のファイルは手で直しません。

8. 記事のファイルに対して、文言の検査を実行します。

   ```
   npm run blog:check -- src/content/blog/ja/<記事名>.md
   ```

   `<記事名>` は、記事のファイル名に置き換えます。指摘があれば直します。

9. 推敲の検査を行います。まず、次を実行します。

   ```
   npm run polish -- prepare --file <記事>
   ```

   その結果を参考に、記事を書き直します。書き直したら、元の記事とは別のファイルに最終稿を保存します。次に、最終稿を確認します。

   ```
   npm run polish -- check --file <記事> --final <最終稿>
   ```

   `<記事>` は元の記事のファイル、`<最終稿>` は最終稿のファイルに置き換えます。指摘があれば直し、もう一度確認します。

10. build を確認します。次を実行します。

    ```
    npm run build
    ```

    build が通ることを確かめます。frontmatter が間違っていると、ここで落ちます。通らないときは、frontmatter を見直してから、もう一度実行してください。

11. merge と公開は代表に任せます。

    ここまでできたら、公開の準備は完了です。develop から main へのリリースで本番に出ます。

## 公開の準備のチェックリスト

- [ ] title、description、pubDate、category、tags、author、lang を入力した
- [ ] description が空でない
- [ ] category が `ai`、`engineering`、`founder`、`lab` のどれか
- [ ] summary を付ける場合は 2〜3 文にした
- [ ] 出典を最後の `## 参考資料` にリンクの箇条書きで置いた
- [ ] 本文に営業の誘い文句がない
- [ ] ISMS の記述を、決められた範囲に収めた
- [ ] `npm run blog:check` を実行し、指摘を直した
- [ ] `npm run polish -- prepare` と `npm run polish -- check` を実行し、指摘を直した
- [ ] `npm run build` が通った
- [ ] 訳のファイルを手で直していない
- [ ] merge と公開を自分で行わない
