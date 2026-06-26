# 木材カット図 材料マスタ形式

材料データは `js/materials.js` の `window.WOOD_MATERIALS` 配列に登録します。画面本体や計算処理を変更せず、このファイルだけを差し替えて更新できます。

```javascript
window.WOOD_MATERIALS = [
  {
    id: "一意の内部ID",
    jan: "13桁または8桁のJANコード",
    name: "画面に表示する商品名",
    width: 910,
    height: 1820,
    thickness: 12,
    category: "合板",
    note: "任意の注意書き",
    sourceUrl: "確認元の商品ページ",
    verifiedAt: "2026-06-26"
  }
];
```

- 寸法の単位はミリメートルです。
- `id`、`name`、`width`、`height`は必須です。
- `jan`、`thickness`、`category`、`note`、`sourceUrl`、`verifiedAt`は省略できます。
- 木材で一般的な「厚さ×幅×長さ」表記は、`thickness=厚さ`、`width=幅`、`height=長さ`として登録します。
- 角棒は`thickness=断面の厚さ`、`width=断面の幅`、`height=全長`として登録します。
- 丸棒は`thickness=直径`、`width=直径`、`height=全長`として登録します。現在の図面は長方形表示のため、断面形状は近似です。
- `jan`は数字だけで登録し、同じJANを複数の商品へ割り当てないでください。
- カメラでJANを読み取ると、完全一致する材料が自動選択されます。
- マスタにないJANは、商品名と寸法を入力して材料を追加すると、ブラウザのローカルストレージへ端末専用データとして保存されます。
- 店舗や地域によって取扱商品・寸法・JANが異なる可能性があるため、加工前に現物表示を確認してください。
