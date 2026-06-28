(() => {
  'use strict';

  const STORAGE_KEY = 'komeriToolFavoritesV1';
  const grid = document.querySelector('.tool-grid');
  if (!grid || grid.dataset.favoritesReady === '1') return;
  grid.dataset.favoritesReady = '1';

  const originalLinks = [...grid.querySelectorAll(':scope > a.tool-card')];
  const cards = originalLinks.map((link, index) => {
    const path = new URL(link.getAttribute('href'), document.baseURI).pathname.replace(/\/$/, '');
    const id = path.split('/').pop() || `tool-${index + 1}`;
    const title = link.querySelector('h2')?.textContent?.replace('（試作版）', '') || 'ツール';
    const shell = document.createElement('article');
    shell.className = 'tool-card-shell';
    shell.dataset.toolId = id;
    shell.dataset.defaultOrder = String(index);

    link.before(shell);
    link.classList.remove('tool-card');
    link.classList.add('tool-card-link');

    const button = document.createElement('button');
    button.className = 'favorite-button';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.dataset.title = title;
    button.innerHTML = '<span aria-hidden="true">☆</span>';

    shell.append(link, button);
    return shell;
  });

  if (!cards.length) return;
  const cardById = new Map(cards.map(card => [card.dataset.toolId, card]));

  function loadFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(stored) ? stored.filter(id => cardById.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const favorites = loadFavorites();

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // 保存できない環境でも、現在の画面内では並び替えを維持する。
    }
  }

  function updateButton(card) {
    const button = card.querySelector('.favorite-button');
    const active = favorites.has(card.dataset.toolId);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `${button.dataset.title}をお気に入り${active ? 'から解除' : 'に追加'}`);
    button.querySelector('[aria-hidden="true"]').textContent = active ? '★' : '☆';
  }

  function reorderCards() {
    cards
      .slice()
      .sort((left, right) => {
        const favoriteDifference = Number(favorites.has(right.dataset.toolId)) - Number(favorites.has(left.dataset.toolId));
        if (favoriteDifference) return favoriteDifference;
        return Number(left.dataset.defaultOrder) - Number(right.dataset.defaultOrder);
      })
      .forEach(card => grid.append(card));
  }

  cards.forEach(card => {
    updateButton(card);
    card.querySelector('.favorite-button').addEventListener('click', () => {
      const id = card.dataset.toolId;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      updateButton(card);
      reorderCards();
    });
  });

  reorderCards();
})();
