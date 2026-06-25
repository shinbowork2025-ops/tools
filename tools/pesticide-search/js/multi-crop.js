/** 複数作物に共通する農薬名の抽出と、作物別登録行のグループ化を担当する。 */
(() => {
  'use strict';

  function uniqueCrops(crops) {
    return [...new Set((crops || []).filter(Boolean))];
  }

  /**
   * 選択された全作物に、同一の農薬名で登録されている製品名を返す。
   * 名前は登録データの文字列が完全一致した場合だけ同一とみなす。
   */
  function findCommonProductNames(crops, getRowsForCrop) {
    const selected = uniqueCrops(crops);
    if (selected.length < 2 || typeof getRowsForCrop !== 'function') return [];

    const productSets = selected.map(crop => {
      const names = (getRowsForCrop(crop) || []).map(row => row?.[3]).filter(Boolean);
      return new Set(names);
    });

    if (productSets.some(set => set.size === 0)) return [];
    productSets.sort((a, b) => a.size - b.size);

    return [...productSets[0]]
      .filter(name => productSets.slice(1).every(set => set.has(name)))
      .sort((a, b) => a.localeCompare(b, 'ja'));
  }

  /**
   * 共通農薬ごとに、選択作物別の登録行をまとめる。
   * Map<農薬名, Map<作物名, 登録行[]>> の形で返す。
   */
  function groupRowsByProductAndCrop(crops, productNames, getRowsForCrop) {
    const selected = uniqueCrops(crops);
    const allowedProducts = new Set(productNames || []);
    const grouped = new Map();

    for (const crop of selected) {
      for (const row of getRowsForCrop(crop) || []) {
        const productName = row?.[3];
        if (!allowedProducts.has(productName)) continue;
        if (!grouped.has(productName)) grouped.set(productName, new Map());
        const byCrop = grouped.get(productName);
        if (!byCrop.has(crop)) byCrop.set(crop, []);
        byCrop.get(crop).push(row);
      }
    }

    return grouped;
  }

  globalThis.PesticideMultiCrop = Object.freeze({
    findCommonProductNames,
    groupRowsByProductAndCrop
  });
})();
