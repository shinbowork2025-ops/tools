/** 木材JANと材料マスタを連携し、未登録品は現在の作業中だけ保持する。 */
(() => {
  'use strict';

  const janCode = globalThis.JanCode;
  const materials = Array.isArray(globalThis.WOOD_MATERIALS) ? globalThis.WOOD_MATERIALS : [];
  const materialByJan = new Map();
  const searchTextByMaterial = new WeakMap();
  let pendingJan = '';
  if (!janCode) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const searchableText = material => {
    if (!searchTextByMaterial.has(material)) {
      searchTextByMaterial.set(material, [material.jan, material.name, material.category, material.note].filter(Boolean).join(' ').toLowerCase());
    }
    return searchTextByMaterial.get(material);
  };
  for (const material of materials) {
    const jan = janCode.normalize(material?.jan);
    if (jan) materialByJan.set(jan, material);
  }

  const panel = document.getElementById('addSheetPanel');
  const heading = panel?.querySelector('.section-heading');
  if (!panel || !heading) return;

  const style = document.createElement('style');
  style.textContent = '.material-scan-row{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr);gap:10px;align-items:center;margin-top:10px;padding:9px;border:1px solid #c8d9e7;border-radius:10px;background:#fff}.material-scan-state{margin:0;color:#40505d;font-size:.72rem;line-height:1.5}@media(max-width:680px){.material-scan-row{grid-template-columns:1fr}.material-scan-row button{width:100%}}';
  document.head.append(style);

  const scanRow = document.createElement('div');
  scanRow.className = 'material-scan-row';
  scanRow.innerHTML = '<button id="woodScanButton" type="button" class="primary">JANをカメラで読む</button><p id="materialScanState" class="material-scan-state" aria-live="polite">登録済みJANは読み取り後すぐ図面へ追加します。未登録品は現在の作業中だけ登録します。</p>';
  heading.insertAdjacentElement('afterend', scanRow);

  const elements = {
    startButton: scanRow.querySelector('button'), status: scanRow.querySelector('p'),
    filter: document.getElementById('materialFilter'), select: document.getElementById('materialSelect'),
    label: document.getElementById('sheetLabelInput'), width: document.getElementById('sheetWidthInput'),
    height: document.getElementById('sheetHeightInput'), thickness: document.getElementById('sheetThicknessInput'),
    add: document.getElementById('addSheetButton')
  };

  const setStatus = message => { elements.status.textContent = message; };
  function populateOptions(query, selectedId = '') {
    const normalized = String(query ?? '').trim().toLowerCase();
    const filtered = materials.filter(material => !normalized || searchableText(material).includes(normalized));
    elements.select.innerHTML = '<option value="">手入力</option>' + filtered.map(material => {
      const label = material.jan ? `${material.jan} / ${material.name}` : material.name;
      return `<option value="${escapeHtml(material.id)}">${escapeHtml(label)}</option>`;
    }).join('');
    if (filtered.some(material => material.id === selectedId)) elements.select.value = selectedId;
  }

  function selectByJan(rawValue) {
    const jan = janCode.normalize(rawValue);
    if (!janCode.isValid(jan)) {
      setStatus('JANの桁数またはチェックデジットが一致しません。');
      return false;
    }
    const material = materialByJan.get(jan);
    elements.filter.value = jan;
    elements.filter.dispatchEvent(new Event('input', { bubbles: true }));
    if (material) {
      pendingJan = '';
      elements.select.value = material.id;
      elements.select.dispatchEvent(new Event('change', { bubbles: true }));
      setStatus(`JAN ${jan}：${material.name} を図面へ追加しました。`);
      return true;
    }
    pendingJan = jan;
    elements.select.value = '';
    setStatus(`JAN ${jan} は未登録です。商品名と寸法を入力してください。登録はアプリを閉じると消えます。`);
    elements.label.focus();
    return false;
  }

  function registerPendingMaterial() {
    if (!pendingJan || elements.select.value) return;
    const width = Number(elements.width.value);
    const height = Number(elements.height.value);
    const thickness = elements.thickness.value === '' ? '' : Number(elements.thickness.value);
    const name = elements.label.value.trim();
    if (!name || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    const material = {
      id: `session-${pendingJan}-${Date.now().toString(36)}`, jan: pendingJan, name, width, height, thickness,
      category: '作業中に登録', note: 'アプリを閉じると登録を破棄'
    };
    materials.push(material);
    materialByJan.set(pendingJan, material);
    populateOptions(pendingJan, material.id);
    setStatus(`JAN ${pendingJan} と寸法を現在の作業中だけ登録しました。`);
    pendingJan = '';
  }

  elements.add.addEventListener('click', registerPendingMaterial, true);
  elements.filter.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    selectByJan(elements.filter.value);
  });
  elements.filter.addEventListener('input', () => {
    if (pendingJan && janCode.normalize(elements.filter.value) !== pendingJan) pendingJan = '';
  });

  globalThis.WoodMaterialJan = Object.freeze({
    select: selectByJan, valid: janCode.isValid, digits: janCode.normalize, status: setStatus, startButton: elements.startButton
  });

  function loadEnhancement(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(path, location.href).href;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadEnhancement('js/session-storage.js');
      await loadEnhancement('js/session-ui.js');
      await loadEnhancement('js/session-tabs-basic.js');
      await loadEnhancement('js/session-auto-add.js');
    } catch (error) {
      console.warn('木材カット図の画面調整を開始できませんでした。', error);
    }
  }, { once: true });
})();
