/**
 * 発注数計算用JANカメラのDOMを起動時に1度だけ組み立てる。
 * 木材カット図のjan-camera-ui.jsと同じ構成(スタイル・要素・公開方法)を踏襲する。
 */
(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = 'body.order-camera-open{overflow:hidden}.order-camera{display:none;position:fixed;inset:0;z-index:1200;background:#111;flex-direction:column;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}.order-camera.is-open{display:flex}.order-camera-preview{position:relative;overflow:hidden;flex:1;min-height:0;background:#000}.order-camera video{display:block;width:100%;height:100%;object-fit:cover}.order-scan-guide{position:absolute;left:5%;right:5%;top:32%;height:36%;border:3px solid #fff;border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.3);pointer-events:none}.order-scan-feedback{min-height:44px;padding:10px;background:#17202a;color:#fff;font-size:.82rem;line-height:1.4;text-align:center}.order-camera-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:#111}.order-camera-actions button{min-height:46px}';
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.id = 'orderCameraBox';
  box.className = 'order-camera';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', '商品JANバーコード読み取り');
  box.innerHTML = '<div class="order-camera-preview"><video id="orderVideo" playsinline muted></video><div class="order-scan-guide"></div></div><div id="orderScanFeedback" class="order-scan-feedback" aria-live="polite">バーコードを横向きにして枠内へ入れてください。</div><canvas id="orderScanCanvas" hidden></canvas><div class="order-camera-actions"><button id="orderTorchButton" type="button" disabled>ライト</button><button id="orderCloseCameraButton" type="button">閉じる</button></div>';
  document.body.appendChild(box);

  globalThis.OrderJanCameraUI = {
    box,
    video: box.querySelector('video'),
    feedback: box.querySelector('#orderScanFeedback'),
    canvas: box.querySelector('canvas'),
    torch: box.querySelector('#orderTorchButton'),
    close: box.querySelector('#orderCloseCameraButton')
  };
})();
