# マニュアル用スクリーンショット

GitHub Actionsから、各ツールの見本画面をまとめて撮影できます。
画像に加えて、画像番号付きの強調表示、切り出し画像、Markdown形式の原稿下書きも同時に生成します。

## GitHub上で撮影する

1. リポジトリの `Actions` を開く
2. `Manual screenshots` を選ぶ
3. `Run workflow` を押す
4. 完了後、実行結果の `Artifacts` から `manual-screenshots` を取得する

成果物には次が含まれます。

- `*.png`: 全画面または部分切り出しの画像
- `capture-report.json`: 撮影結果の一覧
- `manual-draft.md`: マニュアル本文の下書き

## 撮影対象を確認する

`manual/index.html` を開くと、撮影対象、説明、出力画像名、手順文を一覧で確認できます。

## 設定ファイルの考え方

`manual/screenshots.json` に、ページごとの見本シナリオと撮影カットを定義します。

- `tool`: ツール名
- `category`: 分類名
- `path`: 撮影対象URL
- `storage`: 事前に入れる `localStorage` / `sessionStorage`
- `shots`: 出力する画像の定義
  - `name`: 画像ファイル名
  - `title`: 画像タイトル
  - `description`: 画像の説明
  - `selector`: 指定時は部分切り出し、未指定なら全画面
  - `before`: 撮影前に実行する操作
  - `highlights`: 枠線と番号を付ける要素
  - `instructions`: 原稿下書きに入れる手順文

## 利用できる操作

`before` や `after` では次を使えます。

- `click`
- `fill`
- `press`
- `select`
- `check`
- `wait`
- `waitFor`
- `evaluate`

例:

```json
{
  "name": "example-result",
  "title": "検索結果",
  "description": "入力後の検索結果です。",
  "before": [
    { "type": "fill", "selector": "#keyword", "value": "見本" },
    { "type": "click", "selector": "#searchButton" },
    { "type": "wait", "ms": 300 }
  ],
  "selector": "#result",
  "highlights": [
    { "selector": "#keyword", "label": "1" },
    { "selector": "#result", "label": "2" }
  ],
  "instructions": [
    "検索語を入力します。",
    "検索結果を確認します。"
  ]
}
```

## 手元のパソコンで撮影する

Node.js 20以降が必要です。

```bash
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 4173
npm run screenshots
```

画像と原稿下書きは `manual/output/` に保存されます。
