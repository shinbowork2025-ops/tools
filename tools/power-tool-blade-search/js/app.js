/**
 * 電動工具の替刃・互換検索の画面制御。
 * 商品データは data.js、共通のJAN描画処理は shared/js/ean13.js に分離している。
 */
// コメリ商品情報とJAN表示
function komeriSearchUrl(keyword){return `https://www.komeri.com/shop/goods/search.aspx?display=D&keyword=${encodeURIComponent(keyword||'')}&search=x&x=0&y=0`;}
function janFromKomeriUrl(url){const m=String(url||'').match(/\/j(\d{13})(?:\/?|$)/);return m?m[1]:'';}
function bladeProductDetails(bladeModel,bladeUrl){
  if(BLADE_PRODUCT_DETAILS_RAW[bladeModel]) return BLADE_PRODUCT_DETAILS_RAW[bladeModel];
  const jan=janFromKomeriUrl(bladeUrl);
  if(bladeUrl) return [{name:bladeModel||'対応替刃',jan:jan||'未確認',url:bladeUrl,searchOnly:!jan}];
  return [{name:bladeModel||'対応替刃',jan:'未確認',url:komeriSearchUrl(bladeModel),searchOnly:true}];
}
function bladeCommerceHtml(bladeModel,bladeUrl){
  return `<div class="commerce-box"><div class="commerce-title">コメリ商品情報</div><div class="variant-list">${bladeProductDetails(bladeModel,bladeUrl).map(v=>`<div class="variant-row"><div class="variant-name">${esc(v.name)}</div><div class="jan-code">JANコード：${esc(v.jan||'未確認')}</div>${janBarcodeToggleHtml(v.jan)}<div class="variant-actions"><a class="link-button${v.searchOnly?'':' primary'}" href="${esc(v.url||komeriSearchUrl(v.name))}" target="_blank" rel="noopener noreferrer">${v.searchOnly?'コメリで該当品を確認':'コメリ商品ページを開く'}</a></div>${v.searchOnly?'<div class="status-note">商品を一意に特定できないため、一覧または検索結果を表示します。</div>':''}</div>`).join('')}</div></div>`;
}


// 選択状態とDOM参照
let selectedMaker = null;
let selectedModel = null;

const makerSearch = document.getElementById('makerSearch');
const modelSearch = document.getElementById('modelSearch');
const categoryFilter = document.getElementById('categoryFilter');
const powerFilter = document.getElementById('powerFilter');
const makerChips = document.getElementById('makerChips');
const modelChips = document.getElementById('modelChips');
const modelStep = document.getElementById('modelStep');
const makerClear = document.getElementById('makerClear');
const modelClear = document.getElementById('modelClear');
const resetAll = document.getElementById('resetAll');
const results = document.getElementById('results');
const summary = document.getElementById('summary');

