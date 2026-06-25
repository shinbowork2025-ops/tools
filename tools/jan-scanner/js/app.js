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

  let items = loadItems();
  let stream = null;
  let detector = null;
  let scanning = false;
  let lastDetected = '';
  let lastDetectedAt = 0;

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

  function addJan(raw) {
    const jan = normalizeJan(raw);
    if (!isValidJanLength(jan)) {
      showToast('JANは8桁または13桁です');
      return false;
    }
    if (!validateCheckDigit(jan)) {
      const ok = confirm('チェックデジットが一致しません。それでも追加しますか？');
      if (!ok) return false;
    }
    if (items.some(x => x.jan === jan)) {
      showToast('すでに登録されています');
      return false;
    }

    items.unshift({ jan, addedAt: new Date().toISOString() });
    saveItems();
    render();
    showToast('追加しました');
    if (navigator.vibrate) navigator.vibrate(80);
    return true;
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
      const formats = ['ean_13','ean_8'].filter(f => supported.includes(f));
      if (!formats.length) throw new Error('EAN未対応');

      detector = new BarcodeDetector({ formats });
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();
      cameraBox.style.display = 'block';
      scanBtn.disabled = true;
      scanning = true;
      statusEl.textContent = '枠内にバーコードを入れてください。';
      setupTorch();
      scanLoop();
    } catch (e) {
      statusEl.textContent = 'カメラを開始できません。HTTPS環境・カメラ権限・対応ブラウザを確認してください。';
      showToast('カメラを開始できません');
      stopCamera();
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

  async function scanLoop() {
    if (!scanning || !detector) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        const raw = normalizeJan(codes[0].rawValue);
        const now = Date.now();
        if (raw && (raw !== lastDetected || now - lastDetectedAt > 1800)) {
          lastDetected = raw;
          lastDetectedAt = now;
          if (addJan(raw)) {
            statusEl.textContent = `${raw} を登録しました。続けてスキャンできます。`;
          }
        }
      }
    } catch {}
    if (scanning) requestAnimationFrame(scanLoop);
  }

  function stopCamera() {
    scanning = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
    cameraBox.style.display = 'none';
    scanBtn.disabled = false;
    torchBtn.disabled = true;
    torchBtn.textContent = 'ライト';
    statusEl.textContent = 'スキャンしたJANはこの端末内に保存されます。';
  }

  // イベント登録
  scanBtn.addEventListener('click', startCamera);
  closeCameraBtn.addEventListener('click', stopCamera);

  addBtn.addEventListener('click', () => {
    if (addJan(manualInput.value)) manualInput.value = '';
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
