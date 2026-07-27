const REQUIRED_HEADERS = Object.freeze(['Front', 'Back']);
const MAX_QUESTIONS = 5000;

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function parseRows(source) {
  const text = String(source || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) throw new Error('CSVの引用符が閉じられていません。');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(values => values.some(value => value.trim() !== ''));
}

function normalizeHeader(value) {
  return value.trim().toLowerCase();
}

function stripHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function findAnswerKey(back) {
  return stripHtml(back).match(/(?:正答|正解)\s*[：:]\s*([A-E])/i)?.[1]?.toUpperCase() || null;
}

function findChoiceLabels(front) {
  const plain = stripHtml(front);
  const found = [...plain.matchAll(/(?:^|\n)\s*([A-E])[\s]*[.．、:：)]/g)]
    .map(match => match[1].toUpperCase());
  return [...new Set(found)];
}

function inferTitle(tags, filename = '') {
  const tokenRows = tags
    .map(value => value.trim().split(/\s+/).filter(Boolean))
    .filter(tokens => tokens.length);

  if (tokenRows.length) {
    const common = [];
    const shortest = Math.min(...tokenRows.map(tokens => tokens.length));
    for (let index = 0; index < shortest; index += 1) {
      const value = tokenRows[0][index];
      if (!tokenRows.every(tokens => tokens[index] === value)) break;
      common.push(value);
    }
    if (common.length) return common.join(' ');
  }

  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || '社内資格';
}

export function createDeckId(title) {
  return `qualification-${stableHash(title.trim().toLowerCase())}`;
}

export function parseAnkiCsv(source, filename = '') {
  const rows = parseRows(source);
  if (rows.length < 2) throw new Error('問題行がありません。');

  const headers = rows[0].map(normalizeHeader);
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const missing = REQUIRED_HEADERS.filter(header => indexes[header.toLowerCase()] === undefined);
  if (missing.length) {
    throw new Error(`Anki CSVの見出しが不足しています：${missing.join(', ')}`);
  }

  const questions = [];
  const seen = new Set();
  let duplicates = 0;

  for (const values of rows.slice(1)) {
    const front = String(values[indexes.front] || '').trim();
    const back = String(values[indexes.back] || '').trim();
    const tags = indexes.tags === undefined ? '' : String(values[indexes.tags] || '').trim();
    if (!front && !back) continue;
    if (!front || !back) throw new Error(`${questions.length + 2}行目のFrontまたはBackが空です。`);

    const id = `question-${stableHash(`${front}\u241f${back}`)}`;
    if (seen.has(id)) {
      duplicates += 1;
      continue;
    }
    seen.add(id);

    const choiceLabels = findChoiceLabels(front);
    questions.push({
      id,
      front,
      back,
      tags,
      answerKey: findAnswerKey(back),
      choiceLabels: choiceLabels.length >= 2 ? choiceLabels : []
    });
    if (questions.length > MAX_QUESTIONS) {
      throw new Error(`1つの資格に登録できる問題は${MAX_QUESTIONS}問までです。`);
    }
  }

  if (!questions.length) throw new Error('登録できる問題がありません。');
  const title = inferTitle(questions.map(question => question.tags), filename);
  return {
    title,
    questions,
    duplicates,
    multipleChoiceCount: questions.filter(question => question.answerKey && question.choiceLabels.length).length
  };
}

export const QualificationCsv = Object.freeze({
  createDeckId,
  parseAnkiCsv
});
