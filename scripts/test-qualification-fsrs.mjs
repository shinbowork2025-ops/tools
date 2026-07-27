import { createEmptyCard, fsrs, Rating, State } from '../tools/qualification-study/vendor/ts-fsrs.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m']
});
const now = new Date('2026-07-27T00:00:00.000Z');
const card = createEmptyCard(now);
const preview = scheduler.repeat(card, now);

assert(card.state === State.New, '新規カードの状態が不正');
for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
  assert(preview[rating]?.card?.due instanceof Date, `評価${rating}の次回日時がない`);
  assert(preview[rating].card.due > now, `評価${rating}の次回日時が未来でない`);
}

const reviewed = scheduler.next(card, now, Rating.Good).card;
assert(reviewed.reps === 1, '初回評価後の復習回数が1でない');
assert(reviewed.last_review?.getTime() === now.getTime(), '最終復習日時を記録できない');
assert(reviewed.due > now, 'FSRSが次回日時を設定していない');

console.log('OK  FSRS-6で4段階の復習予定を生成');
console.log('OK  評価後のカード状態と次回日時を更新');
