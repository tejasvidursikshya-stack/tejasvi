import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion, validateQuiz, validateSettings, isSimpleQuiz, buildSession, learnerQuestion, gradeAnswer, scoreAttempt, review, quizRules, canStart, deadlineFor, answersVisible, unitLock, validatePolicy, weightedGrade, DEFAULT_POLICY } from '../lib/quiz-engine.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const qs = [
  { id: id(1), type: 'single', prompt: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1 },
  { id: id(2), type: 'multiple', prompt: 'Prime numbers', options: ['2', '4', '5', '9'], correct: [0, 2], points: 2 },
  { id: id(3), type: 'truefalse', prompt: 'Kathmandu is the capital of Nepal.', correct: true },
  { id: id(4), type: 'text', prompt: 'Highest mountain?', answers: ['Everest', 'Sagarmatha'] },
  { id: id(5), type: 'numeric', prompt: 'π to two places', answer: 3.14, tolerance: 0.01 },
  { id: id(6), type: 'match', prompt: 'Match', pairs: [{ left: 'H2O', right: 'Water' }, { left: 'NaCl', right: 'Salt' }, { left: 'CO2', right: 'Carbon dioxide' }] },
  { id: id(7), type: 'order', prompt: 'Order the months', items: ['Baishakh', 'Jestha', 'Ashadh'] },
];

test('validation cleans every question type and explains mistakes', () => {
  const clean = validateQuiz(qs);
  assert.equal(clean.length, 7);
  assert.equal(clean[0].points, 1);
  assert.deepEqual(validateQuestion({ id: id(9), prompt: 'Old', options: ['a', 'b', 'c', 'd'], correct: 2 }).type, 'single'); // saved before types existed
  assert.throws(() => validateQuestion({ id: id(9), type: 'multiple', prompt: 'x', options: ['a', 'b'], correct: [] }), /tick at least one/);
  assert.throws(() => validateQuestion({ id: id(9), type: 'numeric', prompt: 'x', answer: '' }), /correct number/);
  assert.throws(() => validateQuiz([qs[0], qs[0]]), /unique ID/);
});

test('grading: exact answers, accepted spellings, tolerance and partial credit', () => {
  const s = buildSession(qs, validateSettings({}), [], 'seed');
  const by = Object.fromEntries(s.map((x) => [x.q.id, x]));
  assert.equal(gradeAnswer(by[id(1)], 1), 1);
  assert.equal(gradeAnswer(by[id(2)], [2, 0]), 1);
  assert.equal(gradeAnswer(by[id(2)], [0]), 0); // several-answer questions are all or nothing
  assert.equal(gradeAnswer(by[id(3)], true), 1);
  assert.equal(gradeAnswer(by[id(4)], '  sagarmatha '), 1);
  assert.equal(gradeAnswer(by[id(5)], '3.145'), 1);
  assert.equal(gradeAnswer(by[id(5)], '3.2'), 0);
  // Match and order show choices shuffled; translate the correct answer into display order.
  const m = by[id(6)], right = m.q.pairs.map((_p, i) => m.perm.indexOf(i));
  assert.equal(gradeAnswer(m, right), 1);
  assert.equal(Math.round(gradeAnswer(m, [right[0], right[2], right[1]]) * 3), 1);
  const o = by[id(7)], ordered = o.q.items.map((_x, pos) => o.perm.indexOf(pos));
  assert.equal(gradeAnswer(o, ordered), 1);
  assert.notDeepEqual(o.perm, [0, 1, 2]); // never shown already in order
});

test('learners never receive answers; scoring is weighted by points', () => {
  const s = buildSession(qs, validateSettings({ shuffleOptions: true }), [], 'x');
  for (const x of s) { const v = learnerQuestion(x); assert.equal('correct' in v || 'answers' in v || 'answer' in v || 'pairs' in v, false); }
  const single = s.find((x) => x.q.id === id(1)), multi = s.find((x) => x.q.id === id(2));
  const answers = { [id(1)]: single.perm.indexOf(1), [id(2)]: [multi.perm.indexOf(0), multi.perm.indexOf(2)] };
  const r = scoreAttempt(s, answers);
  assert.equal(r.max, 8); assert.equal(r.earned, 3); assert.equal(r.score, 38);
  const rev = review(s, answers, r.results);
  assert.equal(rev.find((x) => x.id === id(4)).correctAnswer, 'Everest / Sagarmatha');
});

