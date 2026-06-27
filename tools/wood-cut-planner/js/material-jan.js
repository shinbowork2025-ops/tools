/**
 * 木材JANと材料マスタを連携する。
 * 登録済みJANはMapへ索引化し、未登録JANは端末内へ保存する。
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'komeriWoodCustomMaterialsV1';
  const janCode = globalThis.JanCode;
  const materials = Array.isArray(globalThis.WOOD_MATERIALS) ? globalThis.WOOD_MATERIALS : [];
  const materialByJan = new Map();
  const searchTextByMaterial = new WeakMap();
  let pendingJan = '';

  if (!janCode) {
    console.error('JAN共通処理を読み込めませんでした。');
    return;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function hasValidDimensions(item) {
    return Number(item?.width) > 0 && Number(item?.height) > 0;
  }

  function isValidStoredMaterial(item) {
    return Boolean(item?.id && item?.name)
      && janCode.isValid(janCode.normalize(item.jan))
      && hasValidDimensions(item);
  }

  function loadCustomMaterials() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isValidStoredMaterial) : [];
    } catch {
      return [];
    }
  }

  function saveCustomMaterial(item) {
    const customMaterials = loadCustomMaterials();
    const existingIndex = customMaterials.findIndex(material => material.jan === item.jan);
    if (existingIndex >= 0) customMaterials[existingIndex] = item;
    else customMaterials.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customMaterials));
  }

  function indexMaterial(item) {
    const jan = janCode.normalize(item?.jan);
    if (jan) materialByJan.set(jan, item);
  }

  function addCustomMaterialsToMaster() {
    for (const material of materials) indexMaterial(material);
    for (const customMaterial of loadCustomMaterials()) {
      if (materialByJan.has(customMaterial.jan)) continue;
      materials.push(customMaterial);
      indexMaterial(customMaterial);
    }
  }

  function searchableText(material) {
    if (searchTextByMaterial.has(material)) return searchTextByMaterial.get(material);
    const text = [material.jan, material.name, material.category, material.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    searchTextByMaterial.set(material, text);
    return text;
  }

  addCustomMaterialsToMaster();

  const panel = document.getElementById('addSheetPanel');
  const heading = panel?.querySelector('.section-heading');
  if (!panel || !heading) return;

  if (!document.getElementById('materialJanStyle')) {
    const style = document.createElement('style');
    style.id = 'materialJanStyle';
    style.textContent = '.material-scan-row{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr);gap:10px;align-items:center;margin-top:10px;padding:9px;border:1px solid #c8d9e7;border-radius:10px;background:#fff}.material-scan-state{margin:0;color:#40505d;font-size:.72rem;line-height:1.5}@media(max-width:680px){.material-scan-row{grid-template-columns:1fr}.material-scan-row button{width:100%}}';
    document.head.appendChild(style);
  }

  const scanRow = document.createElement('div');
  scanRow.className = 'material-scan-row';
  scanRow.innerHTML = '<button id="woodScanButton" type="button" class="primary">JANをカメラで読む</button><p id="materialScanState" class="material-scan-state" aria-live="polite">JANを読み取ると登録材料を自動選択します。未登録品は寸法入力後、この端末へ記憶できます。</p>';
  heading.insertAdjacentElement('afterend', scanRow);

  const elements = {
    panel,
    startButton: scanRow.querySelector('button'),
    status: scanRow.querySelector('p'),
    filter: document.getElementById('materialFilter'),
    select: document.getElementById('materialSelect'),
    label: document.getElementById('sheetLabelInput'),
    width: document.getElementById('sheetWidthInput'),
    height: document.getElementById('sheetHeightInput'),
    thickness: document.getElementById('sheetThicknessInput'),
    add: document.getElementById('addSheetButton')
  };

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function populateMaterialOptions(query, selectedId = '') {
    const normalizedQuery = String(query ?? '').trim().toLowerCase();
    const filtered = materials.filter(material => !normalizedQuery || searchableText(material).includes(normalizedQuery));
    const options = filtered.map(material => {
      const label = material.jan ? `${material.jan} / ${material.name}` : material.name;
      return `<option value="${escapeHtml(material.id)}">${escapeHtml(label)}</option>`;
    });
    elements.select.innerHTML = `<option value="">手入力</option>${options.join('')}`;
    if (filtered.some(material => material.id === selectedId)) elements.select.value = selectedId;
  }

  function selectByJan(rawValue) {
    const jan = janCode.normalize(rawValue);
    if (!janCode.isValid(jan)) {
      setStatus('JANの桁数またはチェックデジットが一致しません。');
      return false;
    }

    const material = materialByJan.get(jan) || null;
    elements.filter.value = jan;
    elements.filter.dispatchEvent(new Event('input', { bubbles: true }));

    if (material) {
      pendingJan = '';
      elements.select.value = material.id;
      elements.select.dispatchEvent(new Event('change', { bubbles: true }));
      setStatus(`JAN ${jan}：${material.name} を選択しました。`);
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    pendingJan = jan;
    elements.select.value = '';
    setStatus(`JAN ${jan} は未登録です。商品名と寸法を入力し「この材料を追加」を押すと、この端末へ記憶します。`);
    elements.label.focus();
    return false;
  }

  function storePendingMaterial() {
    if (!pendingJan || elements.select.value) return;
    const width = Number(elements.width.value);
    const height = Number(elements.height.value);
    const thickness = elements.thickness.value === '' ? '' : Number(elements.thickness.value);
    const name = elements.label.value.trim();
    if (!name || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;

    const material = {
      id: `custom-${pendingJan}`,
      jan: pendingJan,
      name,
      width,
      height,
      thickness,
      category: '端末登録',
      note: '現場でJAN読取後にこの端末へ登録',
      verifiedAt: new Date().toISOString().slice(0, 10)
    };

    const existing = materialByJan.get(pendingJan);
    if (existing) {
      const index = materials.indexOf(existing);
      if (index >= 0) materials[index] = material;
    } else {
      materials.push(material);
    }

    materialByJan.set(pendingJan, material);
    saveCustomMaterial(material);
    populateMaterialOptions(pendingJan, material.id);
    setStatus(`JAN ${pendingJan} と寸法をこの端末へ記憶しました。`);
    pendingJan = '';
  }

  elements.add.addEventListener('click', storePendingMaterial, true);
  elements.filter.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    selectByJan(elements.filter.value);
  });
  elements.filter.addEventListener('input', () => {
    if (pendingJan && janCode.normalize(elements.filter.value) !== pendingJan) pendingJan = '';
  });

  globalThis.WoodMaterialJan = Object.freeze({
    select: selectByJan,
    valid: janCode.isValid,
    digits: janCode.normalize,
    status: setStatus,
    startButton: elements.startButton
  });
})();
