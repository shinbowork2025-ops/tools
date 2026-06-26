/**
 * 木材・板材マスタ。
 *
 * 必須: id, name, width, height
 * 任意: jan, thickness, category, note, sourceUrl, verifiedAt
 * 寸法の単位はすべてmm。木材商品に多い「厚さ×幅×長さ」表記は、
 * thickness=厚さ、width=幅、height=長さとして登録する。
 */
window.WOOD_MATERIALS=[
  {id:'sample-plywood-910x1820-12',jan:'',name:'合板 910×1820×12 mm（試作用）',width:910,height:1820,thickness:12,category:'合板',note:'JAN未登録の仮データ'},
  {id:'sample-plywood-910x1820-24',jan:'',name:'合板 910×1820×24 mm（試作用）',width:910,height:1820,thickness:24,category:'合板',note:'JAN未登録の仮データ'},
  {id:'sample-panel-600x900',jan:'',name:'板材 600×900 mm（試作用）',width:600,height:900,thickness:'',category:'板材',note:'操作確認用'},
  {
    id:'komeri-sugi-doubuchi-kd-18x45x1820',
    jan:'0400115001938',
    name:'杉胴縁KDプレーナー 約18×45×1820 mm',
    width:45,
    height:1820,
    thickness:18,
    category:'杉・胴縁',
    note:'コメリ商品ページでJAN・単品サイズ確認済み。新潟県・山形県対象商品。',
    sourceUrl:'https://www.komeri.com/shop/g/g837119/',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-sugi-board-eco-20x60x910',
    jan:'0400127933913',
    name:'杉板 エコグレード 約20×60×910 mm',
    width:60,
    height:910,
    thickness:20,
    category:'杉板',
    note:'コメリ取扱商品。JAN・寸法確認済み。',
    sourceUrl:'https://www.komeri.com/shop/g/g2053508/',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-sugi-board-eco-12x150x1820',
    jan:'0400127934071',
    name:'杉板 エコグレード 約12×150×1820 mm',
    width:150,
    height:1820,
    thickness:12,
    category:'杉板',
    note:'コメリ取扱商品。JAN・寸法確認済み。',
    sourceUrl:'https://www.komeri.com/shop/g/g2053523/',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-kplus-sugi-12x120x910',
    jan:'4920501319516',
    name:'K+ 杉材 12×120×910 mm',
    width:120,
    height:910,
    thickness:12,
    category:'杉材',
    note:'コメリ取扱商品。JAN・寸法確認済み。',
    sourceUrl:'https://store.shopping.yahoo.co.jp/komeri/4920501319516.html',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-kplus-sugi-25x25x910',
    jan:'4920501356627',
    name:'K+ 杉材 25×25×910 mm',
    width:25,
    height:910,
    thickness:25,
    category:'杉材',
    note:'コメリ取扱商品。JAN・寸法確認済み。',
    sourceUrl:'https://www.komeri.com/shop/g/g1842662/',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-kplus-hinoki-9x9x1820',
    jan:'4920501350878',
    name:'K+ 桧材 約9×9×1820 mm',
    width:9,
    height:1820,
    thickness:9,
    category:'桧材',
    note:'コメリ取扱商品の表示からJAN・寸法確認済み。',
    sourceUrl:'',
    verifiedAt:'2026-06-26'
  },
  {
    id:'komeri-akamatsu-nobuchi-kd-35x35x3000',
    jan:'4528182156941',
    name:'赤松野縁KD 約35×35×3000 mm',
    width:35,
    height:3000,
    thickness:35,
    category:'赤松・野縁',
    note:'コメリ取扱商品。JAN・寸法確認済み。',
    sourceUrl:'https://www.komeri.com/shop/g/g1085900/',
    verifiedAt:'2026-06-26'
  }
];
