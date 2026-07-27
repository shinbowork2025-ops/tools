import { createDeckId, parseAnkiCsv } from './csv-import.js';
import {
  deleteDeck,
  getDeck,
  getDeckProgress,
  listDecks,
  saveDeck,
  saveQuestionProgress
} from './storage.js';
import { createEmptyCard, fsrs } from '../vendor/ts-fsrs.mjs';

const DAILY_NEW_LIMIT = 10;
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m']
});
const allowedHtml = new Set(['BR', 'B', 'STRONG', 'SMALL', 'EM']);
const blockedHtml = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM']);
const elements = Object.fromEntries([
  'appStatus', 'managementView', 'deckCount', 'deckList', 'emptyDecks', 'csvFileInput',
  'importPreview', 'qualificationTitle', 'importSummary', 'confirmImportButton',
  'deckDetails', 'selectedDeckTitle', 'dueCount', 'newCount', 'learnedCount',
  'totalCount', 'studyPlan', 'startStudyButton', 'deleteDeckButton', 'studyView',
  'leaveStudyButton', 'sessionProgress', 'questionCard', 'questionHeading',
  'choiceButtons', 'revealAnswerButton', 'answerArea', 'answerResult', 'answerContent',
  'ratingArea', 'ratingGuide', 'studyComplete', 'completeSummary', 'completeBackButton'
].map(id => [id, document.getElementById(id)]));

const state = {
  summaries: [],
  currentDeck: null,
  progress: new Map(),
  pendingImport: null,
  queue: [],
  sessionTotal: 0,
  sessionReviewed: 0,
  sessionCorrect: 0,
  currentQuestion: null,
  answerCorrect: null
};

function setStatus(message = '', kind = '') {
  elements.appStatus.textContent = message;
  elements.appStatus.dataset.kind = kind;
}

function localDateKey(value = new Date()) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hydrateCard(card) {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined
  };
}

function safeHtml(target, source) {
  const template = document.createElement('template');
  template.innerHTML = String(source || '');
  [...template.content.querySelectorAll('*')].reverse().forEach(node => {
    if (blockedHtml.has(node.tagName)) {
      node.remove();
    } else if (allowedHtml.has(node.tagName)) {
      [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));
    } else {
      node.replaceWith(...node.childNodes);
    }
  });
  target.replaceChildren(...template.content.childNodes);
}

