/**
 * JAN-8／JAN-13をCanvasへ描画する処理。
 * カメラや保存処理から独立させ、表示方法だけを修正できるようにする。
 */
function parity13(firstDigit) {
    return [
      'LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG',
      'LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'
    ][Number(firstDigit)];
  }

  const L = {
    '0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011',
    '5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011'
  };
  const G = {
    '0':'0100111','1':'0110011','2':'0011011','3':'0100001','4':'0011101',
    '5':'0111001','6':'0000101','7':'0010001','8':'0001001','9':'0010111'
  };
  const R = {
    '0':'1110010','1':'1100110','2':'1101100','3':'1000010','4':'1011100',
    '5':'1001110','6':'1010000','7':'1000100','8':'1001000','9':'1110100'
  };

  function encodeEAN13(jan) {
    const parity = parity13(jan[0]);
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += parity[i-1] === 'L' ? L[jan[i]] : G[jan[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[jan[i]];
    bits += '101';
    return bits;
  }

  function encodeEAN8(jan) {
    let bits = '101';
    for (let i = 0; i < 4; i++) bits += L[jan[i]];
    bits += '01010';
    for (let i = 4; i < 8; i++) bits += R[jan[i]];
    bits += '101';
    return bits;
  }

  function drawEAN(canvas, jan) {
    const bits = jan.length === 13 ? encodeEAN13(jan) : encodeEAN8(jan);
    const moduleWidth = 2;
    const quiet = 10;
    const barHeight = 72;
    const textHeight = 24;
    const width = (bits.length + quiet * 2) * moduleWidth;
    const height = barHeight + textHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000';

    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        const isGuard = jan.length === 13
          ? (i < 3 || (i >= 45 && i < 50) || i >= 92)
          : (i < 3 || (i >= 31 && i < 36) || i >= 64);
        ctx.fillRect((quiet + i) * moduleWidth, 0, moduleWidth, isGuard ? barHeight + 7 : barHeight);
      }
    }

    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(jan, width / 2, height);
  }
