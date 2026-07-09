# 業務補助ツール PWA版

JAN管理、農薬検索、チェーンソー部品検索、電動工具替刃検索、ホース長さ計算、木材カット図、発注数計算をまとめた静的Webアプリです。基本機能はローカルで完結し、インストール後はオフラインでも利用できます。現在の版番号は `version.json` を参照してください。

## 主なツール

- JANスキャンメモ
- 農薬適用検索
- チェーンソー部品検索
- 電動工具の替刃・互換検索
- ホース長さ計算
- 木材カット図(試作版)
- 発注数計算 v2(試作版): 定期発注方式ベースの推奨発注数計算とミニFVA記録

## 構成

- `service-worker.js`: オフラインキャッシュと更新制御
- `sw-assets.js`: 各ツールのプリキャッシュ対象一覧
- `version.json`: 現在の版番号と公開日
- `shared/js/jan-code.js`: JANの正規化と検証
- `shared/js/ean13.js`: 検索結果用バーコードの遅延表示
- `shared/js/pwa-client.js`: PWA登録、インストール、更新通知、任意データ保存
- `tools/jan-scanner/js/`: JAN保存、カメラ読取、Canvas描画
- `tools/pesticide-search/js/`: 園芸用データと追加データの段階読込
- `tools/wood-cut-planner/js/`: 木材マスタ、JAN連携、カット計算、画面制御
- `tools/order-calculator/js/`: 発注数計算(純関数の計算モジュール、IndexedDB、画面制御)
- `scripts/`: 構成検査、データ生成、主要処理の検査

## 版管理と更新手順

版番号にはSemantic Versioning(例: `1.0.1`)を使用します。公開ファイルを変更したら、必ず版番号も更新してください。

```bash
node scripts/bump-version.mjs 1.0.1 "農薬データを更新"
npm run check
```

`bump-version.mjs`は次を同時に更新します。

- `service-worker.js`の`APP_VERSION`
- `version.json`
- `CHANGELOG.md`

版番号を変えると新しいキャッシュ名が作られます。利用中の画面は自動で切り替えず、「新版を利用できます」という通知から更新した時点で切り替わります。切替後に旧版キャッシュを削除します。

### 版番号の目安

- PATCH(`1.0.0` → `1.0.1`): 誤記修正、データ更新、小さな不具合修正
- MINOR(`1.0.0` → `1.1.0`): 後方互換性を保った機能追加
- MAJOR(`1.0.0` → `2.0.0`): 保存形式や操作方法に互換性がない変更

## 検査

Node.js 20以降で実行します。

```bash
npm run check
```

版番号の一致、Service Workerのキャッシュ対象、HTML内の相対参照、JAN共通処理、JANリスト保存処理、木材カット計算、発注数計算を確認します。

## 保守時の注意

- 公開ファイルを変更した場合は、`version.json`と`service-worker.js`の版番号を同時に更新してください(`bump-version.mjs`を使用)。
- 新しい公開ファイルは `service-worker.js` の `CORE_ASSETS`(実体は `sw-assets.js` の `KOMERI_EXTRA_CORE_ASSETS`)へ登録し、`npm run check`で存在確認してください。
- 農薬元データを更新した場合は `node scripts/split-pesticide-data.mjs` を実行し、分割ファイルも更新してください。
- 木材商品データは `tools/wood-cut-planner/js/materials.js` で管理し、JAN・寸法・確認日・出典を残してください。
- 販売実績・マザー発注数などの業務数値、社内限定情報、個人情報、認証情報はリポジトリへ配置しないでください。発注数計算の業務データはすべて実行時入力→端末内保存(IndexedDB)です。

## 動作条件

カメラ、Service Worker、PWAインストールは、原則としてHTTPSまたはlocalhostで動作します。カメラ読取は`BarcodeDetector`対応ブラウザ(Android版Chrome等)が必要で、非対応ブラウザでは手入力になります。木材カット図・発注数計算は試作版です。このサイトは個人制作物であり、所属企業やメーカーの公式サービスではありません。
