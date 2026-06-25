/**
 * JANスキャンメモの画面制御。
 * 保存、入力検証、一覧描画、カメラ制御をこのファイルで管理する。
 */
(() => {
  'use strict';

  // DOM参照と状態
  const STORAGE_KEY = 'jan-scan-memo-v1';
  const scanBtn = document.getElementById('scanBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const manualInput = document.getElementById('manualInput');
  const addBtn = document.getElementById('addBtn');
  const cameraBox = document.getElementById('cameraBox');
  const video = document.getElementById('video');
  const closeCameraBtn = document.getElementById('closeCameraBtn');
  const torchBtn = document.getElementById('torchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');
  const toastEl = document.getElementById('toast');
  const scanFeedbackEl = document.getElementById('scanFeedback');
  const scanCanvas = document.getElementById('scanCanvas');
  const scanContext = scanCanvas.getContext('2d', { alpha: false });

  // 誤検出を減らすため、読取回数・枠内の形状・登録後の待機を制御する。
  const SCAN_CONFIG = Object.freeze({
    intervalMs: 180,
    requiredHits: 5,
    maxGapMs: 700,
    minDurationMs: 600,
    confirmationWindowMs: 1800,
    cooldownMs: 2200,
    clearToRearmMs: 450,
    cropX: 0.05,
    cropY: 0.32,
    cropWidth: 0.90,
    cropHeight: 0.36,
    maxCanvasWidth: 1280,
    minBoxWidthRatio: 0.28,
    minBoxHeightRatio: 0.07,
    minAspectRatio: 1.5
  });

  let items = loadItems();
  let stream = null;
  let detector = null;
  let scanning = false;
  let scanTimer = null;
  let cooldownUntil = 0;
  let waitingForClear = false;
  let clearStartedAt = 0;
  const consensus = new JanScanConsensus({
    requiredHits: SCAN_CONFIG.requiredHits,
    maxGapMs: SCAN_CONFIG.maxGapMs,
    minDurationMs: SCAN_CONFIG.minDurationMs,
    windowMs: SCAN_CONFIG.confirmationWindowMs
  });

  // 端末内の保存と復元
  function loadItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      // 保存領域が無効でも、現在の画面では一覧を継続して使用できるようにする。
      statusEl.textContent = '端末内へ保存できません。この画面を閉じると一覧は消去されます。';
      return false;
    }
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  // JANの正規化とチェックデジット検証
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
      digits.forEach((d, i) => sum += d * (i % 2 === 0 ? 1 : 3));
    } else {
      digits.forEach((d, i) => sum += d * (i % 2 === 0 ? 3 : 1));
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
      // カメラの誤検出は確認画面を出さずに破棄する。手入力だけは利用者が継続を選べる。
      if (source === 'camera') return { ok: false, reason: 'check-digit', jan };
      const ok = confirm('チェックデジットが一致しません。それでも追加しますか？');
      if (!ok) return { ok: false, reason: 'check-digit', jan };
    }
    if (items.some(x => x.jan === jan)) {
      showToast('すでに登録されています');
      return { ok: false, reason: 'duplicate', jan };
    }

    items.unshift({ jan, addedAt: new Date().toISOString() });
    saveItems();
    render();
    showToast('追加しました');
    if (navigator.vibrate) navigator.vibrate([100, 40, 100]);
    return { ok: true, reason: 'added', jan };
  }

  function deleteItem(index) {
    items.splice(index, 1);
    saveItems();
    render();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ja-JP', {
      month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    }).format(d);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('コピーしました');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('コピーしました');
    }
  }

  // 保存リストの描画
  function render() {
    countEl.textContent = items.length;
    copyAllBtn.disabled = items.length === 0;
    clearBtn.disabled = items.length === 0;
    listEl.innerHTML = '';

    if (!items.length) {
      listEl.innerHTML = '<div class="empty">まだ登録されていません。<br>カメラまたは手入力で追加してください。</div>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'item';

      const main = document.createElement('div');
      const jan = document.createElement('div');
      jan.className = 'jan';
      jan.textContent = item.jan;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `登録: ${formatDate(item.addedAt)}`;

      const barcodeWrap = document.createElement('div');
      barcodeWrap.className = 'barcode-wrap';
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', `${item.jan} のバーコード`);
      barcodeWrap.appendChild(canvas);

      main.append(jan, meta, barcodeWrap);

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'コピー';
      copyBtn.addEventListener('click', () => copyText(item.jan));

      const delBtn = document.createElement('button');
      delBtn.textContent = '削除';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', () => deleteItem(index));

      actions.append(copyBtn, delBtn);
      card.append(main, actions);
      listEl.appendChild(card);

      requestAnimationFrame(() => drawEAN(canvas, item.jan));
    });
  }

  // カメラ権限、読み取り、ライト制御
  async function startCamera() {
    if (!('BarcodeDetector' in window)) {
      statusEl.textContent = 'このブラウザは直接スキャンに未対応です。Chrome最新版で開くか、手入力してください。';
      showToast('バーコード検出に未対応です');
      return;
    }

    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = ['ean_13','ean_8'].filter(format => supported.includes(format));
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
      resetScanState();
      cameraBox.style.display = 'block';
      scanBtn.disabled = true;
      scanning = true;
      statusEl.textContent = '同じJANを複数回確認してから登録します。';
      setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
      setupTorch();
      scheduleNextScan(0);
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'カメラを開始できません。HTTPS環境・カメラ権限・対応ブラウザを確認してください。';
      showToast('カメラを開始できません');
      stopCamera();
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
    } catch {
      // 端末が連続オートフォーカス制約を拒否しても、通常のカメラ動作は継続する。
    }
  }

  async function setupTorch() {
    torchBtn.disabled = true;
    try {
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        torchBtn.disabled = false;
        torchBtn.dataset.on = '0';
      }
    } catch {}
  }

  torchBtn.addEventListener('click', async () => {
    try {
      const track = stream.getVideoTracks()[0];
      const on = torchBtn.dataset.on !== '1';
      await track.applyConstraints({ advanced: [{ torch: on }] });
      torchBtn.dataset.on = on ? '1' : '0';
      torchBtn.textContent = on ? 'ライトOFF' : 'ライト';
    } catch {
      showToast('ライトを切り替えられません');
    }
  });

  function setScanFeedback(message) {
    scanFeedbackEl.textContent = message;
  }

  function resetScanState() {
    consensus.reset();
    cooldownUntil = 0;
    waitingForClear = false;
    clearStartedAt = 0;
  }

  function scheduleNextScan(delay = SCAN_CONFIG.intervalMs) {
    clearTimeout(scanTimer);
    if (!scanning) return;
    scanTimer = setTimeout(scanLoop, delay);
  }

  /**
   * 画面全体ではなく、白枠と同じ範囲だけをCanvasへ切り出す。
   * 商品パッケージ上の文字や別のバーコードを検出対象から外すための処理。
   */
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
      const previous = unique.get(jan);
      const area = code.boundingBox.width * code.boundingBox.height;
      if (!previous || area > previous.area) unique.set(jan, { jan, area });
    }
    return [...unique.values()].sort((a, b) => b.area - a.area);
  }

  function handleNoDetection(now) {
    consensus.observe('', now);
    if (!waitingForClear) {
      setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
      return;
    }

    if (!clearStartedAt) clearStartedAt = now;
    if (now - clearStartedAt >= SCAN_CONFIG.clearToRearmMs && now >= cooldownUntil) {
      waitingForClear = false;
      clearStartedAt = 0;
      setScanFeedback('次のバーコードを枠内へ入れてください。');
    }
  }

  function handleDetections(detections, now) {
    clearStartedAt = 0;

    if (waitingForClear || now < cooldownUntil) {
      setScanFeedback('登録済みです。次の商品へ移る前に、バーコードを一度枠外へ出してください。');
      return;
    }

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
    cooldownUntil = now + SCAN_CONFIG.cooldownMs;
    waitingForClear = true;
    clearStartedAt = 0;
    consensus.reset();

    if (addResult.ok) {
      statusEl.textContent = `${jan} を登録しました。`;
      setScanFeedback('登録しました。バーコードを一度枠外へ出してください。');
    } else if (addResult.reason === 'duplicate') {
      setScanFeedback('登録済みのJANです。バーコードを一度枠外へ出してください。');
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

  function stopCamera() {
    scanning = false;
    clearTimeout(scanTimer);
    scanTimer = null;
    resetScanState();
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    cameraBox.style.display = 'none';
    scanBtn.disabled = false;
    torchBtn.disabled = true;
    torchBtn.dataset.on = '0';
    torchBtn.textContent = 'ライト';
    setScanFeedback('バーコードを横向きにして枠内へ入れてください。');
    statusEl.textContent = 'スキャンしたJANはこの端末内に保存されます。';
  }

  // イベント登録
  scanBtn.addEventListener('click', startCamera);
  closeCameraBtn.addEventListener('click', stopCamera);

  addBtn.addEventListener('click', () => {
    const result = addJan(manualInput.value, { source: 'manual' });
    if (result.ok) manualInput.value = '';
    manualInput.focus();
  });

  manualInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addBtn.click();
  });

  manualInput.addEventListener('focus', () => {
    manualInput.select();
  });

  copyAllBtn.addEventListener('click', () => {
    copyText(items.map(x => x.jan).join('\n'));
  });

  clearBtn.addEventListener('click', () => {
    if (!items.length) return;
    if (confirm('保存リストをすべて削除しますか？')) {
      items = [];
      saveItems();
      render();
      showToast('すべて削除しました');
    }
  });

  window.addEventListener('beforeunload', stopCamera);
  render();
})();
