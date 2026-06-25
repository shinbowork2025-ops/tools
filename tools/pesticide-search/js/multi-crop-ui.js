/** 農薬検索へ複数作物の共通農薬検索UIを追加する。app.jsの既存単一検索は保持する。 */
(() => {
  'use strict';

  if (!globalThis.PesticideMultiCrop) return;

  let multiCropMode = false;
  let selectedCrops = new Set();
  let multiVisibleLimit = 30;

  const originalRenderCropChips = renderCropChips;
  const originalRenderResults = renderResults;
  const originalRenderAll = renderAll;
  const originalSelectDirectProduct = selectDirectProduct;
  const originalShowEquivalentProduct = showEquivalentProduct;

  const cropStep = cropSearch.closest('.step');
  const pestStep = document.getElementById('pestStep');
  const pestCount = document.getElementById('pestCount');
  const cropClear = document.getElementById('cropClear');
  const pestClear = document.getElementById('pestClear');

  function installStyles() {
    if (document.getElementById('multiCropStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiCropStyles';
    style.textContent = `
      .multi-crop-toggle{display:flex;align-items:center;gap:9px;margin:0 0 10px;padding:9px 10px;border:1px solid #c9d9e8;border-radius:9px;background:#f7fbff;cursor:pointer}
      .multi-crop-toggle input{position:absolute;opacity:0;pointer-events:none}
      .multi-crop-toggle .toggle-track{flex:none}
      .multi-crop-toggle input:checked+.toggle-track{background:#2563a8}
      .multi-crop-toggle input:checked+.toggle-track::after{transform:translateX(16px)}
      .multi-crop-toggle strong{display:block;color:#194f88;font-size:.78rem}
      .multi-crop-toggle small{display:block;margin-top:1px;color:#68717d;font-size:.66rem;line-height:1.35}
      .selected-crop-summary{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 9px}
      .selected-crop-summary:empty{display:none}
      .selected-crop-tag{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #b9cce0;border-radius:999px;background:#edf5fc;color:#194f88;font-size:.73rem;font-weight:700}
      .selected-crop-tag button{width:22px;height:22px;border:0;border-radius:50%;background:#fff;color:#194f88;font:inherit;font-weight:800;cursor:pointer}
      .multi-crop-help,.multi-waiting{padding:10px 11px;border-radius:8px;background:#eef6ff;color:#315d86;font-size:.74rem;line-height:1.55}
      .multi-crop-help{margin-bottom:2px}
      .common-product-overview{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:0 0 10px;color:#5d6874;font-size:.7rem}
      .common-crop-badge{padding:2px 7px;border:1px solid #c9d9e8;border-radius:999px;background:#f5faff;color:#194f88;font-weight:700}
      .common-condition-list{display:grid;gap:9px}
      .crop-condition-group{padding:9px;border:1px solid #d9e3ec;border-radius:9px;background:#fbfdff}
      .crop-condition-title{display:flex;justify-content:space-between;gap:8px;margin:0 0 7px;color:#194f88;font-size:.86rem}
      .crop-condition-title span{color:#6c7883;font-size:.66rem;font-weight:400}
      .crop-registration-list{display:grid;gap:8px}
      .crop-registration{padding-top:8px;border-top:1px dashed #d8e0e7}
      .crop-registration:first-child{padding-top:0;border-top:0}
      .registration-heading{margin-bottom:4px;font-size:.74rem;font-weight:700;color:#354b60}
      .condition-meta{font-size:.75rem}
    `;
    document.head.appendChild(style);
  }

  function installControls() {
    if (document.getElementById('multiCropMode')) return;
    const toggle = document.createElement('label');
    toggle.className = 'multi-crop-toggle';
    toggle.htmlFor = 'multiCropMode';
    toggle.innerHTML = '<input type="checkbox" id="multiCropMode"><span class="toggle-track" aria-hidden="true"></span><span><strong>複数検索</strong><small>選んだ全作物に共通する農薬名を表示</small></span>';

    const summary = document.createElement('div');
    summary.id = 'selectedCropSummary';
    summary.className = 'selected-crop-summary';
    summary.setAttribute('aria-live', 'polite');

    cropStep.insertBefore(summary, cropSearch);
    cropStep.insertBefore(toggle, summary);

    const singleControls = document.createElement('div');
    singleControls.id = 'singleCropPestControls';
    pestSearch.parentNode.insertBefore(singleControls, pestSearch);
    singleControls.append(pestSearch, pestChips);

    const help = document.createElement('div');
    help.id = 'multiCropHelp';
    help.className = 'multi-crop-help';
    help.hidden = true;
    help.textContent = '登録上の農薬名が完全一致し、選択したすべての作物に適用がある製品だけを表示します。結果内では作物ごとの使用条件を分けて表示します。';
    singleControls.after(help);

    document.getElementById('multiCropMode').addEventListener('change', event => {
      setMultiCropMode(event.target.checked);
    });
  }

  function selectedCropList() {
    return [...selectedCrops];
  }

  function resetCommonLimit() {
    multiVisibleLimit = 30;
  }

  function setMultiCropMode(enabled) {
    multiCropMode = Boolean(enabled);
    const input = document.getElementById('multiCropMode');
    if (input) input.checked = multiCropMode;
    selectedProduct = null;
    selectedPest = null;
    directProductSearch.value = '';
    pestSearch.value = '';
    productSearch.value = '';
    visibleLimit = 200;
    resetCommonLimit();

    if (multiCropMode) {
      if (selectedCrop) selectedCrops.add(selectedCrop);
      selectedCrop = null;
    } else {
      selectedCrop = selectedCropList()[0] || null;
      selectedCrops.clear();
    }
    renderAll();
  }

  function clearCropSelections() {
    selectedCrops.clear();
    selectedCrop = null;
    selectedPest = null;
  }

  function commonProductNames() {
    return PesticideMultiCrop.findCommonProductNames(selectedCropList(), rowsForCrop);
  }

  function renderSelectedCropSummary() {
    const box = document.getElementById('selectedCropSummary');
    if (!box) return;
    box.innerHTML = '';
    if (!multiCropMode) return;
    for (const crop of selectedCropList()) {
      const tag = document.createElement('span');
      tag.className = 'selected-crop-tag';
      tag.append(document.createTextNode(crop));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${crop}を選択解除`);
      remove.onclick = () => {
        selectedCrops.delete(crop);
        resetCommonLimit();
        renderAll();
      };
      tag.append(remove);
      box.append(tag);
    }
  }

  renderCropChips = function enhancedRenderCropChips(filter = '') {
    if (!multiCropMode) {
      originalRenderCropChips(filter);
      return;
    }
    cropChips.innerHTML = '';
    const q = norm(filter);
    const list = activeCrops().filter(crop => norm(crop).includes(q));
    list.slice(0, 100).forEach(crop => {
      const element = document.createElement('div');
      element.className = `chip${selectedCrops.has(crop) ? ' selected' : ''}`;
      element.textContent = `${crop} (${rowsForCrop(crop).length})`;
      element.onclick = () => {
        selectedProduct = null;
        if (selectedCrops.has(crop)) selectedCrops.delete(crop);
        else selectedCrops.add(crop);
        selectedPest = null;
        visibleLimit = 200;
        resetCommonLimit();
        directProductSearch.value = '';
        cropSearch.value = '';
        productSearch.value = '';
        renderAll();
        if (selectedCrops.size >= 2) scrollToSection(pestStep);
      };
      cropChips.appendChild(element);
    });
    if (!list.length) cropChips.innerHTML = '<div class="empty" style="padding:10px">該当なし</div>';
  };

  function registrationConditionHtml(row, index) {
    const exactCrop = row[5] && baseCrop(row[5]) !== row[5]
      ? `<dt>適用作物</dt><dd>${esc(row[5])}</dd>` : '';
    return `<div class="crop-registration"><div class="registration-heading">登録 ${index + 1}：${esc(row[6]) || '対象未記載'}</div><dl class="meta condition-meta">` +
      `${exactCrop}<dt>対象</dt><dd>${esc(row[6]) || '—'}</dd><dt>登録番号</dt><dd>${esc(row[0])}</dd>` +
      `<dt>用途・種類</dt><dd>${esc(row[1])} / ${esc(row[2])}</dd><dt>希釈・使用量</dt><dd>${esc(row[7]) || '—'}</dd>` +
      `<dt>散布液量</dt><dd>${esc(row[8]) || '—'}</dd><dt>使用時期</dt><dd>${esc(row[9]) || '—'}</dd>` +
      `<dt>本剤の回数</dt><dd>${esc(row[10]) || '—'}</dd><dt>使用方法</dt><dd>${esc(row[11]) || '—'}</dd>` +
      `${row[12] ? `<dt>適用場所</dt><dd>${esc(row[12])}</dd>` : ''}${row[13] ? `<dt>有効成分の総使用回数</dt><dd>${esc(row[13])}</dd>` : ''}` +
      '</dl></div>';
  }

  function commonProductCardHtml(name, cropRows, crops) {
    const allRows = crops.flatMap(crop => cropRows.get(crop) || []);
    const garden = allRows.some(isGardenRow);
    const groups = crops.map(crop => {
      const rows = (cropRows.get(crop) || []).slice().sort((a, b) => a[6].localeCompare(b[6], 'ja') || a[0].localeCompare(b[0], 'ja'));
      return `<section class="crop-condition-group"><h3 class="crop-condition-title">${esc(crop)}<span>適用 ${rows.length.toLocaleString()}件</span></h3><div class="crop-registration-list">${rows.map(registrationConditionHtml).join('')}</div></section>`;
    }).join('');
    return `<div class="result-card common-product-card"><div class="product">${esc(name)}${garden ? '<span class="garden-badge">園芸</span>' : ''}</div>` +
      `<div class="common-product-overview"><span>${crops.length}作物に共通</span>${crops.map(crop => `<span class="common-crop-badge">${esc(crop)}</span>`).join('')}<span>適用登録 ${allRows.length.toLocaleString()}件</span></div>` +
      `<div class="common-condition-list">${groups}</div>${pesticideCommerceHtml(name)}</div>`;
  }

  function renderMultiCropResults() {
    const box = document.getElementById('results');
    const summary = document.getElementById('summary');
    const crops = selectedCropList();
    if (crops.length < 2) {
      summary.textContent = crops.length === 1 ? `複数検索：${crops[0]}を選択中（あと1作物選んでください）` : '複数検索：2作物以上を選んでください';
      box.innerHTML = '<div class="multi-waiting">作物を2つ以上選ぶと、すべての作物に共通する農薬名と、作物ごとの使用条件を表示します。</div>';
      return;
    }

    let names = commonProductNames();
    const query = norm(productSearch.value);
    if (query) names = names.filter(name => norm(name).includes(query));
    summary.textContent = `共通農薬 ${names.length.toLocaleString()}品：${crops.join(' × ')}${showAllPesticides ? ' / すべての農薬' : ' / 園芸グループのみ'}`;
    if (!names.length) {
      box.innerHTML = '<div class="empty">選択したすべての作物に、同じ農薬名で登録されている製品が見つかりません</div>';
      return;
    }

    const grouped = PesticideMultiCrop.groupRowsByProductAndCrop(crops, names, rowsForCrop);
    const shownNames = names.slice(0, multiVisibleLimit);
    box.innerHTML = shownNames.map(name => commonProductCardHtml(name, grouped.get(name) || new Map(), crops)).join('');
    if (names.length > multiVisibleLimit) {
      const button = document.createElement('button');
      button.className = 'more';
      button.textContent = `さらに表示（残り ${(names.length - multiVisibleLimit).toLocaleString()}品）`;
      button.onclick = () => { multiVisibleLimit += 30; renderResults(); };
      box.appendChild(button);
    }
  }

  renderResults = function enhancedRenderResults() {
    if (selectedProduct || !multiCropMode) {
      originalRenderResults();
      return;
    }
    renderMultiCropResults();
  };

  renderAll = function enhancedRenderAll() {
    if (!multiCropMode) {
      originalRenderAll();
      renderSelectedCropSummary();
      document.getElementById('singleCropPestControls').hidden = false;
      document.getElementById('multiCropHelp').hidden = true;
      return;
    }

    document.getElementById('directProductCount').textContent = `全${activeProducts().length.toLocaleString()}品`;
    renderDirectProductChips(directProductSearch.value);
    document.getElementById('directProductClear').style.display = (selectedProduct || directProductSearch.value.trim()) ? 'inline' : 'none';
    document.getElementById('cropCount').textContent = `選択${selectedCrops.size} / 全${activeCrops().length.toLocaleString()}種`;
    renderSelectedCropSummary();
    renderCropChips(cropSearch.value);

    pestStep.style.display = selectedCrops.size ? 'block' : 'none';
    cropClear.style.display = selectedCrops.size ? 'inline' : 'none';
    pestClear.style.display = 'none';
    document.getElementById('singleCropPestControls').hidden = true;
    document.getElementById('multiCropHelp').hidden = false;
    productSearch.placeholder = '共通農薬名でさらに絞り込み（任意）';
    const count = selectedCrops.size >= 2 ? commonProductNames().length : 0;
    pestCount.textContent = selectedCrops.size >= 2 ? `共通${count.toLocaleString()}品` : '2作物以上';
    renderResults();
  };

  selectDirectProduct = function enhancedSelectDirectProduct(name) {
    if (multiCropMode) setMultiCropMode(false);
    originalSelectDirectProduct(name);
  };

  showEquivalentProduct = function enhancedShowEquivalentProduct(name) {
    if (multiCropMode) setMultiCropMode(false);
    originalShowEquivalentProduct(name);
  };

  productSearch.oninput = () => {
    visibleLimit = 200;
    resetCommonLimit();
    renderResults();
  };

  showAllPesticidesInput.onchange = () => {
    showAllPesticides = showAllPesticidesInput.checked;
    visibleLimit = 200;
    resetCommonLimit();
    if (selectedProduct && !rowsForProduct(selectedProduct).length) selectedProduct = null;
    if (multiCropMode) {
      selectedCrops = new Set(selectedCropList().filter(crop => rowsForCrop(crop).length));
    } else if (selectedCrop && !rowsForCrop(selectedCrop).length) {
      selectedCrop = null;
      selectedPest = null;
    } else if (selectedCrop && selectedPest && !pestsForCrop(selectedCrop).some(([pest]) => pest === selectedPest)) {
      selectedPest = null;
    }
    renderAll();
  };

  cropClear.onclick = () => {
    clearCropSelections();
    productSearch.value = '';
    visibleLimit = 200;
    resetCommonLimit();
    renderAll();
  };

  installStyles();
  installControls();
  renderAll();
})();
