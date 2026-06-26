/** 木材JANカメラの画面部品。 */
(()=>{
  const api=globalThis.WoodMaterialJan;if(!api)return;
  const style=document.createElement('style');
  style.textContent='body.wood-camera-open{overflow:hidden}.wood-camera{display:none;position:fixed;inset:0;z-index:1200;background:#111;flex-direction:column;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}.wood-camera.is-open{display:flex}.wood-camera-preview{position:relative;overflow:hidden;flex:1;min-height:0;background:#000}.wood-camera video{display:block;width:100%;height:100%;object-fit:cover}.wood-scan-guide{position:absolute;left:5%;right:5%;top:32%;height:36%;border:3px solid #fff;border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.3);pointer-events:none}.wood-scan-feedback{min-height:44px;padding:10px;background:#17202a;color:#fff;font-size:.82rem;line-height:1.4;text-align:center}.wood-camera-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:#111}.wood-camera-actions button{min-height:46px}';
  document.head.append(style);
  const box=document.createElement('div');box.id='woodCameraBox';box.className='wood-camera';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','木材JANバーコード読み取り');
  box.innerHTML='<div class="wood-camera-preview"><video id="woodVideo" playsinline muted></video><div class="wood-scan-guide"></div></div><div id="woodScanFeedback" class="wood-scan-feedback" aria-live="polite">バーコードを横向きにして枠内へ入れてください。</div><canvas id="woodScanCanvas" hidden></canvas><div class="wood-camera-actions"><button id="woodTorchButton" type="button" disabled>ライト</button><button id="woodCloseCameraButton" type="button">閉じる</button></div>';
  document.body.append(box);
  globalThis.WoodJanCameraUI={box,video:box.querySelector('video'),feedback:box.querySelector('#woodScanFeedback'),canvas:box.querySelector('canvas'),torch:box.querySelector('#woodTorchButton'),close:box.querySelector('#woodCloseCameraButton')};
})();
