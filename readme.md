# 業務補助ツール（GitHub Pages・PWA版）

静的なHTML・CSS・JavaScriptだけで動作するツール集です。GitHub Pagesへ配置すると、Progressive Web App（PWA）として端末へインストールできます。ビルド処理や外部パッケージは不要です。

## 公開方法

1. このフォルダーの**中身**をGitHubの公開リポジトリへアップロードします。
2. リポジトリの **Settings → Pages** を開きます。
3. **Deploy from a branch**、`main`、`/(root)` を選択します。
4. 表示されたHTTPSの公開URLをAndroid版Chromeなどで開きます。
5. トップ画面の「端末にインストール」またはブラウザメニューの「アプリをインストール」を使用します。

カメラ、Service Worker、PWAインストールは、原則としてHTTPSまたはlocalhostで動作します。端末内のHTMLファイルを直接開く方法では利用できません。

## オフライン動作

- トップ画面、JANスキャン、ホース計算、電動工具検索、チェーンソー検索の必要ファイルはPWA登録時に保存します。
- 約29 MBの農薬データは、トップ画面の「オフライン用データを保存」を押した端末だけに保存します。
- PWAが有効な状態で農薬検索をオンラインで開いた場合も、その版のデータがキャッシュされます。
- 新版へ更新すると旧版キャッシュは削除されます。農薬データを完全オフラインで使う端末では、更新後に再度保存してください。

## 版管理と更新手順

版番号にはSemantic Versioning（例：`1.0.1`）を使用します。公開内容を変更したら、必ず版番号も更新してください。

```bash
node scripts/bump-version.mjs 1.0.1 "農薬データを更新"
node scripts/check-js.mjs
node scripts/check-pwa.mjs
```

`bump-version.mjs`は次を同時に更新します。

- `service-worker.js`の`APP_VERSION`
- `version.json`
- `CHANGELOG.md`

版番号を変えると新しいキャッシュ名が作られます。利用中の画面は自動で切り替えず、「新版を利用できます」という通知から更新した時点で切り替わります。切替後に旧版キャッシュを削除します。

### 版番号の目安

- PATCH（`1.0.0` → `1.0.1`）：誤記修正、データ更新、小さな不具合修正
- MINOR（`1.0.0` → `1.1.0`）：後方互換性を保った機能追加
- MAJOR（`1.0.0` → `2.0.0`）：保存形式や操作方法に互換性がない変更

## 構成

- `index.html`: ツール一覧とPWA管理画面
- `manifest.webmanifest`: アプリ名、起動先、アイコンなど
- `service-worker.js`: オフラインキャッシュ、更新制御、旧キャッシュ削除
- `version.json`: 現在の版番号と公開日
- `CHANGELOG.md`: 更新履歴
- `icons/`: PWA・ホーム画面用アイコン
- `assets/`: 一覧画面のスタイル
- `shared/js/pwa-client.js`: PWA登録、インストール、更新通知、任意データ保存
- `shared/js/ean13.js`: 検索ツール共通のJAN（EAN-13）描画
- `tools/`: 各ツール本体
- `scripts/check-js.mjs`: JavaScript構文検査
- `scripts/check-pwa.mjs`: PWA設定・キャッシュ対象・版番号の整合性検査
- `scripts/bump-version.mjs`: 版番号更新

## 保守時の基本方針

- 表示変更は各ツールの `styles.css` を修正します。
- 検索データの更新は各検索ツールの `js/data.js` を修正します。
- 検索や画面遷移の変更は `js/app.js` を修正します。
- 公開ファイルを変更したら版番号を更新します。
- `data.js` の巨大な配列は自動整形すると差分が非常に大きくなるため、必要な範囲だけ変更します。
- 公開前に2つの検査スクリプトを実行します。

## 注意

このサイトは個人制作物であり、所属企業やメーカーの公式サービスではありません。社内限定情報、個人情報、認証情報、APIキーは配置しないでください。