function formatInterval(due, now) {
  const milliseconds = Math.max(0, new Date(due).getTime() - now.getTime());
  const minutes = milliseconds / 60000;
  if (minutes < 1) return '1分未満';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}分後`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.max(1, Math.round(hours))}時間後`;
  const days = hours / 24;
  if (days < 365) return `${Math.max(1, Math.round(days))}日後`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1) : Math.round(years)}年後`;
}

function getStudyCounts() {
  if (!state.currentDeck) return { due: 0, learned: 0, unseen: 0, newToday: 0, newAllowance: 0 };
  const now = Date.now();
  let due = 0;
  let learned = 0;
  let newToday = 0;
  const today = localDateKey();

  for (const question of state.currentDeck.questions) {
    const record = state.progress.get(question.id);
    if (!record) continue;
    learned += 1;
    if (new Date(record.fsrsCard.due).getTime() <= now) due += 1;
    if (record.firstReviewedAt && localDateKey(record.firstReviewedAt) === today) newToday += 1;
  }

  const unseen = state.currentDeck.questions.length - learned;
  return {
    due,
    learned,
    unseen,
    newToday,
    newAllowance: Math.min(unseen, Math.max(0, DAILY_NEW_LIMIT - newToday))
  };
}

function createDeckButton(summary) {
  const button = document.createElement('button');
  button.className = 'deck-button';
  button.type = 'button';
  button.dataset.deckId = summary.id;
  button.setAttribute('aria-pressed', String(state.currentDeck?.id === summary.id));

  const title = document.createElement('strong');
  title.textContent = summary.title;
  const count = document.createElement('span');
  count.textContent = `${summary.questionCount}問`;
  const source = document.createElement('small');
  source.textContent = summary.sourceFile || 'Anki CSV';
  button.append(title, count, source);
  return button;
}

function renderDeckList() {
  elements.deckList.replaceChildren(...state.summaries.map(createDeckButton));
  elements.emptyDecks.hidden = state.summaries.length > 0;
  elements.deckCount.textContent = state.summaries.length ? `${state.summaries.length}資格` : '';
}

function renderDeckDetails() {
  const deck = state.currentDeck;
  elements.deckDetails.hidden = !deck;
  if (!deck) return;

  const counts = getStudyCounts();
  elements.selectedDeckTitle.textContent = deck.title;
  elements.dueCount.textContent = String(counts.due);
  elements.newCount.textContent = String(counts.unseen);
  elements.learnedCount.textContent = String(counts.learned);
  elements.totalCount.textContent = String(deck.questions.length);

  const sessionCount = counts.due + counts.newAllowance;
  if (sessionCount) {
    elements.studyPlan.textContent = `今回は復習期限の${counts.due}問と、新しい${counts.newAllowance}問を学習します。新しい問題は1日${DAILY_NEW_LIMIT}問までです。`;
    elements.startStudyButton.textContent = `学習を始める（${sessionCount}問）`;
    elements.startStudyButton.disabled = false;
  } else if (counts.unseen) {
    elements.studyPlan.textContent = `今日の新しい問題${DAILY_NEW_LIMIT}問は完了しました。期限になった復習問題がここに表示されます。`;
    elements.startStudyButton.textContent = '今日の学習は完了';
    elements.startStudyButton.disabled = true;
  } else {
    elements.studyPlan.textContent = '現在、復習期限を迎えた問題はありません。次の復習時期はFSRSが調整します。';
    elements.startStudyButton.textContent = '現在の復習は完了';
    elements.startStudyButton.disabled = true;
  }
  renderDeckList();
}

async function selectDeck(deckId) {
  setStatus();
  try {
    const [deck, progress] = await Promise.all([getDeck(deckId), getDeckProgress(deckId)]);
    state.currentDeck = deck;
    state.progress = progress;
    renderDeckDetails();
    elements.deckDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    setStatus(`資格を開けませんでした：${error.message}`, 'error');
  }
}

async function refreshDecks(selectId = null) {
  state.summaries = await listDecks();
  renderDeckList();
  if (selectId) await selectDeck(selectId);
}

function buildQueue() {
  const counts = getStudyCounts();
  const now = Date.now();
  const due = state.currentDeck.questions
    .filter(question => {
      const record = state.progress.get(question.id);
      return record && new Date(record.fsrsCard.due).getTime() <= now;
    })
    .sort((left, right) => {
      const leftDue = new Date(state.progress.get(left.id).fsrsCard.due).getTime();
      const rightDue = new Date(state.progress.get(right.id).fsrsCard.due).getTime();
      return leftDue - rightDue;
    });
  const fresh = state.currentDeck.questions
    .filter(question => !state.progress.has(question.id))
    .slice(0, counts.newAllowance);
  return [...due, ...fresh];
}

function showStudyView() {
  setStatus();
  state.queue = buildQueue();
  state.sessionTotal = state.queue.length;
  state.sessionReviewed = 0;
  state.sessionCorrect = 0;
  elements.managementView.hidden = true;
  elements.studyView.hidden = false;
  elements.studyComplete.hidden = true;
  elements.questionCard.hidden = false;
  renderNextQuestion();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNextQuestion() {
  const question = state.queue.shift();
  if (!question) {
    elements.questionCard.hidden = true;
    elements.studyComplete.hidden = false;
    elements.completeSummary.textContent = `${state.sessionReviewed}問を復習しました。${state.sessionCorrect}問正解です。次回の復習時期は回答の評価からFSRSが調整します。`;
    return;
  }

  state.currentQuestion = question;
  state.answerCorrect = null;
  elements.sessionProgress.textContent = `${state.sessionReviewed + 1} / ${state.sessionTotal}`;
  safeHtml(elements.questionHeading, question.front);
  elements.answerArea.hidden = true;
  elements.ratingArea.hidden = true;
  elements.answerResult.textContent = '';
  elements.answerContent.replaceChildren();
  elements.choiceButtons.replaceChildren();

  const canChoose = question.answerKey && question.choiceLabels.includes(question.answerKey);
  elements.revealAnswerButton.hidden = canChoose;
  if (canChoose) {
    question.choiceLabels.forEach(label => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choice = label;
      button.textContent = label;
      button.setAttribute('aria-label', `${label}を選ぶ`);
      elements.choiceButtons.append(button);
    });
  }
  requestAnimationFrame(() => elements.questionHeading.focus({ preventScroll: true }));
}

function showAnswer(selectedChoice = null) {
  const question = state.currentQuestion;
  const choiceButtons = [...elements.choiceButtons.querySelectorAll('button')];
  choiceButtons.forEach(button => {
    button.disabled = true;
    if (button.dataset.choice === question.answerKey) button.dataset.result = 'correct';
    if (button.dataset.choice === selectedChoice && selectedChoice !== question.answerKey) {
      button.dataset.result = 'wrong';
    }
  });

  if (selectedChoice) {
    state.answerCorrect = selectedChoice === question.answerKey;
    elements.answerResult.textContent = state.answerCorrect ? '正解' : `不正解（正答：${question.answerKey}）`;
    elements.answerResult.dataset.kind = state.answerCorrect ? 'correct' : 'wrong';
    elements.ratingGuide.textContent = state.answerCorrect
      ? '正解までの迷い方に合わせて「難しい・普通・簡単」を選びます。'
      : '思い出せなかった問題は「もう一度」を選ぶのがおすすめです。';
  } else {
    elements.answerResult.textContent = '解答・解説';
    elements.answerResult.dataset.kind = '';
    elements.ratingGuide.textContent = '思い出せた感覚に近いものを選んでください。';
  }

  safeHtml(elements.answerContent, question.back);
  elements.answerArea.hidden = false;
  elements.ratingArea.hidden = false;
  elements.revealAnswerButton.hidden = true;

  const now = new Date();
  const existing = state.progress.get(question.id);
  const card = existing ? hydrateCard(existing.fsrsCard) : createEmptyCard(now);
  const preview = scheduler.repeat(card, now);
  document.querySelectorAll('.rating-buttons button').forEach(button => {
    const rating = Number(button.dataset.rating);
    button.querySelector('span').textContent = formatInterval(preview[rating].card.due, now);
  });
  elements.answerArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function applyRating(rating) {
  const buttons = [...document.querySelectorAll('.rating-buttons button')];
  buttons.forEach(button => { button.disabled = true; });
  const now = new Date();
  const question = state.currentQuestion;
  const previous = state.progress.get(question.id);
  const card = previous ? hydrateCard(previous.fsrsCard) : createEmptyCard(now);
  const result = scheduler.next(card, now, rating);
  const record = {
    deckId: state.currentDeck.id,
    questionId: question.id,
    fsrsCard: result.card,
    firstReviewedAt: previous?.firstReviewedAt || now,
    lastReviewedAt: now,
    reviewCount: (previous?.reviewCount || 0) + 1,
    correctCount: (previous?.correctCount || 0) + Number(state.answerCorrect === true)
  };

  try {
    await saveQuestionProgress(record);
    state.progress.set(question.id, record);
    state.sessionReviewed += 1;
    state.sessionCorrect += Number(state.answerCorrect === true);
    buttons.forEach(button => { button.disabled = false; });
    renderNextQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    setStatus(`学習履歴を保存できませんでした：${error.message}`, 'error');
  }
}

async function leaveStudy() {
  elements.studyView.hidden = true;
  elements.managementView.hidden = false;
  await selectDeck(state.currentDeck.id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

elements.deckList.addEventListener('click', event => {
  const button = event.target.closest('[data-deck-id]');
  if (button) selectDeck(button.dataset.deckId);
});

elements.csvFileInput.addEventListener('change', async () => {
  const file = elements.csvFileInput.files?.[0];
  if (!file) return;
  setStatus('CSVを確認しています。');
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('CSVは10MB以下にしてください。');
    state.pendingImport = { ...parseAnkiCsv(await file.text(), file.name), sourceFile: file.name };
    elements.qualificationTitle.value = state.pendingImport.title;
    const duplicateText = state.pendingImport.duplicates
      ? ` 重複${state.pendingImport.duplicates}問は除外します。`
      : '';
    elements.importSummary.textContent = `${state.pendingImport.questions.length}問を確認しました。選択式として使える問題は${state.pendingImport.multipleChoiceCount}問です。${duplicateText}`;
    elements.importPreview.hidden = false;
    setStatus('内容を確認し、資格名を決めて登録してください。');
  } catch (error) {
    state.pendingImport = null;
    elements.importPreview.hidden = true;
    setStatus(`CSVを読み込めませんでした：${error.message}`, 'error');
  } finally {
    elements.csvFileInput.value = '';
  }
});

elements.confirmImportButton.addEventListener('click', async () => {
  const title = elements.qualificationTitle.value.trim();
  if (!state.pendingImport || !title) {
    setStatus('資格名を入力してください。', 'error');
    elements.qualificationTitle.focus();
    return;
  }

  const id = createDeckId(title);
  elements.confirmImportButton.disabled = true;
  try {
    const deck = {
      id,
      title,
      sourceFile: state.pendingImport.sourceFile,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: state.pendingImport.questions
    };
    await saveDeck(deck);
    state.pendingImport = null;
    elements.importPreview.hidden = true;
    await refreshDecks(id);
    setStatus(`${title}の${deck.questions.length}問を端末へ登録しました。`, 'success');
  } catch (error) {
    setStatus(`登録できませんでした：${error.message}`, 'error');
  } finally {
    elements.confirmImportButton.disabled = false;
  }
});

elements.startStudyButton.addEventListener('click', showStudyView);
elements.choiceButtons.addEventListener('click', event => {
  const button = event.target.closest('[data-choice]');
  if (button && elements.answerArea.hidden) showAnswer(button.dataset.choice);
});
elements.revealAnswerButton.addEventListener('click', () => showAnswer());
document.querySelector('.rating-buttons').addEventListener('click', event => {
  const button = event.target.closest('[data-rating]');
  if (button) applyRating(Number(button.dataset.rating));
});
elements.leaveStudyButton.addEventListener('click', leaveStudy);
elements.completeBackButton.addEventListener('click', leaveStudy);
elements.deleteDeckButton.addEventListener('click', async () => {
  if (!state.currentDeck) return;
  const { id, title } = state.currentDeck;
  if (!window.confirm(`「${title}」の登録問題と学習履歴をこの端末から削除しますか？`)) return;
  try {
    await deleteDeck(id);
    state.currentDeck = null;
    state.progress = new Map();
    elements.deckDetails.hidden = true;
    await refreshDecks();
    setStatus(`${title}をこの端末から削除しました。`, 'success');
  } catch (error) {
    setStatus(`削除できませんでした：${error.message}`, 'error');
  }
});

refreshDecks().catch(error => setStatus(`保存領域を準備できませんでした：${error.message}`, 'error'));
