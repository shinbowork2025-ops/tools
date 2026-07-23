/**
 * 値入率計算機の計算処理。
 * 仕入値と値入率を個別に検証し、目標値入率を下回らない販売価格を返す。
 */
(() => {
  'use strict';

  const MAX_INTEGER_DIGITS = 12;
  const MAX_DECIMAL_DIGITS = 2;

  function incomplete(message) {
    return { status: 'incomplete', message };
  }

  function invalid(message) {
    return { status: 'invalid', message };
  }

  function parseNumber(value, label) {
    const text = String(value ?? '').trim();
    if (!text) return incomplete(`${label}を入力してください`);
    if (!/^\d+(?:\.\d{0,2})?$/.test(text)) {
      return invalid(`${label}は小数点以下2桁までで入力してください`);
    }

    const [integerPart] = text.split('.');
    if (integerPart.length > MAX_INTEGER_DIGITS) {
      return invalid(`${label}の整数部は${MAX_INTEGER_DIGITS}桁以内にしてください`);
    }

    const number = Number(text);
    if (!Number.isFinite(number)) return invalid(`${label}を確認してください`);
    return { status: 'valid', number };
  }

  function calculate(costValue, rateValue) {
    const costResult = parseNumber(costValue, '仕入値');
    const rateResult = parseNumber(rateValue, '値入率');

    if (costResult.status === 'invalid') return costResult;
    if (rateResult.status === 'invalid') return rateResult;
    if (costResult.status !== 'valid' || rateResult.status !== 'valid') {
      if (costResult.status !== 'valid' && rateResult.status !== 'valid') {
        return incomplete('仕入値と値入率を入力してください');
      }
      return costResult.status !== 'valid' ? costResult : rateResult;
    }

    const cost = costResult.number;
    const ratePercent = rateResult.number;
    if (cost <= 0) return invalid('仕入値は0円より大きい数値にしてください');
    if (ratePercent < 0 || ratePercent >= 100) return invalid('値入率は0%以上100%未満にしてください');

    const rate = ratePercent / 100;
    const rawPrice = cost / (1 - rate);
    const sellingPrice = Math.ceil(rawPrice);
    if (!Number.isSafeInteger(sellingPrice)) return invalid('計算結果が大きすぎます');

    return {
      status: 'valid',
      cost,
      rate,
      ratePercent,
      rawPrice,
      sellingPrice,
      actualRate: (sellingPrice - cost) / sellingPrice
    };
  }

  globalThis.MarkupCalc = Object.freeze({
    MAX_INTEGER_DIGITS,
    MAX_DECIMAL_DIGITS,
    calculate
  });
})();
