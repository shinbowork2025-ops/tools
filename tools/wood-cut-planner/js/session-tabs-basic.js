(() => {
  'use strict';
  const tabs = document.getElementById('sheetTabs');
  const deleteButton = document.getElementById('deleteSheetButton');
  if (!tabs || !deleteButton) return;

  function enhance() {
    const active = tabs.querySelector('.sheet-tab.active');
    for (const tab of [...tabs.children]) {
      if (!tab.classList.contains('sheet-tab') || tab.parentElement?.classList.contains('sheet-tab-item')) continue;
      const item = document.createElement('div');
      item.className = `sheet-tab-item${tab.classList.contains('active') ? ' active' : ''}`;
      tab.before(item);
      item.append(tab);
    }
    const activeItem = active?.parentElement;
    if (activeItem) {
      deleteButton.hidden = false;
      deleteButton.textContent = '×';
      deleteButton.className = 'sheet-tab-close';
      deleteButton.setAttribute('aria-label', '選択中の材料を削除');
      activeItem.append(deleteButton);
    }
  }

  new MutationObserver(enhance).observe(tabs, { childList: true });
  enhance();
})();
