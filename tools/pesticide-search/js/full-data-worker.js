/* 大容量の全農薬データをUIスレッドから分離して検索する。 */
'use strict';

importScripts('data.js');

const byCrop = new Map();
const byProduct = new Map();

function baseCrop(value) {
  return String(value || '').split(/[（(]/)[0].trim();
}

function addTo(map, key, row) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function signature(row) {
  return [row[2], baseCrop(row[5]), row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13]].join('\u001f');
}

for (const row of DATA) {
  addTo(byCrop, baseCrop(row[5]), row);
  addTo(byProduct, row[3], row);
}

const cropCounts = [...byCrop].map(([name, rows]) => [name, rows.length]);
const productCounts = [...byProduct].map(([name, rows]) => [name, rows.length]);

function equivalentRows(rows) {
  if (!rows.length) return [];
  const wanted = new Set(rows.map(signature));
  const products = new Set(rows.map(row => row[3]));
  return DATA.filter(row => wanted.has(signature(row)) && !products.has(row[3]));
}

self.addEventListener('message', event => {
  const message = event.data || {};
  const id = message.id;
  try {
    if (message.type === 'PRODUCT') {
      const rows = byProduct.get(message.name) || [];
      self.postMessage({ id, rows, equivalents: equivalentRows(rows) });
      return;
    }
    if (message.type === 'CROP') {
      self.postMessage({ id, rows: byCrop.get(message.name) || [] });
    }
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) });
  }
});

self.postMessage({ type: 'READY', cropCounts, productCounts });
