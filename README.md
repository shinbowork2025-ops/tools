# 業務補助ツール PWA版

JAN管理、農薬検索、チェーンソー部品検索、電動工具替刃検索、ホース長さ計算、木材カット図をまとめた静的Webアプリです。基本機能はローカルで完結し、インストール後はオフラインでも利用できます。

## 現在の版

`1.1.5-prototype`

## 主なツール

- JANスキャンメモ
- 農薬適用検索
- チェーンソー部品検索
- 電動工具の替刃・互換検索
- ホース長さ計算
- 木材カット図（試作版）

## 1.1.5の変更

- 版番号付きキャッシュを優先し、同じ版の再起動時に静的ファイルを毎回再取得しない構成へ変更
- JAN一覧のCanvasバーコードを画面付近だけ描画
- JAN-8／JAN-13の正規化とチェックデジット検証を `shared/js/jan-code.js` に集約
- 木材JAN検索を `Map` で索引化し、読取時の全件走査を廃止
- 木材JANの材料連携とカメラ処理を、役割ごとの関数とコメントが分かる形へ整理
- 版番号、キャッシュ対象、HTML参照先、既存の主要処理を確認する検査コマンドを追加

## 構成

- `service-worker.js`: オフラインキャッシュと更新制御
- `shared/js/jan-code.js`: JANの正規化と検証
- `shared/js/ean13.js`: 検索結果用バーコードの遅延表示
- `tools/jan-scanner/js/`: JAN保存、カメラ読取、Canvas描画
- `tools/pesticide-search/js/`: 園芸用データと追加データの段階読込
- `tools/wood-cut-planner/js/`: 木材マスタ、JAN連携、カット計算、画面制御
- `scripts/`: 構成検査、データ生成、主要処理の検査

## 検査

Node.js 20以降で実行します。

```bash
npm run check
```

版番号の一致、Service Workerのキャッシュ対象、HTML内の相対参照、JAN共通処理、JANリスト保存処理、木材カット計算を確認します。

## 保守時の注意

- 公開ファイルを変更した場合は、`version.json`と`service-worker.js`の版番号を同時に更新してください。
- 新しい公開ファイルは `service-worker.js` の `CORE_ASSETS` へ登録し、`npm run check`で存在確認してください。
- 農薬元データを更新した場合は `node scripts/split-pesticide-data.mjs` を実行し、分割ファイルも更新してください。
- 木材商品データは `tools/wood-cut-planner/js/materials.js` で管理し、JAN・寸法・確認日・出典を残してください。

## 動作条件

カメラ、Service Worker、PWAインストールは、原則としてHTTPSまたはlocalhostで動作します。木材カット図は試作版であり、加工前に現物寸法、刃厚、カット順を確認してください。実機カメラ、端末固有のキャッシュ動作、印刷結果は実機での確定が必要です。