function normText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}
function normModel(value) {
  return normText(value).replace(/[‐‑‒–—―ー−ｰ-]/g, '');
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (_) { return ''; }
}
function uniqueSorted(values) {
  return [...new Set(values)].sort((a,b) => a.localeCompare(b, 'ja', {numeric:true, sensitivity:'base'}));
}
function rowsForMaker(maker) { return DATA.filter(r => r[0] === maker); }
function filteredModelRows() {
  if (!selectedMaker) return [];
  const query = normModel(modelSearch.value);
  return rowsForMaker(selectedMaker).filter(r =>
    (!query || normModel(r[2]).includes(query)) &&
    (!categoryFilter.value || r[1] === categoryFilter.value) &&
    (!powerFilter.value || r[3] === powerFilter.value)
  ).sort((a,b) => a[2].localeCompare(b[2], 'ja', {numeric:true, sensitivity:'base'}));
}
function makeChip(label, selected, onClick, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip' + (selected ? ' selected' : '');
  button.textContent = label;
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
}
function setSelectOptions(select, values, currentValue) {
  select.innerHTML = '<option value="">すべて</option>';
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.includes(currentValue) ? currentValue : '';
}
// メーカー・型番候補の描画
function renderMakerChips() {
  const q = normText(makerSearch.value);
  const counts = new Map();
  DATA.forEach(r => counts.set(r[0], (counts.get(r[0]) || 0) + 1));
  const makers = [...counts.keys()].sort((a,b) => counts.get(b) - counts.get(a) || a.localeCompare(b, 'ja'));
  const shown = makers.filter(m => normText(m).includes(q));
  makerChips.innerHTML = '';
  shown.forEach(maker => makerChips.appendChild(makeChip(
    `${maker} (${counts.get(maker)})`,
    maker === selectedMaker,
    () => selectMaker(maker),
    `${maker}、${counts.get(maker)}機種`
  )));
  if (!shown.length) makerChips.innerHTML = '<div class="empty" style="padding:10px">該当するメーカーがありません</div>';
  document.getElementById('makerCount').textContent = `全${makers.length}社`;
}
function refreshFilters() {
  if (!selectedMaker) return;
  const rows = rowsForMaker(selectedMaker);
  const oldCategory = categoryFilter.value;
  const oldPower = powerFilter.value;
  setSelectOptions(categoryFilter, uniqueSorted(rows.map(r => r[1])), oldCategory);
  setSelectOptions(powerFilter, uniqueSorted(rows.map(r => r[3])), oldPower);
}
function renderModelChips() {
  if (!selectedMaker) return;
  const rows = filteredModelRows();
  modelChips.innerHTML = '';
  rows.forEach(row => modelChips.appendChild(makeChip(
    row[2],
    row[2] === selectedModel,
    () => selectModel(row[2]),
    `${row[2]}、${row[1]}、${row[3]}`
  )));
  if (!rows.length) modelChips.innerHTML = '<div class="empty" style="padding:10px">条件に一致する型番がありません</div>';
  const total = rowsForMaker(selectedMaker).length;
  document.getElementById('modelCount').textContent = rows.length === total ? `全${total}機種` : `${rows.length} / ${total}機種`;
}
// 選択した機種の結果表示
function renderResult() {
  if (!selectedMaker) {
    summary.textContent = '';
    results.innerHTML = '';
    return;
  }
  if (!selectedModel) {
    const n = filteredModelRows().length;
    summary.textContent = `${selectedMaker}：表示中 ${n} 機種`;
    results.innerHTML = '<div class="empty">本体型番を選ぶと、対応替刃と仕様を表示します</div>';
    return;
  }
  const row = DATA.find(r => r[0] === selectedMaker && r[2] === selectedModel);
  if (!row) {
    selectedModel = null;
    renderAll();
    return;
  }
  const [, category, model, power, bladeModel, bladeSpec, bodyUrlRaw, bladeUrlRaw] = row;
  const bodyUrl = validHttpUrl(bodyUrlRaw);
  const bladeUrl = validHttpUrl(bladeUrlRaw);
  const siblings = DATA.filter(r => r[4] === bladeModel && !(r[0] === selectedMaker && r[2] === selectedModel));
  const siblingText = siblings.map(r => `${r[0]}：${r[2]}`).join('、');
  const commerce = bladeCommerceHtml(bladeModel, bladeUrl);
  const links = [
    bodyUrl ? `<a class="link-button" href="${esc(bodyUrl)}" target="_blank" rel="noopener noreferrer">本体互換情報を確認</a>` : ''
  ].join('');
  const compatible = siblings.length ? `
    <details class="compatible">
      <summary>同じ替刃が登録された他の機種（${siblings.length}機種）</summary>
      <div class="compatible-list">${esc(siblingText)}</div>
    </details>` : '';
  summary.textContent = `${selectedMaker} / ${model}`;
  results.innerHTML = `
    <article class="result-card">
      <div class="product">${esc(model)}</div>
      <div class="manufacturer">${esc(selectedMaker)}</div>
      <div class="section-title">本体情報</div>
      <dl class="meta">
        <dt>製品カテゴリ</dt><dd>${esc(category) || '—'}</dd>
        <dt>電源種別</dt><dd>${esc(power) || '—'}</dd>
      </dl>
      <div class="section-title">対応替刃</div>
      <div class="blade-box">
        <div class="blade-model">${esc(bladeModel) || '—'}</div>
        <div class="blade-spec">${esc(bladeSpec) || '仕様情報なし'}</div>
      </div>
      ${commerce}
      <div class="links">${links}</div>
      ${compatible}
    </article>`;
}
function scrollToSection(target){
  const active=document.activeElement;
  if(active&&typeof active.blur==='function')active.blur();
  if(!target)return;
  const reduceMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(()=>requestAnimationFrame(()=>target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'})));
}
function scrollToSearchResults(){
  const target=document.getElementById('summary');
  if(!target||!target.textContent.trim())return;
  scrollToSection(target);
}
function selectMaker(maker) {
  selectedMaker = maker;
  selectedModel = null;
  makerSearch.value = '';
  modelSearch.value = '';
  categoryFilter.value = '';
  powerFilter.value = '';
  refreshFilters();
  renderAll();
  scrollToSection(modelStep);
}
function selectModel(model) {
  selectedModel = model;
  modelSearch.value = '';
  renderAll();
  scrollToSearchResults();
}
function clearModelSelection() {
  selectedModel = null;
  renderAll();
}
function resetEverything() {
  selectedMaker = null;
  selectedModel = null;
  makerSearch.value = '';
  modelSearch.value = '';
  categoryFilter.value = '';
  powerFilter.value = '';
  renderAll();
  window.scrollTo({top:0, behavior:'smooth'});
}
function renderAll() {
  renderMakerChips();
  modelStep.hidden = !selectedMaker;
  makerClear.hidden = !selectedMaker;
  modelClear.hidden = !selectedModel;
  resetAll.hidden = !selectedMaker && !makerSearch.value;
  if (selectedMaker) renderModelChips();
  renderResult();
}

makerSearch.addEventListener('input', renderAll);
modelSearch.addEventListener('input', () => {
  if (selectedModel && !normModel(selectedModel).includes(normModel(modelSearch.value))) selectedModel = null;
  renderAll();
});
categoryFilter.addEventListener('change', () => { selectedModel = null; renderAll(); });
powerFilter.addEventListener('change', () => { selectedModel = null; renderAll(); });
makerClear.addEventListener('click', resetEverything);
modelClear.addEventListener('click', clearModelSelection);
resetAll.addEventListener('click', resetEverything);

renderAll();
