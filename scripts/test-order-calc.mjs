import assert from 'node:assert/strict';

await import('../tools/order-calculator/js/calc.js');

const { OrderCalc } = globalThis;
assert.ok(OrderCalc, 'OrderCalcが公開されていること');

// 逆正規近似(Acklam)の基準点。
assert.ok(Math.abs(OrderCalc.normInv(0.5)) < 1e-9, 'Φ⁻¹(0.5)=0');
assert.ok(Math.abs(OrderCalc.normInv(0.95) - 1.6449) < 1e-3, 'Φ⁻¹(0.95)≈1.645');
assert.ok(Math.abs(OrderCalc.normInv(0.8571) - 1.0676) < 1e-3, 'Φ⁻¹(0.857)≈1.07');
assert.ok(Number.isNaN(OrderCalc.normInv(0)), '定義域外はNaN');

// 線形補間分位点。
assert.equal(OrderCalc.quantile([10, 20], 0.5), 15);
assert.equal(OrderCalc.quantile([5], 0.9), 5);
assert.ok(Number.isNaN(OrderCalc.quantile([], 0.5)), '空配列はNaN');

// ISO週キー(年またぎ確認)。
assert.equal(OrderCalc.isoWeekKey(new Date(2026, 0, 1)), '2026-W01');
assert.equal(OrderCalc.isoWeekKey(new Date(2027, 0, 1)), '2026-W53');
assert.equal(OrderCalc.isoWeekKey(new Date(2026, 6, 9)), '2026-W28');

const settings = OrderCalc.DEFAULT_SETTINGS;
const standardItem = { riskClass: 'standard', orderUnit: 1, minDisplay: 0, variability: 'mid' };

// 検算ケース1(仕様書9.4): 通常フローで25個。
const case1 = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 30,
  stockOnHand: 5, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 20
}, standardItem, settings);
assert.equal(case1.quantity, 25, '検算ケース1: 推奨25');
assert.equal(case1.classification, 'auto');
assert.ok(Math.abs(case1.detail.ratio - 1.5) < 1e-9, 'r=1.5');
assert.ok(Math.abs(case1.detail.protectionDemand - 22.5) < 1e-9, 'Dp=22.5');
assert.ok(Math.abs(case1.detail.cr - 30 / 35) < 1e-9, 'CR=30/35');
assert.ok(Math.abs(case1.detail.safetyStock - 7.2) < 0.05, 'SS≈7.20');
assert.ok(Math.abs(case1.detail.rawQuantity - 24.7) < 0.05, 'Q≈24.70');
assert.equal(case1.motherDiff, 5, 'マザー差分');

// 検算ケース2: 欠品14日 → A=28(0.3D≤A<0.7D)により信頼性低でcheck。
// 仕様書の「閾値超過」という説明は誤りで、r=2.25は警告範囲0.4〜2.5の内側。
const case2 = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 30,
  stockOnHand: 5, onOrder: 0, oosDaysPast6w: 14, saleFlag: false, motherOrderQty: 0
}, standardItem, settings);
assert.equal(case2.classification, 'check', '検算ケース2: check');
assert.ok(Math.abs(case2.detail.correctedSales6w - 45) < 1e-9, 'S6c=45');
assert.ok(Math.abs(case2.detail.ratio - 2.25) < 1e-9, 'r=2.25');

