# 家計・資産管理ツール

個人用のローカルファーストPWA。スマートフォンを中心に、月次家計・支出・資産残高・dカードCSV・履歴／分析を管理します。細かな日次分類を必須にせず、前月値の再利用と月末更新で入力負担を減らします。

**[アプリを開く](https://omuricezombie.github.io/household-asset-manager/)** · [過去のRelease v0.2.15（初回stable）](https://github.com/omuricezombie/household-asset-manager/releases/tag/v0.2.15) · [QA記録と過去の確認手順](README_HUMAN_QA.txt)

## 現在の状態

| 項目 | 基準 |
| --- | --- |
| 正式版 | **v0.2.35 stable**（2026-11-22時点） |
| main | 正式stable・GitHub Pages配信元（root） |
| candidate | 開発・監査用。v0.2.36-candidate.1で保守監査を実施中（main未反映） |
| 固定rollback | tag / Release `v0.2.16`（現行Notionに記録された固定復旧基準）。過去の `v0.2.15` tag/Releaseも保持 |
| 品質 | v0.2.35はAI QA / Human QA PASS。v0.2.36 candidateは監査中でstable未昇格 |
| 現在の段階 | 実データでの継続使用・評価 |

v0.2.35正式昇格時（2026-11-22）のmain / candidate HEADは `2f247a87f321bec2deb19fc86f3adcf02dbf98a3` でした。現在はcandidateに保守修正があるため、正式版を取得する際はmainかそのcommitを使用してください。最新状態はNotion開発正本とGitHubの実HEADを照合します。

## 実装済みの主な機能

- 現金支出・収入・家賃の入力、月次の収入／支出／貯蓄表示
- 銀行・財布・株式・DC等の月末残高更新、前月値の引き継ぎと「変更なし」確認
- ポイントの別枠管理・項目追加、月末確認と未完了リマインド
- 未加工dカードCSVの端末内解析・登録、ファイル／明細重複除外、カテゴリ・食事区分の確認
- 家族分の立替・返金管理。カード立替はCSV明細から「立替額（家族分）」を設定
- 確認済み財布残高への既知の現金移動の自動反映と再確認表示
- 月次推移・前月比較・カテゴリ／店舗／食費分析、データが揃った場合の直近3か月平均比較
- JSONバックアップ／復元、PWA用manifest・Service Worker、Android/PWAの戻る・終了確認

金融機関との自動連携はありません。銀行→財布・銀行→証券・自口座間などの内部資金移動を登録する専用UIは今後の候補です。ATM引出し等の未登録移動は推測せず、実際の残高で確認します。

## 使い始める

1. 上記の固定HTTPS URLを開き、対象月を選びます。
2. 「月末更新」で必要な資産項目を追加し、残高・ポイントを更新／確認します。前月値がある項目は再利用できます。
3. 「入力」で必要な収入・現金支出等を登録します。dカードCSVは解析結果を確認し、「新規明細を登録」で確定します。カード利用を別途手入力して重複させないでください。
4. 「履歴・分析」で集計を確認し、月末の確認項目を完了します。

主な利用・実機確認環境はAndroidのPWAです。IndexedDB・Service Worker等に対応したモダンブラウザが必要です。AndroidではChromeのメニューから「アプリをインストール」または「ホーム画面に追加」を利用できます（表示名は環境によります）。他OS・全ブラウザの動作保証は行っていません。

### 保存とバックアップ

- 家計データは利用端末・ブラウザのIndexedDB `householdAssetManagerDB_v2` に保存します。`schemaVersion: 2`、正式アプリ版 `0.2.35`。
- CSVは端末内で処理します。家計データをGitHubへ保存・同期する機能や別端末との自動同期はありません。
- 「データ」→「JSONバックアップを保存」で書き出します。復元は同画面の「JSONバックアップを復元」からファイルを選びます。
- 復元は現在のv0.2データをバックアップ内容で置き換えます。形式・schemaVersion・件数・SHA-256整合性を検査し、確認後に復元します。復元前にも現状をバックアップしてください。
- ブラウザのサイトデータ削除等で端末データを失う場合があります。JSONは端末外にも保管し、本番JSONや実CSVをこのPublic repositoryへ登録しないでください。
- 保存はoriginに依存します。固定URLを維持し、更新確認のためのIndexedDB／サイトデータ削除・PWA再インストールは行いません。

## 版管理と復元

| 対象 | 運用 |
| --- | --- |
| main | 正式stable。Human QA未完了版は入れない |
| candidate | 改修・AI QA・必要なHuman QA。stable昇格はPRで確認 |
| tag / Release | 正式版の固定・コード取得基準。既存tagを付け直さない |
| rollback | 対象版の品質・保存データ互換性を確認して使用 |
| 過去のcandidate | 開発履歴。正常動作確認済みstableと同一視しない |

**現行stable v0.2.35の直前stableはv0.2.34（commit `09d5e70a82a1cd73ea77107d041a80ce98573e59`）です。** 固定rollbackはv0.2.16 tag / Releaseを維持します。同じschemaVersionだけで将来版との互換性を保証しません。

コード取得はReleaseの「Source code (zip)」またはGitで行えます。

```sh
git clone https://github.com/omuricezombie/household-asset-manager.git
cd household-asset-manager
git switch --detach v0.2.15
git rev-parse HEAD
# 期待値: 9a19ebcb6f75777d595c95a58749b15f0bac9729
```

これはコードの取得手順です。端末の家計データや本番Pagesを自動復元する操作ではありません。本番復旧時はJSONバックアップを確保し、互換性・Service Worker・静的ファイル一式を確認して、同じPages URLで復旧します。v0.2.35 stableのService Worker cache基準は `household-asset-manager-v0.2.35` です。

## 開発・管理

ルートに`index.html`・JS・CSS・manifest・Service Worker・アイコンを置く静的構成です。独自のActions workflowはなく、Pages標準のビルド／デプロイを利用しています。アプリへの依存追加やビルド手順変更は不要です。

詳細な仕様・判断・QA・ロードマップは開発管理Notionを正本とし、このREADMEには利用と復旧に必要な概要を保持します。Notion本文・個人情報は公開資料へ複製しません。既存QA資料には過去版の手順も含まれるため、冒頭の状態・実施結果を優先してください。

次工程は実データが蓄積した月次家計の品質・カバレッジ確認と、実用性の高い分析・内部資金移動の優先順位検討です。新規機能はcandidateで差分開発とQAを行います。

実CSV・本番JSON・口座情報・秘密情報は登録禁止です。`.gitignore`は誤登録を減らす補助であり、commit前に差分を確認してください。新規commitのauthor / committerはGitHub noreplyアドレスを明示し、生成後の実メタデータを監査します。
