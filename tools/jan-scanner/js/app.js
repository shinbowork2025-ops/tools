/**
 * JANスキャンメモの画面制御。
 * 複数リスト、メモ保存、入力検証、一覧描画、カメラ制御を管理する。
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'jan-scan-memo-v2';
  const LEGACY_STORAGE_KEY = 'jan-scan-memo-v1';

  const scanBtn = document.getElementById('scanBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const manualInput = document.getElementById('manualInput');
  const addBtn = document.getElementById('addBtn');
  const cameraBox = document.getElementById('cameraBox');
  const video = document.getElementById('video');
  const closeCameraBtn = document.getElementById('closeCameraBtn');
  const torchBtn = document.getElementById('torchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const addListBtn = document.getElementById('addListBtn');
  const listTabsEl = document.getElementById('listTabs');
  const activeListHeading = document.getElementById('activeListHeading');
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');
  const toastEl = document.getElementById('toast');
  const scanFeedbackEl = document.getElementById('scanFeedback');
  const scanCanvas = document.getElementById('scanCanvas');
  const scanContext = scanCanvas.getContext('2d', { alpha: false });

  const SCAN_CONFIG = Object.freeze({
    intervalMs: 180,
    requiredHits: 5,
    maxGapMs: 700,
    minDurationMs: 600,
    confirmationWindowMs: 1800,
    cropX: 0.05,
    cropY: 0.32,
    cropWidth: 0.90,
    cropHeight: 0.36,
    maxCanvasWidth: 1280,
    minBoxWidthRatio: 0.28,
    minBoxHeightRatio: 0.07,
    minAspectRatio: 1.5
  });

  let state = loadState();
  let stream = null;
  let detector = null;
  let scanning = false;
  let scanTimer = null;
  const consensus = new JanScanConsensus({
    requiredHits: SCAN_CONFIG.requiredHits,
    maxGapMs: SCAN_CONFIG.maxGapMs,
    minDurationMs: SCAN_CONFIG.minDurationMs,
    windowMs: SCAN_CONFIG.confirmationWindowMs
  });

  function makeItemId() {
    if (globalThis.crypto?.randomUUID) return `item-${globalThis.crypto.randomUUID()}`;
    return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadState() {
    let saved = null;
    let legacyItems = [];
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {}
    if (!saved) {
      try {
        const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
        legacyItems = Array.isArray(parsed) ? parsed : [];
      } catch {}
    }
    return JanListStore.normalizeState(saved, legacyItems);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return true;
    } catch {
      statusEl.textContent = '端末内へ保存できません。この画面を閉じると変更は消去されます。';
      return false;
    }
  }

  function scheduleSave() {
    clearTimeout(scheduleSave.timer);
    scheduleSave.timer = setTimeout(saveState, 250);
  }

  function activeList() {
    return JanListStore.getActiveList(state);
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  function normalizeJan(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function isValidJanLength(jan) {
    return jan.length === 8 || jan.length === 13;
  }

  function validateCheckDigit(jan) {
    if (!isValidJanLength(jan)) return false;
    const digits = jan.split('').map(Number);
    const check = digits.pop();
    let sum = 0;
    if (jan.length === 13) {
      digits.forEach((digit, index) => sum += digit * (index % 2 === 0 ? 1 : 3));
    } else {
      digits.forEach((digit, index) => sum += digit * (index % 2 === 0 ? 3 : 1));
    }
    return (10 - (sum % 10)) % 10 === check;
  }

  function addJan(raw, options = {}) {
    const source = options.source || 'manual';
    const jan = normalizeJan(raw);
    if (!isValidJanLength(jan)) {
      if (source === 'manual') showToast('JANは8桁または13桁です');
      return { ok: false, reason: 'length', jan };
    }
    if (!validateCheckDigit(jan)) {
      if (source === 'camera') return { ok: false, reason: 'check-digit', jan };
      const accepted = confirm('チェックデジットが一致しません。それでも追加しますか？');
      if (!accepted) return { ok: false, reason: 'check-digit', jan };
    }

    const list = activeList();
    if (list.items.some(item => item.jan === jan)) {
      showToast(`${list.name}に登録済みです`);
      return { ok: false, reason: 'duplicate', jan };
    }

    list.items.unshift({
      id: makeItemId(),
      jan,
      addedAt: new Date().toISOString(),
      memo: ''
    });
    saveState();
    render();
    showToast(`${list.name}へ追加しました`);
    if (navigator.vibrate) navigator.vibrate([100, 40, 100]);
    return { ok: true, reason: 'added', jan };
  }

  function deleteItem(itemId) {
    const list = activeList();
    const index = list.items.findIndex(item => item.id === itemId);
    if (index < 0) return;
    list.items.splice(index, 1);
    saveState();
    render();
  }

  function formatDate(iso) {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast('コピーしました');
  }

  function renameActiveList(list) {
    const nextName = prompt('リスト名を入力してください（24文字まで）', list.name);
    if (nextName === null) return;
    if (!JanListStore.renameList(state, list.id, nextName)) {
      showToast('リスト名を入力してください');
      return;
    }
    saveState();
    render();
  }

  function switchList(listId) {
    if (state.activeListId === listId) {
      const list = state.lists.find(item => item.id === listId);
      if (list) renameActiveList(list);
      return;
    }
    state.activeListId = listId;
    saveState();
    render();
  }

  function deleteList(list) {
    if (state.lists.length <= 1) {
      showToast('リストは1つ以上必要です');
      return;
    }
    const description = list.items.length ? `「${list.name}」と登録${list.items.length}件を削除しますか？` : `「${list.name}」を削除しますか？`;
    if (!confirm(description)) return;
    JanListStore.deleteList(state, list.id);
    saveState();
    render();
    showToast('リストを削除しました');
  }

  function renderTabs() {
    listTabsEl.innerHTML = '';
    for (const list of state.lists) {
      const shell = document.createElement('div');
      shell.className = `list-tab${list.id === state.activeListId ? ' active' : ''}`;
      shell.setAttribute('role', 'presentation');

      const nameButton = document.createElement('button');
      nameButton.type = 'button';
      nameButton.className = 'tab-name';
      nameButton.textContent = list.name;
      nameButton.setAttribute('role', 'tab');
      nameButton.setAttribute('aria-selected', list.id === state.activeListId ? 'true' : 'false');
      nameButton.title = list.id === state.activeListId ? 'もう一度タップして名前を編集' : `${list.name}へ切り替え`;
      nameButton.addEventListener('click', () => switchList(list.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'tab-delete';
      deleteButton.textContent = '×';
      deleteButton.setAttribute('aria-label', `${list.name}を削除`);
      deleteButton.disabled = state.lists.length <= 1;
      deleteButton.addEventListener('click', event => {
        event.stopPropagation();
        deleteList(list);
      });

      shell.append(nameButton, deleteButton);
      listTabsEl.appendChild(shell);
      if (list.id === state.activeListId) {
        requestAnimationFrame(() => shell.scrollIntoView({ inline: 'center', block: 'nearest' }));
      }
    }
    addListBtn.disabled = state.lists.length >= JanListStore.MAX_LISTS;
    addListBtn.title = addListBtn.disabled ? 'リストは最大6個です' : '新しいリストを追加';
  }

  function render() {
    const list = activeList();
    renderTabs();
    activeListHeading.textContent = list.name;
    countEl.textContent = list.items.length;
    copyAllBtn.disabled = list.items.length === 0;
    clearBtn.disabled = list.items.length === 0;
    listEl.innerHTML = '';

    if (!list.items.length) {
      listEl.innerHTML = '<div class="empty">このリストにはまだ登録されていません。<br>画面下部のスキャンボタンまたは手入力で追加してください。</div>';
      return;
    }

    list.items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'item';
      card.dataset.itemId = item.id;

      const top = document.createElement('div');
      top.className = 'item-top';

      const titleBox = document.createElement('div');
      const jan = document.createElement('div');
      jan.className = 'jan';
      jan.textContent = item.jan;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `登録: ${formatDate(item.addedAt)}`;
      titleBox.append(jan, meta);

      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'コピー';
      copyButton.addEventListener('click', () => copyText(item.jan));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = '削除';
      deleteButton.className = 'danger';
      deleteButton.addEventListener('click', () => deleteItem(item.id));
      actions.append(copyButton, deleteButton);
      top.append(titleBox, actions);

      const content = document.createElement('div');
      content.className = 'barcode-note-row';
      const barcodeWrap = document.createElement('div');
      barcodeWrap.className = 'barcode-wrap';
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', `${item.jan} のバーコード`);
      barcodeWrap.appendChild(canvas);

      const memoWrap = document.createElement('div');
      memoWrap.className = 'memo-wrap';
      const memoLabel = document.createElement('label');
      memoLabel.textContent = 'メモ';
      memoLabel.htmlFor = `memo-${item.id}`;
      const memoInput = document.createElement('textarea');
      memoInput.id = `memo-${item.id}`;
      memoInput.className = 'memo-input';
      memoInput.placeholder = '商品名・売場・数量など';
      memoInput.maxLength = 500;
      memoInput.value = item.memo || '';
      memoInput.addEventListener('input', () => {
        item.memo = memoInput.value;
        scheduleSave();
      });
      memoWrap.append(memoLabel, memoInput);
      content.append(barcodeWrap, memoWrap);

      card.append(top, content);
      listEl.appendChild(card);
      requestAnimationFrame(() => drawEAN(canvas, item.jan));
    });
  }

  async function startCamera() {
    if (!('BarcodeDetector' in window)) {
      statusEl.textContent = 'このブラウザは直接スキャンに未対応です。Chrome最新版で開くか、手入力してください。';
      showToast('バーコード検出に未対応です');
      return;
    }

    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = ['ean_13', 'ean_8'].filter(format => supported.includes(format));
      if (!formats.length) throw new Error('EAN未対応');

      detector = new BarcodeDetector({ formats });
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();
      await enableContinuousFocus();
      consensus.reset();
      cameraBox.classList.add('is-open');
      document.body.classList.add('camera-open');
      scanBtn.disabled = true;
      scanning = true;
      statusEl.textContent = `${activeList().name}へ登録します。`;
      setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
      setupTorch();
      scheduleNextScan(0);
    } catch (error) {
      console.error(error);
      stopCamera({ statusMessage: 'カメラを開始できません。HTTPS環境・カメラ権限・対応ブラウザを確認してください。' });
      showToast('カメラを開始できません');
    }
  }

  async function enableContinuousFocus() {
    try {
      const track = stream?.getVideoTracks()[0];
      if (!track?.getCapabilities || !track.applyConstraints) return;
      const capabilities = track.getCapabilities();
      if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch {}
  }

  async function setupTorch() {
    torchBtn.disabled = true;
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        torchBtn.disabled = false;
        torchBtn.dataset.on = '0';
      }
    } catch {}
  }

  async function toggleTorch() {
    try {
      const track = stream.getVideoTracks()[0];
      const on = torchBtn.dataset.on !== '1';
      await track.applyConstraints({ advanced: [{ torch: on }] });
      torchBtn.dataset.on = on ? '1' : '0';
      torchBtn.textContent = on ? 'ライトOFF' : 'ライト';
    } catch {
      showToast('ライトを切り替えられません');
    }
  }

  function setScanFeedback(message) {
    scanFeedbackEl.textContent = message;
  }

  function scheduleNextScan(delay = SCAN_CONFIG.intervalMs) {
    clearTimeout(scanTimer);
    if (!scanning) return;
    scanTimer = setTimeout(scanLoop, delay);
  }

  function captureGuideArea() {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return false;

    const sx = Math.round(sourceWidth * SCAN_CONFIG.cropX);
    const sy = Math.round(sourceHeight * SCAN_CONFIG.cropY);
    const sw = Math.round(sourceWidth * SCAN_CONFIG.cropWidth);
    const sh = Math.round(sourceHeight * SCAN_CONFIG.cropHeight);
    const scale = Math.min(1, SCAN_CONFIG.maxCanvasWidth / sw);
    const targetWidth = Math.max(1, Math.round(sw * scale));
    const targetHeight = Math.max(1, Math.round(sh * scale));

    if (scanCanvas.width !== targetWidth || scanCanvas.height !== targetHeight) {
      scanCanvas.width = targetWidth;
      scanCanvas.height = targetHeight;
    }
    scanContext.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    return true;
  }

  function hasReliableGeometry(code) {
    const box = code?.boundingBox;
    if (!box || !scanCanvas.width || !scanCanvas.height) return false;
    const widthRatio = box.width / scanCanvas.width;
    const heightRatio = box.height / scanCanvas.height;
    const aspectRatio = box.width / Math.max(box.height, 1);
    return widthRatio >= SCAN_CONFIG.minBoxWidthRatio
      && heightRatio >= SCAN_CONFIG.minBoxHeightRatio
      && aspectRatio >= SCAN_CONFIG.minAspectRatio;
  }

  function reliableDetections(codes) {
    const unique = new Map();
    for (const code of codes) {
      const jan = normalizeJan(code.rawValue);
      if (!['ean_13', 'ean_8'].includes(code.format)) continue;
      if (!isValidJanLength(jan) || !validateCheckDigit(jan)) continue;
      if (!hasReliableGeometry(code)) continue;
      const area = code.boundingBox.width * code.boundingBox.height;
      const previous = unique.get(jan);
      if (!previous || area > previous.area) unique.set(jan, { jan, area });
    }
    return [...unique.values()].sort((a, b) => b.area - a.area);
  }

  function handleNoDetection(now) {
    consensus.observe('', now);
    setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
  }

  function finishConfirmedScan(jan, addResult) {
    const listName = activeList().name;
    if (addResult.ok) {
      stopCamera({ statusMessage: `${jan} を${listName}へ登録しました。` });
      requestAnimationFrame(() => {
        listEl.querySelector('.item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    if (addResult.reason === 'duplicate') {
      stopCamera({ statusMessage: `${jan} は${listName}に登録済みです。` });
    }
  }

  function handleDetections(detections, now) {
    if (detections.length > 1) {
      consensus.reset();
      setScanFeedback('複数のバーコードがあります。1つだけ枠内へ入れてください。');
      return;
    }

    const jan = detections[0].jan;
    const result = consensus.observe(jan, now);
    if (!result.confirmed) {
      setScanFeedback(`読取確認中 ${result.hits}/${result.requiredHits}：${jan}`);
      return;
    }

    const addResult = addJan(jan, { source: 'camera' });
    consensus.reset();
    if (addResult.ok || addResult.reason === 'duplicate') {
      finishConfirmedScan(jan, addResult);
    } else {
      setScanFeedback('読取結果を破棄しました。位置を調整して再度読み取ってください。');
    }
  }

  async function scanLoop() {
    if (!scanning || !detector) return;
    try {
      if (!captureGuideArea()) {
        scheduleNextScan();
        return;
      }
      const codes = await detector.detect(scanCanvas);
      const now = Date.now();
      const detections = reliableDetections(codes);
      if (detections.length) handleDetections(detections, now);
      else handleNoDetection(now);
    } catch (error) {
      console.warn('バーコード検出を継続できませんでした。', error);
    }
    scheduleNextScan();
  }

  function stopCamera(options = {}) {
    scanning = false;
    clearTimeout(scanTimer);
    scanTimer = null;
    consensus.reset();
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    detector = null;
    video.srcObject = null;
    cameraBox.classList.remove('is-open');
    document.body.classList.remove('camera-open');
    scanBtn.disabled = false;
    torchBtn.disabled = true;
    torchBtn.dataset.on = '0';
    torchBtn.textContent = 'ライト';
    setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
    statusEl.textContent = options.statusMessage || 'スキャンしたJANはこの端末内に保存されます。';
  }

  scanBtn.addEventListener('click', startCamera);
  closeCameraBtn.addEventListener('click', () => stopCamera());
  torchBtn.addEventListener('click', toggleTorch);

  addBtn.addEventListener('click', () => {
    const result = addJan(manualInput.value, { source: 'manual' });
    if (result.ok) manualInput.value = '';
    manualInput.focus();
  });
  manualInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') addBtn.click();
  });
  manualInput.addEventListener('focus', () => manualInput.select());

  copyAllBtn.addEventListener('click', () => {
    copyText(activeList().items.map(item => item.jan).join('\n'));
  });

  clearBtn.addEventListener('click', () => {
    const list = activeList();
    if (!list.items.length) return;
    if (!confirm(`「${list.name}」の登録をすべて削除しますか？`)) return;
    list.items = [];
    saveState();
    render();
    showToast('リストを空にしました');
  });

  addListBtn.addEventListener('click', () => {
    const list = JanListStore.addList(state);
    if (!list) {
      showToast('リストは最大6個です');
      return;
    }
    saveState();
    render();
    showToast(`${list.name}を作成しました`);
  });

  window.addEventListener('beforeunload', () => {
    saveState();
    stopCamera();
  });

  saveState();
  render();
})();
