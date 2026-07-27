const DATABASE_NAME = 'komeri-qualification-study';
const DATABASE_VERSION = 1;
const DECK_STORE = 'decks';
const PROGRESS_STORE = 'progress';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

let databasePromise;

function openDatabase() {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('このブラウザは問題の端末保存に対応していません。'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DECK_STORE)) {
        database.createObjectStore(DECK_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        const store = database.createObjectStore(PROGRESS_STORE, {
          keyPath: ['deckId', 'questionId']
        });
        store.createIndex('deckId', 'deckId', { unique: false });
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });

  return databasePromise;
}

export async function listDecks() {
  const database = await openDatabase();
  const transaction = database.transaction(DECK_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(DECK_STORE).getAll());
  return records
    .map(({ questions, ...metadata }) => ({ ...metadata, questionCount: questions.length }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getDeck(deckId) {
  const database = await openDatabase();
  const transaction = database.transaction(DECK_STORE, 'readonly');
  return requestResult(transaction.objectStore(DECK_STORE).get(deckId));
}

export async function saveDeck(deck) {
  const database = await openDatabase();
  const transaction = database.transaction([DECK_STORE, PROGRESS_STORE], 'readwrite');
  const deckStore = transaction.objectStore(DECK_STORE);
  const progressStore = transaction.objectStore(PROGRESS_STORE);
  const validQuestionIds = new Set(deck.questions.map(question => question.id));

  deckStore.put(deck);
  const oldProgress = await requestResult(progressStore.index('deckId').getAll(deck.id));
  oldProgress
    .filter(record => !validQuestionIds.has(record.questionId))
    .forEach(record => progressStore.delete([record.deckId, record.questionId]));
  await transactionDone(transaction);
}

export async function deleteDeck(deckId) {
  const database = await openDatabase();
  const transaction = database.transaction([DECK_STORE, PROGRESS_STORE], 'readwrite');
  transaction.objectStore(DECK_STORE).delete(deckId);
  const progressStore = transaction.objectStore(PROGRESS_STORE);
  const records = await requestResult(progressStore.index('deckId').getAll(deckId));
  records.forEach(record => progressStore.delete([record.deckId, record.questionId]));
  await transactionDone(transaction);
}

export async function getDeckProgress(deckId) {
  const database = await openDatabase();
  const transaction = database.transaction(PROGRESS_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(PROGRESS_STORE).index('deckId').getAll(deckId));
  return new Map(records.map(record => [record.questionId, record]));
}

export async function saveQuestionProgress(record) {
  const database = await openDatabase();
  const transaction = database.transaction(PROGRESS_STORE, 'readwrite');
  transaction.objectStore(PROGRESS_STORE).put(record);
  await transactionDone(transaction);
}
