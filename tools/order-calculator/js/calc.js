/**
 * 発注数計算ツールv2の計算モジュール。
 *
 * UI・保存処理から独立した純関数の集合。社内データでのバッチ検証時に
 * このファイル単体を移植できる状態を保つこと(DOM・IndexedDB参照禁止)。
 *
 * 粗利率は名目値(既定30%)であり、実際の部門別粗利率は一切使わない。
 */
(() => {
  'use strict';

  /** 過去実績の観測期間(6週)の暦日数。 */
  const HISTORY_DAYS = 42;
  /** 前年今後販売数・保護期間の基準日数(4週)。 */
  const BASE_PROTECTION_DAYS = 28;
  /** 低回転品とみなす週販の閾値。 */
  const LOW_ROTATION_WEEKLY = 0.5;

  const DEFAULT_SETTINGS = Object.freeze({
    grossMarginPct: 30,
    overageCostPresets: Object.freeze({ low: 5, mid: 15, high: 40 }),
    variabilityPresets: Object.freeze({ low: 0.3, mid: 0.6, high: 1.0 }),
    shrinkageWarnRange: Object.freeze({ min: 0.4, max: 2.5 }),
    // 前年比rを1へ縮小する疑似カウント。小さいカウント同士の割り算による
    // 過剰反応を抑える(0で無効)。販売数が大きい商品ほど縮小の影響は消える。
    ratioShrinkK: 5,
    leadTimeDays: 21,
    reviewPeriodDays: 7
  });

  /** riskClassごとに使う過剰コスト率プリセットの対応。 */
  const RISK_TO_PRESET = Object.freeze({
    standard: 'low',
    seasonal_mid: 'mid',
    seasonal_end: 'high'
  });

  /**
   * 標準正規分布の逆累積分布関数(Acklamの有理近似)。
   * 定義域 0<p<1。検証: normInv(0.5)=0、normInv(0.95)≈1.6449(誤差1e-4未満)。
   * scripts/test-order-calc.mjs で自動検査している。
   */
  function normInv(p) {
    if (!(p > 0 && p < 1)) return NaN;

    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01,
      2.445134137142996e+00, 3.754408661907416e+00];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
        / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > pHigh) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
        / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /** 線形補間分位点。xsは数値配列、pは0〜1。空配列はNaN。 */
  function quantile(xs, p) {
    const sorted = xs.filter(value => Number.isFinite(value)).sort((left, right) => left - right);
    if (!sorted.length) return NaN;
    if (sorted.length === 1) return sorted[0];

    const clamped = Math.min(1, Math.max(0, p));
    const position = (sorted.length - 1) * clamped;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, sorted.length - 1);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  /** 日付からISO週キー(例: 2026-W28)を作る。 */
  function isoWeekKey(date = new Date()) {
    // 木曜日基準: その週の木曜が属する年がISO年になる。
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNumber + 3);
    const isoYear = target.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
    const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
    return `${isoYear}-W${String(week).padStart(2, '0')}`;
  }

  /** 目標分位点CRと安全係数zを求める。riskClass→プリセット対応は RISK_TO_PRESET。 */
  function criticalRatio(riskClass, settings) {
    const margin = settings.grossMarginPct;
    const presetKey = RISK_TO_PRESET[riskClass] || 'low';
    const overageCost = settings.overageCostPresets[presetKey];
    const cr = margin / (margin + overageCost);
    return { cr, z: normInv(cr), presetKey, overageCost };
  }

  /** 発注単位への丸め。CR>0.5は切り上げ、CR≤0.5は切り捨て。 */
  function roundToUnit(quantity, orderUnit, cr) {
    const unit = Math.max(1, orderUnit || 1);
    const units = quantity / unit;
    return unit * (cr > 0.5 ? Math.ceil(units) : Math.floor(units));
  }

  /**
   * 単品計算の本体。
   *
   * 適用順: 欠品補正(7.1) → 低回転分岐(7.5、補正後の週販で判定) → 通常フロー(7.2〜7.6)。
   * 欠品補正の信頼性区分(在庫有り日数A)によるcheck強制は低回転分岐の分類より優先する。
   *
   * 検算ケース(scripts/test-order-calc.mjsで自動検査):
   * 1) 前年6週20 / 今年6週30(欠品0日) / 前年今後4週15 / 在庫5 / 発注残0 /
   *    名目粗利30%・standard(c=5) / ばらつき中(0.6)
   *    - 縮小推定なし(k=0、仕様書9.4の条件):
   *      r=1.5, Dp=22.5, CR≈0.857, z≈1.07, μw≈5.63, σw≈3.38, SS≈7.20,
   *      Q=24.70 → 入数1で切り上げ25
   *    - 既定(k=5): r=(30+5)/(20+5)=1.4, Dp=21, μw=5.25, σw=3.15,
   *      SS≈6.73, Q=22.73 → 23
   * 2) 同条件で欠品14日 → A=28(0.3D≤A<0.7D), S6c=45, r生=2.25
   *    → 在庫有り日数の信頼性低下により check
   *      (仕様書9.4の「閾値超過」という説明は誤り。r=2.25は警告範囲0.4〜2.5の内側)
   * 3) 週販0.4・在庫が最低陳列数以上 → 発注0・lowRotation
   */
  function evaluate(inputs, item, rawSettings) {
    const settings = mergeSettings(rawSettings);
    const reasons = [];
    let forceCheck = false;
    let referenceOnly = false;

    // --- 7.1 欠品補正 ---
    const oosDays = clampNumber(inputs.oosDaysPast6w, 0, HISTORY_DAYS);
    const stockedDays = HISTORY_DAYS - oosDays;
    let correctedSales6w = inputs.thisYearPast6w;
    let correctionApplied = false;

    if (stockedDays < 0.3 * HISTORY_DAYS) {
      reasons.push('欠品期間が長すぎるため補正不能。推奨数は参考値');
      forceCheck = true;
      referenceOnly = true;
    } else if (oosDays > 0) {
      correctedSales6w = inputs.thisYearPast6w / stockedDays * HISTORY_DAYS;
      correctionApplied = true;
      reasons.push('欠品補正適用');
      if (stockedDays < 0.7 * HISTORY_DAYS) {
        reasons.push('欠品が多く販売実績の信頼性が低い');
        forceCheck = true;
      }
    }

    if (inputs.saleFlag) {
      reasons.push('特売影響の可能性');
      forceCheck = true;
    }

    // 発注残は任意入力。未入力(null)は0として扱い、その旨を理由に残す。
    const onOrder = Number.isFinite(inputs.onOrder) ? inputs.onOrder : 0;
    if (!Number.isFinite(inputs.onOrder)) reasons.push('発注残未考慮(0扱い)');

    const { cr, z, presetKey, overageCost } = criticalRatio(item.riskClass, settings);
    const detail = {
      rawSales6w: inputs.thisYearPast6w,
      correctedSales6w,
      correctionApplied,
      stockedDays,
      cr,
      z,
      overagePresetKey: presetKey,
      overageCost
    };

    // --- 7.5 低回転分岐(通常フローより優先) ---
    const weeklySales = correctedSales6w / 6;
    detail.weeklySales = weeklySales;

    // 判定には前年も合わせた12週平均を使い、閾値付近での分類の行き来を抑える。
    // 前年実績がない商品は今年の6週平均のみで判定する。
    const weeklyForClass = inputs.lastYearPast6w > 0
      ? (correctedSales6w + inputs.lastYearPast6w) / 12
      : weeklySales;
    detail.weeklyForClass = weeklyForClass;

    if (weeklyForClass < LOW_ROTATION_WEEKLY) {
      const baseStock = Math.max(item.minDisplay || 0, item.orderUnit || 1);
      const available = inputs.stockOnHand + onOrder;
      let quantity = 0;
      if (available < baseStock) {
        quantity = Math.max(1, item.orderUnit || 1);
        reasons.push('低回転品: 基準在庫を下回るため1発注単位');
      } else {
        reasons.push('低回転品: base-stock充足');
      }
      if (inputs.lastYearPast6w === 0) {
        reasons.push('前年実績なし。新商品の場合は新商品モードを使用');
      }
      return buildResult({
        quantity,
        classification: forceCheck ? 'check' : 'lowRotation',
        reasons,
        referenceOnly,
        detail
      }, inputs);
    }

    // --- 7.2 需要予測(前年比補正) ---
    if (inputs.lastYearPast6w === 0) {
      reasons.push('前年実績0のため補正係数を計算不能。新商品モードの利用を検討');
      return buildResult({
        quantity: null,
        classification: 'check',
        reasons,
        referenceOnly: true,
        detail
      }, inputs);
    }

    // 前年比は疑似カウントkで1へ縮小する(小カウント同士の割り算の過剰反応を抑制)。
    // 警告範囲の判定も、実際に需要予測へ使う縮小後のrに対して行う。
    const shrinkK = Math.max(0, Number(settings.ratioShrinkK) || 0);
    const rawRatio = correctedSales6w / inputs.lastYearPast6w;
    const ratio = (correctedSales6w + shrinkK) / (inputs.lastYearPast6w + shrinkK);
    detail.rawRatio = rawRatio;
    detail.ratio = ratio;
    detail.shrinkK = shrinkK;
    const warnRange = settings.shrinkageWarnRange;
    if (ratio < warnRange.min || ratio > warnRange.max) {
      reasons.push(`前年比${ratio.toFixed(2)}が警告範囲(${warnRange.min}〜${warnRange.max})の外。参考値`);
      forceCheck = true;
      referenceOnly = true;
    }

    // 保護期間P。既定28日。設定変更時は4週基準の需要を日割りでスケールする。
    const protectionDays = settings.reviewPeriodDays + settings.leadTimeDays;
    const dailyDemand = inputs.lastYearNext4w * ratio / BASE_PROTECTION_DAYS;
    const protectionDemand = dailyDemand * protectionDays;
    detail.protectionDays = protectionDays;
    detail.protectionDemand = protectionDemand;

    // --- 7.3〜7.4 安全在庫 ---
    // σにはポアソン下限√μを敷く。カウント需要では σ ≥ √μ が物理的下限で、
    // CV×μだけだと週平均が小さい商品の安全在庫を過小評価する。
    const weeklyMean = dailyDemand * 7;
    const cv = settings.variabilityPresets[item.variability] ?? settings.variabilityPresets.mid;
    const weeklySigma = Math.max(cv * weeklyMean, Math.sqrt(Math.max(weeklyMean, 0)));
    let safetyStock = z * weeklySigma * Math.sqrt(protectionDays / 7);
    if (z <= 0) {
      safetyStock = 0;
      reasons.push('季節終盤・安全在庫なし');
    }
    detail.weeklyMean = weeklyMean;
    detail.weeklySigma = weeklySigma;
    detail.safetyStock = safetyStock;

    // --- 7.6 推奨発注数 ---
    const rawQuantity = protectionDemand + safetyStock - inputs.stockOnHand - onOrder;
    detail.rawQuantity = rawQuantity;

    let quantity = rawQuantity > 0 ? Math.max(0, roundToUnit(rawQuantity, item.orderUnit, cr)) : 0;

    // 需要上は発注不要でも、売場の最低陳列数を割り込むなら不足分を補充する。
    const unit = Math.max(1, item.orderUnit || 1);
    const displayShortfall = (item.minDisplay || 0) - inputs.stockOnHand - onOrder;
    if (displayShortfall > 0 && quantity < displayShortfall) {
      quantity = unit * Math.ceil(displayShortfall / unit);
      reasons.push('最低陳列数を確保');
    }

    let classification = 'auto';
    if (quantity <= 0) {
      quantity = 0;
      classification = 'stop';
      reasons.push(rawQuantity <= 0 ? '在庫十分' : '切り捨てにより発注なし');
    }

    if (forceCheck) classification = 'check';
    return buildResult({ quantity, classification, reasons, referenceOnly, detail }, inputs);
  }

  /** 新商品モード(7.7)。similarSalesは類似商品の28日販売数の配列。 */
  function evaluateNewItem(params, rawSettings) {
    const settings = mergeSettings(rawSettings);
    const reasons = [];
    const { cr, z } = criticalRatio(params.riskClass, settings);
    const sales = (params.similarSales || []).filter(value => Number.isFinite(value) && value >= 0);

    if (!sales.length) {
      return {
        quantity: null,
        classification: 'newItem',
        reasons: ['類似商品の販売数が未入力'],
        detail: { cr, z, sampleSize: 0 }
      };
    }
    if (sales.length < 5) reasons.push(`サンプル不足(n=${sales.length})・参考値`);

    const quantileValue = quantile(sales, cr);
    const candidate = Math.max(quantileValue, params.minDisplay || 0);
    const unit = Math.max(1, params.orderUnit || 1);
    const quantity = unit * Math.ceil(candidate / unit);

    return {
      quantity,
      classification: 'newItem',
      reasons,
      detail: { cr, z, sampleSize: sales.length, quantileValue, candidate }
    };
  }

  /**
   * ミニFVA精度比較(8.3)。実績が入ったレコードから3系統の絶対誤差を計算する。
   * 新方式の予測は記録時に保存したtoolForecastNext4wを優先する(設定のkが後から
   * 変わっても「記録時に実際に出した予測」で採点するため)。保存がない旧レコードは
   * 記録時の入力から4週基準で再計算する。
   * 新商品レコードは前年ベースラインが存在しない(inputsは合成ゼロ)ため、
   * ナイーブ誤差が「予測0」として集計を歪めないようスコアリングから除外する。
   */
  function recordErrors(record) {
    if (record.classification === 'newItem') return null;
    const actual = record.actualSalesNext4w;
    if (!Number.isFinite(actual)) return null;

    const inputs = record.inputs;
    const naiveError = Math.abs(inputs.lastYearNext4w - actual);
    const motherError = Math.abs(record.motherOrderQty - actual);

    let forecast = Number.isFinite(record.toolForecastNext4w) ? record.toolForecastNext4w : null;
    if (forecast === null && inputs.lastYearPast6w > 0) {
      const oosDays = clampNumber(inputs.oosDaysPast6w, 0, HISTORY_DAYS);
      const stockedDays = HISTORY_DAYS - oosDays;
      const corrected = (oosDays > 0 && stockedDays >= 0.3 * HISTORY_DAYS)
        ? inputs.thisYearPast6w / stockedDays * HISTORY_DAYS
        : inputs.thisYearPast6w;
      forecast = inputs.lastYearNext4w * (corrected / inputs.lastYearPast6w);
    }
    const toolError = forecast === null ? null : Math.abs(forecast - actual);
    return { naiveError, motherError, toolError };
  }

  function mergeSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    merged.overageCostPresets = { ...DEFAULT_SETTINGS.overageCostPresets, ...(settings?.overageCostPresets || {}) };
    merged.variabilityPresets = { ...DEFAULT_SETTINGS.variabilityPresets, ...(settings?.variabilityPresets || {}) };
    merged.shrinkageWarnRange = { ...DEFAULT_SETTINGS.shrinkageWarnRange, ...(settings?.shrinkageWarnRange || {}) };
    return merged;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function buildResult(result, inputs) {
    const motherDiff = Number.isFinite(result.quantity) && Number.isFinite(inputs.motherOrderQty)
      ? result.quantity - inputs.motherOrderQty
      : null;
    return { ...result, motherDiff };
  }

  globalThis.OrderCalc = Object.freeze({
    HISTORY_DAYS,
    BASE_PROTECTION_DAYS,
    DEFAULT_SETTINGS,
    RISK_TO_PRESET,
    normInv,
    quantile,
    isoWeekKey,
    criticalRatio,
    roundToUnit,
    evaluate,
    evaluateNewItem,
    recordErrors
  });
})();
