/**
 * JAN-8／JAN-13をCanvasへ描画する。
 * 一覧が長い場合は、画面付近に来たCanvasだけを描画する。
 */
(() => {
  'use strict';

  const PARITY_13 = Object.freeze([
    'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
    'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
  ]);
  const PATTERNS = Object.freeze({
    L: Object.freeze({
      0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101', 4: '0100011',
      5: '0110001', 6: '0101111', 7: '0111011', 8: '0110111', 9: '0001011'
    }),
    G: Object.freeze({
      0: '0100111', 1: '0110011', 2: '0011011', 3: '0100001', 4: '0011101',
      5: '0111001', 6: '0000101', 7: '0010001', 8: '0001001', 9: '0010111'
    }),
    R: Object.freeze({
      0: '1110010', 1: '1100110', 2: '1101100', 3: '1000010', 4: '1011100',
      5: '1001110', 6: '1010000', 7: '1000100', 8: '1001000', 9: '1110100'
    })
  });

  const MODULE_WIDTH = 2;
  const QUIET_MODULES = 10;
  const BAR_HEIGHT = 72;
  const TEXT_HEIGHT = 24;
  const observedCanvases = new WeakSet();
  let observer = null;

  function encodeEan13(jan) {
    const parity = PARITY_13[Number(jan[0])];
    let bits = '101';
    for (let index = 1; index <= 6; index += 1) {
      bits += PATTERNS[parity[index - 1]][jan[index]];
    }
    bits += '01010';
    for (let index = 7; index <= 12; index += 1) bits += PATTERNS.R[jan[index]];
    return `${bits}101`;
  }

  function encodeEan8(jan) {
    let bits = '101';
    for (let index = 0; index < 4; index += 1) bits += PATTERNS.L[jan[index]];
    bits += '01010';
    for (let index = 4; index < 8; index += 1) bits += PATTERNS.R[jan[index]];
    return `${bits}101`;
  }

  function encode(jan) {
    return jan.length === 13 ? encodeEan13(jan) : encodeEan8(jan);
  }

  function dimensions(bits) {
    return {
      width: (bits.length + QUIET_MODULES * 2) * MODULE_WIDTH,
      height: BAR_HEIGHT + TEXT_HEIGHT
    };
  }

  function isGuardModule(janLength, index) {
    if (janLength === 13) return index < 3 || (index >= 45 && index < 50) || index >= 92;
    return index < 3 || (index >= 31 && index < 36) || index >= 64;
  }

  function preparePlaceholder(canvas, jan) {
    const { width, height } = dimensions(encode(jan));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.dataset.jan = jan;
    canvas.setAttribute('aria-busy', 'true');
  }

  function renderNow(canvas, jan) {
    if (!canvas?.isConnected || canvas.dataset.renderedJan === jan) return;

    const bits = encode(jan);
    const { width, height } = dimensions(bits);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(height * devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#000';

    for (let index = 0; index < bits.length; index += 1) {
      if (bits[index] !== '1') continue;
      const heightForBar = isGuardModule(jan.length, index) ? BAR_HEIGHT + 7 : BAR_HEIGHT;
      context.fillRect((QUIET_MODULES + index) * MODULE_WIDTH, 0, MODULE_WIDTH, heightForBar);
    }

    context.font = '16px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(jan, width / 2, height);
    canvas.dataset.renderedJan = jan;
    canvas.removeAttribute('aria-busy');
  }

  function getObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const canvas = entry.target;
        const jan = canvas.dataset.jan || '';
        if (jan) renderNow(canvas, jan);
        observer.unobserve(canvas);
      }
    }, { rootMargin: '400px 0px' });
    return observer;
  }

  function drawEAN(canvas, value) {
    if (!canvas) return;
    const jan = globalThis.JanCode
      ? globalThis.JanCode.normalize(value)
      : String(value ?? '').replace(/\D/g, '');
    if (![8, 13].includes(jan.length) || canvas.dataset.renderedJan === jan) return;

    preparePlaceholder(canvas, jan);
    const lazyObserver = getObserver();
    if (!lazyObserver) {
      renderNow(canvas, jan);
      return;
    }
    if (!observedCanvases.has(canvas)) {
      observedCanvases.add(canvas);
      lazyObserver.observe(canvas);
    }
  }

  globalThis.drawEAN = drawEAN;
  globalThis.JanBarcodeRenderer = Object.freeze({ draw: drawEAN, renderNow });
})();
