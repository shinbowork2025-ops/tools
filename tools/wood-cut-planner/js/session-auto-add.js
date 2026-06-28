(() => {
  'use strict';
  const select = document.getElementById('materialSelect');
  const addButton = document.getElementById('addSheetButton');
  const drawing = document.querySelector('.drawing-column');
  if (!select || !addButton) return;

  select.addEventListener('change', () => {
    if (!select.value) return;
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  addButton.addEventListener('click', () => {
    requestAnimationFrame(() => drawing?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
})();
