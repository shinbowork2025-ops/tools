/**
 * 木材・板材マスタ。
 * 後からJANを受け取った際は、この配列を差し替えるだけで画面へ反映される。
 *
 * 必須: id, name, width, height
 * 任意: jan, thickness, category, note
 * 寸法の単位はすべてmm。widthは画面上の横、heightは画面上の縦として扱う。
 */
window.WOOD_MATERIALS=[
  {id:'sample-plywood-910x1820-12',jan:'',name:'合板 910×1820×12 mm（試作用）',width:910,height:1820,thickness:12,category:'合板',note:'JAN未登録の仮データ'},
  {id:'sample-plywood-910x1820-24',jan:'',name:'合板 910×1820×24 mm（試作用）',width:910,height:1820,thickness:24,category:'合板',note:'JAN未登録の仮データ'},
  {id:'sample-panel-600x900',jan:'',name:'板材 600×900 mm（試作用）',width:600,height:900,thickness:'',category:'板材',note:'操作確認用'}
];
