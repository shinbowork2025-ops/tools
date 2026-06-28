(() => {
  'use strict';

  const STORAGE_KEY = 'komeriToolFavoritesV1';
  const grid = document.getElementById('toolGrid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.tool-card[data-tool-id]')];
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

  function cardTitle(card) {
    return card.querySelector('h2')?.textContent?.replace('（試作版）', '') || 'ツール';
  }

  function updateButton(card) {
    const button = card.querySelector('.favorite-button');
    if (!button) return;
    const active = favorites.has(card.dataset.toolId);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `${cardTitle(card)}をお気に入り${active ? 'から解除' : 'に追加'}`);
    const mark = button.querySelector('[aria-hidden="true"]');
    if (mark) mark.textContent = active ? '★' : '☆';
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
    card.querySelector('.favorite-button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
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
