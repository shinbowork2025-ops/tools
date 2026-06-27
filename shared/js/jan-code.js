/**
 * JAN（EAN-8／EAN-13）の文字列整形とチェックデジット検証を共通管理する。
 * 画面ごとに同じ計算式を持たせず、判定条件をこのファイルへ集約する。
 */
(() => {
  'use strict';

  const SUPPORTED_LENGTHS = Object.freeze([8, 13]);

  /** 入力値から数字以外を除き、比較・保存用の文字列へ整える。 */
  function normalize(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  /** JANとして扱う8桁または13桁かを確認する。 */
  function hasSupportedLength(value) {
    return SUPPORTED_LENGTHS.includes(String(value ?? '').length);
  }

  /**
   * チェックデジットを除いた7桁または12桁から、末尾の検査数字を計算する。
   * EAN-13は左から1・3、EAN-8は左から3・1の重みを交互に使用する。
   */
  function calculateCheckDigit(body) {
    const digits = String(body ?? '');
    if (!/^\d+$/.test(digits) || ![7, 12].includes(digits.length)) return null;

    const isEan13Body = digits.length === 12;
    let sum = 0;

    for (let index = 0; index < digits.length; index += 1) {
      const digit = Number(digits[index]);
      const weight = isEan13Body
        ? (index % 2 === 0 ? 1 : 3)
        : (index % 2 === 0 ? 3 : 1);
      sum += digit * weight;
    }

    return (10 - (sum % 10)) % 10;
  }

  /** 桁数とチェックデジットの両方が正しい場合だけtrueを返す。 */
  function isValid(value) {
    const code = String(value ?? '');
    if (!/^\d+$/.test(code) || !hasSupportedLength(code)) return false;

    const expected = calculateCheckDigit(code.slice(0, -1));
    return expected !== null && expected === Number(code.at(-1));
  }

  globalThis.JanCode = Object.freeze({
    SUPPORTED_LENGTHS,
    normalize,
    hasSupportedLength,
    calculateCheckDigit,
    isValid
  });
})();