test('random draws come from matching bank questions and differ between learners', () => {
  const bank = Array.from({ length: 12 }, (_, i) => ({ tags: i < 10 ? ['fractions'] : ['decimals'], difficulty: 'easy', question: { id: id(100 + i), type: 'truefalse', prompt: 'Q' + i, correct: true } }));
  const settings = validateSettings({ draw: { count: 5, tags: 'Fractions', difficulty: 'easy' }, shuffleQuestions: true });
  const a = buildSession([qs[0]], settings, bank, 'learner-a').map((x) => x.q.id), b = buildSession([qs[0]], settings, bank, 'learner-b').map((x) => x.q.id);
  assert.equal(a.length, 6);
  assert.ok(a.every((x) => x === id(1) || Number(x.slice(-3)) < 110));
  assert.notDeepEqual(a, b);
  assert.throws(() => buildSession([], validateSettings({ draw: { count: 11, tags: 'fractions' } }), bank, 's'), /only 10 matching/);
});

test('exam rules: window, attempts, time limit, extensions and answer release', () => {
  const s = validateSettings({ timeLimit: 30, maxAttempts: 2, opensAt: '2026-11-20T04:00:00Z', closesAt: '2026-11-20T06:00:00Z', showAnswers: 'after_close' });
  const before = quizRules(s, null, Date.parse('2026-11-20T03:00:00Z'));
  assert.match(canStart(before, 0), /opens on/);
  const during = quizRules(s, null, Date.parse('2026-11-20T05:00:00Z'));
  assert.equal(canStart(during, 1), null); assert.match(canStart(during, 2), /all 2 attempts/);
  assert.equal(deadlineFor(during, '2026-11-20T05:00:00Z'), '2026-11-20T05:30:00.000Z');
  assert.equal(deadlineFor(during, '2026-11-20T05:50:00Z'), '2026-11-20T06:00:00.000Z'); // closing time comes first
  const ext = quizRules(s, { extraMinutes: 15, extraAttempts: 1, closesAt: '2026-11-21T06:00:00Z' }, Date.parse('2026-11-20T07:00:00Z'));
  assert.equal(ext.open, true); assert.equal(ext.minutes, 45); assert.equal(canStart(ext, 2), null);
  assert.equal(answersVisible(s, during), false);
  assert.equal(answersVisible(s, quizRules(s, null, Date.parse('2026-11-21T00:00:00Z'))), true);
  assert.equal(isSimpleQuiz([qs[0]], validateSettings({})), true);
  assert.equal(isSimpleQuiz([qs[0]], s), false);
  assert.equal(isSimpleQuiz([qs[2]], validateSettings({})), false);
});

test('units unlock on their release date and after their prerequisite', () => {
  const titles = new Map([['u1', 'Unit 1']]);
  assert.match(unitLock({ releaseAt: '2099-01-01T00:00:00Z' }).reason, /Opens on/);
  assert.match(unitLock({ prerequisiteUnitId: 'u1' }, { titles }).reason, /Finish Unit 1/);
  assert.equal(unitLock({ prerequisiteUnitId: 'u1' }, { done: new Set(['u1']), titles }), null);
  assert.match(unitLock({ prerequisiteUnitId: 'u1', prerequisiteScore: 60 }, { best: new Map([['u1', 55]]), titles }).reason, /60% or more/);
  assert.equal(unitLock({ prerequisiteUnitId: 'u1', prerequisiteScore: 60 }, { best: new Map([['u1', 60]]), titles }), null);
});

test('weighted grade drops the lowest marks and skips categories with no marks', () => {
  const p = validatePolicy({ categories: [{ kind: 'quiz', weight: 20, dropLowest: 1 }, { kind: 'assignment', weight: 30 }, { kind: 'manual', weight: 50 }], passMark: 40 });
  const g = (kind, score, max = 100) => ({ kind, score, max, state: 'graded' });
  const r = weightedGrade([g('quiz', 40), g('quiz', 80), g('quiz', 100), g('assignment', 15, 20)], p);
  assert.equal(r.byCategory[0].percent, 90); // 40 dropped
  assert.equal(r.percent, Math.round(((90 * 20 + 75 * 30) / 50) * 100) / 100);
  assert.equal(r.passed, true); assert.equal(r.complete, false);
  assert.equal(weightedGrade([], DEFAULT_POLICY).percent, null);
  assert.throws(() => validatePolicy({ categories: [{ kind: 'quiz', weight: 50 }, { kind: 'assignment', weight: 30 }, { kind: 'manual', weight: 30 }] }), /add up to 110%/);
});
