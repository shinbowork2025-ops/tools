# 木材カット図 材料マスタ形式

材料データは `js/materials.js` の `window.WOOD_MATERIALS` 配列に登録します。
画面本体や計算処理を変更せず、このファイルだけを差し替えられます。

```javascript
window.WOOD_MATERIALS = [
  {
    id: "一意の内部ID",
    jan: "13桁のJANコード",
    name: "画面に表示する商品名",
    width: 910,
    height: 1820,
    thickness: 12,
    category: "合板",
    note: "任意の注意書き"
  }
];
```

- 寸法の単位はミリメートルです。
- `id`、`name`、`width`、`height`は必須です。
- `jan`、`thickness`、`category`、`note`は省略できます。
- `width`は図面上の横方向、`height`は縦方向として初期表示します。
- 部材の回転機能はないため、縦横を入れ替えたい商品は別レコードとして登録します。
