# マニュアル用スクリーンショット

GitHub Actionsから、各ツールのスマートフォン表示をまとめて撮影できます。

## GitHub上で撮影する

1. リポジトリの `Actions` を開く
2. `Manual screenshots` を選ぶ
3. `Run workflow` を押す
4. 完了後、実行結果の `Artifacts` から `manual-screenshots` を取得する

初期設定では、トップ画面と各ツールの初期画面を幅412px・高さ915pxで撮影します。

## 撮影対象を追加する

`manual/screenshots.json` の `pages` に項目を追加します。

```json
{
  "name": "07-example-result",
  "path": "/tools/example/",
  "waitFor": "#result",
  "actions": [
    { "type": "fill", "selector": "#keyword", "value": "見本" },
    { "type": "click", "selector": "#searchButton" },
    { "type": "wait", "ms": 300 }
  ]
}
```

利用できる操作は `click`、`fill`、`select`、`check`、`wait` です。結果画面や入力済み画面も、設定だけで再撮影できます。

## 手元のパソコンで撮影する

Node.js 20以降が必要です。

```bash
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 4173
npm run screenshots
```

画像は `manual/output/` に保存されます。
