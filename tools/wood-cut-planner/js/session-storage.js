(() => {
  'use strict';
  const keys = ['komeriWoodCutProjectsV1', 'komeriWoodCutDraftV1', 'komeriWoodCustomMaterialsV1'];
  const clear = () => keys.forEach(key => localStorage.removeItem(key));
  clear();
  window.addEventListener('pagehide', clear);
})();
