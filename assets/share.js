(() => {
  'use strict';

  const openButton = document.getElementById('shareQrButton');
  const dialog = document.getElementById('shareDialog');
  if (!openButton || !dialog) return;

  const qrImage = document.getElementById('shareQrImage');
  const urlOutput = document.getElementById('shareUrl');
  const copyButton = document.getElementById('copyShareUrlButton');
  const nativeShareButton = document.getElementById('nativeShareButton');
  const closeButton = document.getElementById('closeShareDialogButton');
  const status = document.getElementById('shareStatus');

  const shareUrl = new URL('./', document.baseURI).href;
  const qrEndpoint = new URL('https://api.qrserver.com/v1/create-qr-code/');
  qrEndpoint.searchParams.set('size', '320x320');
  qrEndpoint.searchParams.set('margin', '12');
  qrEndpoint.searchParams.set('format', 'svg');
  qrEndpoint.searchParams.set('data', shareUrl);

  if (urlOutput) urlOutput.value = shareUrl;
  if (qrImage) {
    qrImage.addEventListener('error', () => {
      qrImage.hidden = true;
      if (status) status.textContent = 'QRコードを取得できませんでした。URL共有またはコピーを利用してください。';
    });
  }

  function ensureQrCode() {
    if (!qrImage || qrImage.src) return;
    qrImage.hidden = false;
    qrImage.src = qrEndpoint.href;
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  if (!navigator.share && nativeShareButton) nativeShareButton.hidden = true;

  async function copyUrl() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      else {
        urlOutput?.focus();
        urlOutput?.select();
        document.execCommand('copy');
      }
      if (status) status.textContent = 'URLをコピーしました。';
    } catch {
      if (status) status.textContent = 'コピーできませんでした。URL欄を長押ししてコピーしてください。';
    }
  }

  openButton.addEventListener('click', () => {
    ensureQrCode();
    if (status) status.textContent = navigator.onLine
      ? 'このQRコードを別の端末で読み取ってください。'
      : 'オフラインのためQRコードを取得できない場合があります。URLコピーは利用できます。';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  closeButton?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
  copyButton?.addEventListener('click', copyUrl);
  nativeShareButton?.addEventListener('click', async () => {
    try {
      await navigator.share({ title: document.title, text: '業務補助ツール', url: shareUrl });
      if (status) status.textContent = '共有画面を開きました。';
    } catch (error) {
      if (error?.name !== 'AbortError' && status) status.textContent = '共有できませんでした。URLコピーを利用してください。';
    }
  });
})();
