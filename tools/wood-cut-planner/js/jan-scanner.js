/**
 * 木材用JANカメラスキャナー。
 *
 * 読取枠内のJANだけを対象にし、同じ値を複数回確認してから材料選択へ渡す。
 * カメラ・ライト・連続読取の状態をこのファイルへ閉じ込める。
 */
(() => {
  'use strict';

  const materialJan = globalThis.WoodMaterialJan;
  const cameraUi = globalThis.WoodJanCameraUI;
  if (!materialJan || !cameraUi) return;

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

  const scanContext = cameraUi.canvas.getContext('2d', { alpha: false });
  const Consensus = globalThis.JanScanConsensus;
  const consensus = Consensus ? new Consensus({
    requiredHits: SCAN_CONFIG.requiredHits,
    maxGapMs: SCAN_CONFIG.maxGapMs,
    minDurationMs: SCAN_CONFIG.minDurationMs,
    windowMs: SCAN_CONFIG.confirmationWindowMs
  }) : null;

  let stream = null;
  let detector = null;
  let scanning = false;
  let scanTimer = null;

  function setFeedback(message) {
    cameraUi.feedback.textContent = message;
  }

  function stopCamera(message = 'JANを読み取ると登録材料を自動選択します。') {
    scanning = false;
    clearTimeout(scanTimer);
    scanTimer = null;
    consensus?.reset();

    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    detector = null;
    cameraUi.video.srcObject = null;

    cameraUi.box.classList.remove('is-open');
    document.body.classList.remove('wood-camera-open');
    materialJan.startButton.disabled = false;
    cameraUi.torch.disabled = true;
    cameraUi.torch.dataset.on = '0';
    cameraUi.torch.textContent = 'ライト';
    setFeedback('バーコードを横向きにして枠内へ入れてください。');
    materialJan.status(message);
  }

  async function configureCameraTrack() {
    try {
      const track = stream?.getVideoTracks()[0];
      const capabilities = track?.getCapabilities ? track.getCapabilities() : {};

      if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }

      if (capabilities.torch) {
        cameraUi.torch.disabled = false;
        cameraUi.torch.dataset.on = '0';
      }
    } catch {
      // 連続フォーカスやライトは端末依存のため、失敗しても読取自体は継続する。
    }
  }

  async function toggleTorch() {
    try {
      const track = stream?.getVideoTracks()[0];
      if (!track) return;

      const nextState = cameraUi.torch.dataset.on !== '1';
      await track.applyConstraints({ advanced: [{ torch: nextState }] });
      cameraUi.torch.dataset.on = nextState ? '1' : '0';
      cameraUi.torch.textContent = nextState ? 'ライトOFF' : 'ライト';
    } catch {
      materialJan.status('ライトを切り替えられません。');
    }
  }

  function captureGuideArea() {
    const sourceWidth = cameraUi.video.videoWidth;
    const sourceHeight = cameraUi.video.videoHeight;
    if (!sourceWidth || !sourceHeight) return false;

    const sourceX = Math.round(sourceWidth * SCAN_CONFIG.cropX);
    const sourceY = Math.round(sourceHeight * SCAN_CONFIG.cropY);
    const cropWidth = Math.round(sourceWidth * SCAN_CONFIG.cropWidth);
    const cropHeight = Math.round(sourceHeight * SCAN_CONFIG.cropHeight);
    const scale = Math.min(1, SCAN_CONFIG.maxCanvasWidth / cropWidth);
    const targetWidth = Math.max(1, Math.round(cropWidth * scale));
    const targetHeight = Math.max(1, Math.round(cropHeight * scale));

    if (cameraUi.canvas.width !== targetWidth || cameraUi.canvas.height !== targetHeight) {
      cameraUi.canvas.width = targetWidth;
      cameraUi.canvas.height = targetHeight;
    }

    scanContext.drawImage(
      cameraUi.video,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );
    return true;
  }

  function hasReliableGeometry(code) {
    const box = code?.boundingBox;
    if (!box || !cameraUi.canvas.width || !cameraUi.canvas.height) return false;

    const widthRatio = box.width / cameraUi.canvas.width;
    const heightRatio = box.height / cameraUi.canvas.height;
    const aspectRatio = box.width / Math.max(box.height, 1);

    return widthRatio >= SCAN_CONFIG.minBoxWidthRatio
      && heightRatio >= SCAN_CONFIG.minBoxHeightRatio
      && aspectRatio >= SCAN_CONFIG.minAspectRatio;
  }

  function reliableDetections(codes) {
    const uniqueByJan = new Map();

    for (const code of codes) {
      const jan = materialJan.digits(code.rawValue);
      if (!['ean_13', 'ean_8'].includes(code.format)) continue;
      if (!materialJan.valid(jan) || !hasReliableGeometry(code)) continue;

      const area = code.boundingBox.width * code.boundingBox.height;
      const previous = uniqueByJan.get(jan);
      if (!previous || area > previous.area) uniqueByJan.set(jan, { jan, area });
    }

    return [...uniqueByJan.values()].sort((left, right) => right.area - left.area);
  }

  function scheduleNextScan(delay = SCAN_CONFIG.intervalMs) {
    clearTimeout(scanTimer);
    if (scanning) scanTimer = setTimeout(scanLoop, delay);
  }

  function handleDetection(detections) {
    if (detections.length > 1) {
      consensus?.reset();
      setFeedback('複数のバーコードがあります。1つだけ枠内へ入れてください。');
      return false;
    }

    if (!detections.length) {
      consensus?.observe('', Date.now());
      setFeedback('バーコードを横向きにして枠内へ入れてください。');
      return false;
    }

    const jan = detections[0].jan;
    const result = consensus?.observe(jan, Date.now()) || {
      confirmed: true,
      hits: 1,
      requiredHits: 1
    };

    if (!result.confirmed) {
      setFeedback(`読取確認中 ${result.hits}/${result.requiredHits}：${jan}`);
      return false;
    }

    stopCamera(`${jan} を読み取りました。`);
    navigator.vibrate?.([100, 40, 100]);
    materialJan.select(jan);
    return true;
  }

  async function scanLoop() {
    if (!scanning || !detector) return;

    try {
      if (captureGuideArea()) {
        const codes = await detector.detect(cameraUi.canvas);
        if (handleDetection(reliableDetections(codes))) return;
      }
    } catch (error) {
      console.warn('木材JANを検出できませんでした。', error);
    }

    scheduleNextScan();
  }

  async function startCamera() {
    if (!('BarcodeDetector' in window)) {
      materialJan.status('カメラ読取に未対応です。JANを検索欄へ手入力し、Enterを押してください。');
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

      cameraUi.video.srcObject = stream;
      await cameraUi.video.play();
      await configureCameraTrack();
      consensus?.reset();

      cameraUi.box.classList.add('is-open');
      document.body.classList.add('wood-camera-open');
      materialJan.startButton.disabled = true;
      scanning = true;
      materialJan.status('木材商品のJANを読み取り中です。');
      scheduleNextScan(0);
    } catch (error) {
      console.error(error);
      stopCamera('カメラを開始できません。HTTPS・カメラ権限・対応ブラウザを確認してください。');
    }
  }

  materialJan.startButton.addEventListener('click', startCamera);
  cameraUi.close.addEventListener('click', () => stopCamera());
  cameraUi.torch.addEventListener('click', toggleTorch);
  window.addEventListener('beforeunload', () => stopCamera());
})();