// 検算ケース3: 週販0.4・在庫が最低陳列数以上 → 発注0・lowRotation。
const case3 = OrderCalc.evaluate({
  lastYearPast6w: 3, lastYearNext4w: 2, thisYearPast6w: 2.4,
  stockOnHand: 3, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, { riskClass: 'standard', orderUnit: 1, minDisplay: 2, variability: 'mid' }, settings);
assert.equal(case3.quantity, 0, '検算ケース3: 発注0');
assert.equal(case3.classification, 'lowRotation');

// 低回転で基準在庫を下回る場合は1発注単位。
const lowRotationOrder = OrderCalc.evaluate({
  lastYearPast6w: 3, lastYearNext4w: 2, thisYearPast6w: 2,
  stockOnHand: 0, onOrder: null, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, { riskClass: 'standard', orderUnit: 4, minDisplay: 2, variability: 'mid' }, settings);
assert.equal(lowRotationOrder.quantity, 4, '低回転: 1発注単位=入数4');

// 前年比が警告範囲(0.4〜2.5)を外れたらcheckで計算続行。
const ratioWarn = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 60,
  stockOnHand: 0, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, standardItem, settings);
assert.equal(ratioWarn.classification, 'check', '前年比3.0はcheck');
assert.ok(ratioWarn.quantity > 0, '参考値は計算される');

// 前年実績0かつ今年販売あり → 係数計算不能でcheck、推奨なし。
const noBaseline = OrderCalc.evaluate({
  lastYearPast6w: 0, lastYearNext4w: 0, thisYearPast6w: 12,
  stockOnHand: 0, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, standardItem, settings);
assert.equal(noBaseline.classification, 'check');
assert.equal(noBaseline.quantity, null);

// 欠品が長すぎる(A<0.3D)場合は補正なし・check・参考値。
const heavyOos = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 10,
  stockOnHand: 0, onOrder: 0, oosDaysPast6w: 35, saleFlag: false, motherOrderQty: 0
}, standardItem, settings);
assert.equal(heavyOos.classification, 'check');
assert.equal(heavyOos.referenceOnly, true);
assert.equal(heavyOos.detail.correctionApplied, false, '補正しない');

// seasonal_end(c=40)はCR≤0.5になり安全在庫0・切り捨て丸め。
const seasonalEnd = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 20,
  stockOnHand: 0, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, { riskClass: 'seasonal_end', orderUnit: 4, minDisplay: 0, variability: 'mid' }, settings);
assert.equal(seasonalEnd.detail.safetyStock, 0, '安全在庫0にクランプ');
assert.equal(seasonalEnd.quantity, 12, '15個を入数4で切り捨て12');

// 在庫十分なら発注なし。
const enoughStock = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 20,
  stockOnHand: 40, onOrder: 0, oosDaysPast6w: 0, saleFlag: false, motherOrderQty: 0
}, standardItem, settings);
assert.equal(enoughStock.quantity, 0);
assert.equal(enoughStock.classification, 'stop');

// 特売フラグはcheck。
const saleFlagged = OrderCalc.evaluate({
  lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 30,
  stockOnHand: 5, onOrder: 0, oosDaysPast6w: 0, saleFlag: true, motherOrderQty: 0
}, standardItem, settings);
assert.equal(saleFlagged.classification, 'check');

// 新商品モード: CR分位点→最低陳列数とのmax→入数切り上げ。
const newItem = OrderCalc.evaluateNewItem({
  similarSales: [4, 8, 10, 12, 20, 6, 9],
  minDisplay: 3, orderUnit: 5, riskClass: 'standard'
}, settings);
assert.equal(newItem.classification, 'newItem');
assert.equal(newItem.quantity % 5, 0, '入数5の倍数');
assert.ok(newItem.quantity >= newItem.detail.quantileValue, '分位点以上');

const fewSamples = OrderCalc.evaluateNewItem({
  similarSales: [4, 8], minDisplay: 0, orderUnit: 1, riskClass: 'standard'
}, settings);
assert.ok(fewSamples.reasons.some(reason => reason.includes('サンプル不足')), 'n<5の警告');

const noSamples = OrderCalc.evaluateNewItem({
  similarSales: [], minDisplay: 0, orderUnit: 1, riskClass: 'standard'
}, settings);
assert.equal(noSamples.quantity, null, '空リストは計算しない');

// ミニFVA誤差計算。
const errors = OrderCalc.recordErrors({
  inputs: { lastYearPast6w: 20, lastYearNext4w: 15, thisYearPast6w: 30, oosDaysPast6w: 0 },
  motherOrderQty: 18,
  actualSalesNext4w: 20
});
assert.equal(errors.naiveError, 5);
assert.equal(errors.motherError, 2);
assert.ok(Math.abs(errors.toolError - 2.5) < 1e-9, '新方式誤差 |22.5-20|');
assert.equal(OrderCalc.recordErrors({ inputs: {}, motherOrderQty: 0, actualSalesNext4w: null }), null);

console.log('発注数計算v2: 検算ケースと境界条件の検査に成功');
