(() => {
  'use strict';

  self.KOMERI_TOOL_ASSETS = Object.freeze({
    'wood-cut-planner': [
      './tools/wood-cut-planner/',
      './tools/wood-cut-planner/index.html',
      './tools/wood-cut-planner/styles.css',
      './tools/wood-cut-planner/js/materials.js',
      './tools/wood-cut-planner/js/model.js',
      './tools/wood-cut-planner/js/material-jan.js',
      './tools/wood-cut-planner/js/jan-camera-ui.js',
      './tools/wood-cut-planner/js/jan-scanner.js',
      './tools/wood-cut-planner/js/app.js',
      './tools/wood-cut-planner/js/session-storage.js',
      './tools/wood-cut-planner/js/session-ui.js',
      './tools/wood-cut-planner/js/session-tabs-basic.js',
      './tools/wood-cut-planner/js/session-auto-add.js',
      './tools/jan-scanner/js/scan-consensus.js'
    ],
    'jan-scanner': [
      './tools/jan-scanner/',
      './tools/jan-scanner/index.html',
      './tools/jan-scanner/styles.css',
      './tools/jan-scanner/js/app.js',
      './tools/jan-scanner/js/list-store.js',
      './tools/jan-scanner/js/scan-consensus.js',
      './tools/jan-scanner/js/barcode-renderer.js'
    ],
    'pesticide-search': [
      './tools/pesticide-search/',
      './tools/pesticide-search/index.html',
      './tools/pesticide-search/styles.css',
      './tools/pesticide-search/js/garden-data.js',
      './tools/pesticide-search/js/data-loader.js',
      './tools/pesticide-search/js/full-data-worker.js',
      './tools/pesticide-search/js/app.js',
      './tools/pesticide-search/js/multi-crop.js',
      './tools/pesticide-search/js/multi-crop-ui.js'
    ],
    'chainsaw-parts-search': [
      './tools/chainsaw-parts-search/',
      './tools/chainsaw-parts-search/index.html',
      './tools/chainsaw-parts-search/styles.css',
      './tools/chainsaw-parts-search/js/app.js',
      './tools/chainsaw-parts-search/js/data.js'
    ],
    'power-tool-blade-search': [
      './tools/power-tool-blade-search/',
      './tools/power-tool-blade-search/index.html',
      './tools/power-tool-blade-search/styles.css',
      './tools/power-tool-blade-search/js/app.js',
      './tools/power-tool-blade-search/js/data.js'
    ],
    'order-calculator': [
      './tools/order-calculator/',
      './tools/order-calculator/index.html',
      './tools/order-calculator/styles.css',
      './tools/order-calculator/js/app.js',
      './tools/order-calculator/js/calc.js',
      './tools/order-calculator/js/db.js',
      './tools/order-calculator/js/jan-camera-ui.js',
      './tools/order-calculator/js/jan-scanner.js',
      './tools/jan-scanner/js/scan-consensus.js'
    ],
    'hose-length': [
      './tools/hose-length/',
      './tools/hose-length/index.html',
      './tools/hose-length/styles.css',
      './tools/hose-length/js/app.js'
    ]
  });

  self.KOMERI_OPTIONAL_ASSETS = Object.freeze({
    'pesticide-all-data': [
      './tools/pesticide-search/js/data.js'
    ]
  });
})();
