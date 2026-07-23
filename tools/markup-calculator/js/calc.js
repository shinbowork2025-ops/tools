/**
 * 値入率計算機の計算処理。
 * 複合入力「仕入値.値入率」を解析し、目標値入率を下回らない販売価格を返す。
 */
(() => {
  'use strict';

  const MAX_INPUT_LENGTH = 15;

  function incomplete(message) {
    return { status: 'incomplete', message };
  }

  function invalid(message) {
    return { status: 'invalid', message };
  }

  function parseInput(value) {
    const text = String(value ?? '').trim();
    if (!text) return incomplete('仕入値と値入率を入力してください');
    if (!/^\d*\.?\d*$/.test(text) || (text.match(/\./g) || []).length > 1) {
      return invalid('「仕入値.値入率」の形式で入力してください');
    }
    if (!text.includes('.')) return incomplete('小数点に続けて値入率を入力してください');

    const [costDigits, rateDigits] = text.split('.');
    if (!costDigits || !rateDigits) return incomplete('小数点の前後を入力してください');

    const cost = Number(costDigits);
    const rate = Number(`0.${rateDigits}`);
    if (!Number.isSafeInteger(cost) || cost <= 0) return invalid('仕入値は1円以上の整数にしてください');
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) return invalid('値入率は0%以上100%未満にしてください');

    const rawPrice = cost / (1 - rate);
    const sellingPrice = Math.ceil(rawPrice);
    if (!Number.isSafeInteger(sellingPrice)) return invalid('計算結果が大きすぎます');

    return {
      status: 'valid',
      cost,
      rate,
      ratePercent: rate * 100,
      rawPrice,
      sellingPrice,
      actualRate: sellingPrice === 0 ? 0 : (sellingPrice - cost) / sellingPrice
    };
  }

  globalThis.MarkupCalc = Object.freeze({
    MAX_INPUT_LENGTH,
    parseInput
  });
})();
