// Quiz engine shared by the API, the web app and tests. Pure functions, no I/O.
// Question types, randomised sessions drawn from a question bank, grading with partial
// credit, exam rules (windows, attempts, time limits, extensions), unit release and
// prerequisites, and a weighted grading policy.

export const QUESTION_TYPES = {
  single: 'Multiple choice (one answer)',
  multiple: 'Multiple choice (several answers)',
  truefalse: 'True or false',
  text: 'Fill in the blank',
  numeric: 'Number answer',
  match: 'Match the pairs',
  order: 'Put in order',
};
export const DIFFICULTY = ['easy', 'medium', 'hard'];
export const SHOW_ANSWERS = { immediately: 'Right after each attempt', after_close: 'After the quiz closes', never: 'Never' };

const fail = (message) => Object.assign(new Error(message), { status: 400 });
const str = (v, label, max, min = 1) => { const s = typeof v === 'string' ? v.trim() : ''; if (s.length < min || s.length > max) throw fail(`${label} must be ${min ? `1–${max}` : `up to ${max}`} characters.`); return s; };
const list = (v, label, min, max, each) => { if (!Array.isArray(v) || v.length < min || v.length > max) throw fail(`${label}: give ${min}–${max} entries.`); return v.map((x, i) => each(x, i)); };
const uuidLike = /^[0-9a-f-]{8,64}$/i;

/** Questions saved before question types existed are single-answer multiple choice. */
export function normalizeQuestion(q) {
  if (!q || typeof q !== 'object') return q;
  return q.type ? q : { ...q, type: 'single' };
}

/** Cleans a question from an editor, or throws a message the teacher can act on. */
export function validateQuestion(raw, n = 1) {
  const q = normalizeQuestion(raw), at = `Question ${n}`;
  if (!q || !QUESTION_TYPES[q.type]) throw fail(`${at}: choose a question type.`);
  if (typeof q.id !== 'string' || !uuidLike.test(q.id)) throw fail(`${at}: missing question ID.`);
  const out = { id: q.id, type: q.type, prompt: str(q.prompt, `${at} text`, 2000) };
  const points = q.points === undefined || q.points === '' ? 1 : Number(q.points);
  if (!Number.isFinite(points) || points < 0.5 || points > 20) throw fail(`${at}: points must be 0.5–20.`);
  out.points = points;
  if (q.hint) out.hint = str(q.hint, `${at} hint`, 1000, 0);
  if (q.explanation) out.explanation = str(q.explanation, `${at} explanation`, 2000, 0);
  const option = (x, i) => str(x, `${at} option ${i + 1}`, 1000);
  if (q.type === 'single' || q.type === 'multiple') {
    out.options = list(q.options, `${at} options`, 2, 8, option);
    if (q.type === 'single') {
      const c = Number(q.correct);
      if (!Number.isInteger(c) || c < 0 || c >= out.options.length) throw fail(`${at}: choose the correct option.`);
      out.correct = c;
    } else {
      const c = [...new Set((Array.isArray(q.correct) ? q.correct : []).map(Number))].sort((a, b) => a - b);
      if (!c.length || c.some((x) => !Number.isInteger(x) || x < 0 || x >= out.options.length)) throw fail(`${at}: tick at least one correct option.`);
      out.correct = c;
    }
  } else if (q.type === 'truefalse') {
    if (typeof q.correct !== 'boolean') throw fail(`${at}: choose True or False as the answer.`);
    out.correct = q.correct;
  } else if (q.type === 'text') {
    out.answers = list(q.answers, `${at} accepted answers`, 1, 10, (x, i) => str(x, `${at} answer ${i + 1}`, 300));
    out.caseSensitive = q.caseSensitive === true;
  } else if (q.type === 'numeric') {
    const a = Number(q.answer), t = q.tolerance === undefined || q.tolerance === '' ? 0 : Number(q.tolerance);
    if (q.answer === '' || q.answer === null || !Number.isFinite(a)) throw fail(`${at}: enter the correct number.`);
    if (!Number.isFinite(t) || t < 0) throw fail(`${at}: tolerance must be zero or more.`);
    out.answer = a; out.tolerance = t;
  } else if (q.type === 'match') {
    out.pairs = list(q.pairs, `${at} pairs`, 2, 8, (p, i) => ({ left: str(p?.left, `${at} pair ${i + 1} left side`, 300), right: str(p?.right, `${at} pair ${i + 1} right side`, 300) }));
  } else if (q.type === 'order') {
    out.items = list(q.items, `${at} items`, 2, 8, (x, i) => str(x, `${at} item ${i + 1}`, 300));
  }
  return out;
}
export function validateQuiz(questions) {
  if (!Array.isArray(questions) || questions.length > 50) throw fail('A quiz can have up to 50 questions.');
  const out = questions.map((q, i) => validateQuestion(q, i + 1));
  if (new Set(out.map((q) => q.id)).size !== out.length) throw fail('Each question must have a unique ID.');
  return out;
}

/* ------------------------------------------------------------ Settings */
export const DEFAULT_SETTINGS = { timeLimit: 0, maxAttempts: 0, opensAt: null, closesAt: null, showAnswers: 'immediately', shuffleQuestions: false, shuffleOptions: false, draw: null, passMark: 0 };
const isoOrNull = (v, label) => { if (v === null || v === undefined || v === '') return null; const t = Date.parse(v); if (!Number.isFinite(t)) throw fail(`${label} is not a valid date and time.`); return new Date(t).toISOString(); };
export function validateSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS };
  const int = (v, label, min, max) => { const n = v === '' || v === null || v === undefined ? 0 : Number(v); if (!Number.isInteger(n) || n < min || n > max) throw fail(`${label} must be a whole number from ${min} to ${max}.`); return n; };
  s.timeLimit = int(raw.timeLimit, 'Time limit (minutes)', 0, 600);
  s.maxAttempts = int(raw.maxAttempts, 'Attempts allowed', 0, 50);
  s.passMark = int(raw.passMark, 'Pass mark (%)', 0, 100);
  s.opensAt = isoOrNull(raw.opensAt, 'Opens at');
  s.closesAt = isoOrNull(raw.closesAt, 'Closes at');
  if (s.opensAt && s.closesAt && s.closesAt <= s.opensAt) throw fail('The quiz must close after it opens.');
  s.showAnswers = SHOW_ANSWERS[raw.showAnswers] ? raw.showAnswers : 'immediately';
  s.shuffleQuestions = raw.shuffleQuestions === true;
  s.shuffleOptions = raw.shuffleOptions === true;
  if (raw.draw && Number(raw.draw.count) > 0) {
    const tags = (Array.isArray(raw.draw.tags) ? raw.draw.tags : String(raw.draw.tags || '').split(',')).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10);
    s.draw = { count: int(raw.draw.count, 'Questions drawn from the bank', 1, 50), tags, difficulty: DIFFICULTY.includes(raw.draw.difficulty) ? raw.draw.difficulty : '' };
  }
  return s;
}
/** Quizzes the mobile app can answer as before: four-option single-answer questions and no exam rules. */
export function isSimpleQuiz(questions, settings) {
  const s = settings || DEFAULT_SETTINGS;
  return questions.every((q) => { const n = normalizeQuestion(q); return n.type === 'single' && n.options?.length === 4 && Number(n.points || 1) === 1; })
    && !s.timeLimit && !s.maxAttempts && !s.opensAt && !s.closesAt && !s.draw && !s.shuffleQuestions && !s.shuffleOptions && s.showAnswers === 'immediately';
}

/* ------------------------------------------------------------ Randomised sessions */
function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const shuffled = (n, rnd) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const identity = (n) => [...Array(n).keys()];
/** Bank questions that fit a draw rule (all listed tags present, same difficulty when set). */
export function bankMatches(bank, draw) {
  return bank.filter((b) => (!draw.difficulty || b.difficulty === draw.difficulty) && draw.tags.every((t) => (b.tags || []).includes(t)));
}
/**
 * The questions one learner gets for one attempt: the unit's own questions plus a random draw
 * from the bank, in a shuffled order when asked. Each entry keeps the full question (with the
 * answer) and the display order of its choices, so grading never trusts the browser.
 */
export function buildSession(questions, settings, bank, seed) {
  const rnd = seededRandom(seed), s = settings || DEFAULT_SETTINGS;
  let pool = questions.map(normalizeQuestion);
  if (s.draw) {
    const taken = new Set(pool.map((q) => q.id)), candidates = bankMatches(bank || [], s.draw).filter((b) => !taken.has(b.question.id));
    if (candidates.length < s.draw.count) throw fail(`The question bank has only ${candidates.length} matching question${candidates.length === 1 ? '' : 's'}; this quiz draws ${s.draw.count}. Ask your teacher to add more.`);
    pool = [...pool, ...shuffled(candidates.length, rnd).slice(0, s.draw.count).map((i) => normalizeQuestion(candidates[i].question))];
  }
  if (!pool.length) throw fail('This quiz has no questions yet.');
  const order = s.shuffleQuestions ? shuffled(pool.length, rnd) : identity(pool.length);
  return order.map((i) => {
    const q = pool[i], served = { q };
    if (q.type === 'single' || q.type === 'multiple') served.perm = s.shuffleOptions ? shuffled(q.options.length, rnd) : identity(q.options.length);
    if (q.type === 'match') served.perm = shuffled(q.pairs.length, rnd);
    if (q.type === 'order') { let p = shuffled(q.items.length, rnd); if (p.every((x, k) => x === k)) p = [...p.slice(1), p[0]]; served.perm = p; }
    return served;
  });
}
/** What the learner's browser receives: no answers, choices in display order. */
export function learnerQuestion({ q, perm }) {
  const base = { id: q.id, type: q.type, prompt: q.prompt, points: q.points || 1, ...(q.hint ? { hint: q.hint } : {}) };
  if (q.type === 'single' || q.type === 'multiple') return { ...base, options: perm.map((i) => q.options[i]) };
  if (q.type === 'truefalse') return { ...base, options: ['True', 'False'] };
  if (q.type === 'match') return { ...base, lefts: q.pairs.map((p) => p.left), rights: perm.map((i) => q.pairs[i].right) };
  if (q.type === 'order') return { ...base, items: perm.map((i) => q.items[i]) };
  return base;
}
const clean = (s, caseSensitive) => { const t = String(s ?? '').trim().replace(/\s+/g, ' '); return caseSensitive ? t : t.toLowerCase(); };
/** Fraction of the question's points earned (0–1). Choices arrive in display order. */
export function gradeAnswer({ q, perm }, answer) {
  if (answer === undefined || answer === null || answer === '') return 0;
  switch (q.type) {
    case 'single': return Number.isInteger(answer) && perm[answer] === q.correct ? 1 : 0;
    case 'multiple': { if (!Array.isArray(answer)) return 0; const got = [...new Set(answer.filter(Number.isInteger).map((i) => perm[i]))].sort((a, b) => a - b); return got.length === q.correct.length && got.every((x, i) => x === q.correct[i]) ? 1 : 0; }
    case 'truefalse': return answer === q.correct ? 1 : 0;
    case 'text': return q.answers.some((a) => clean(a, q.caseSensitive) === clean(answer, q.caseSensitive)) ? 1 : 0;
    case 'numeric': { const n = Number(String(answer).replace(/,/g, '')); return Number.isFinite(n) && Math.abs(n - q.answer) <= q.tolerance + 1e-9 ? 1 : 0; }
    case 'match': { if (!Array.isArray(answer)) return 0; return q.pairs.reduce((s, _p, i) => s + (Number.isInteger(answer[i]) && perm[answer[i]] === i ? 1 : 0), 0) / q.pairs.length; }
    case 'order': { if (!Array.isArray(answer) || answer.length !== q.items.length) return 0; return answer.reduce((s, d, pos) => s + (perm[d] === pos ? 1 : 0), 0) / q.items.length; }
    default: return 0;
  }
}
export function correctText(q) {
  switch (q.type) {
    case 'single': return q.options[q.correct];
    case 'multiple': return q.correct.map((i) => q.options[i]).join(' · ');
    case 'truefalse': return q.correct ? 'True' : 'False';
    case 'text': return q.answers.join(' / ');
    case 'numeric': return q.tolerance ? `${q.answer} (± ${q.tolerance})` : String(q.answer);
    case 'match': return q.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
    case 'order': return q.items.join(' → ');
    default: return '';
  }
}
/** Score for a whole attempt, weighted by points, as a whole-number percentage. */
export function scoreAttempt(served, answers = {}) {
  let earned = 0, max = 0;
  const results = served.map((s) => { const pts = s.q.points || 1, f = gradeAnswer(s, answers[s.q.id]); earned += f * pts; max += pts; return { id: s.q.id, fraction: Math.round(f * 1000) / 1000 }; });
  return { score: max ? Math.round((earned / max) * 100) : 0, earned: Math.round(earned * 100) / 100, max, results };
}
export function review(served, answers, results) {
  return served.map((s, i) => ({ ...learnerQuestion(s), answer: answers?.[s.q.id] ?? null, fraction: results[i].fraction, correctAnswer: correctText(s.q), ...(s.q.explanation ? { explanation: s.q.explanation } : {}) }));
}

/* ------------------------------------------------------------ Exam rules */
const t = (v) => (v ? Date.parse(v) : null);
/** Window, attempts and time for one learner, after any extension the teacher granted. */
export function quizRules(settings, extension, now = Date.now()) {
  const s = settings || DEFAULT_SETTINGS, e = extension || {};
  const closes = [t(s.closesAt), t(e.closesAt)].filter(Boolean).sort((a, b) => b - a)[0] || null;
  const maxAttempts = s.maxAttempts ? s.maxAttempts + (Number(e.extraAttempts) || 0) : 0;
  const minutes = s.timeLimit ? s.timeLimit + (Number(e.extraMinutes) || 0) : 0;
  const notYet = t(s.opensAt) && now < t(s.opensAt), closed = closes && now > closes;
  return { opensAt: s.opensAt, closesAt: closes ? new Date(closes).toISOString() : null, maxAttempts, minutes, open: !notYet && !closed, notYet: !!notYet, closed: !!closed };
}
export function canStart(rules, used) {
  if (rules.notYet) return `This quiz opens on ${new Date(rules.opensAt).toUTCString().slice(0, 22)} UTC.`;
  if (rules.closed) return 'This quiz is closed.';
  if (rules.maxAttempts && used >= rules.maxAttempts) return `You have used all ${rules.maxAttempts} attempt${rules.maxAttempts === 1 ? '' : 's'}.`;
  return null;
}
/** When an attempt must be handed in: the time limit or the closing time, whichever is first. */
export function deadlineFor(rules, startedAt) {
  const start = t(startedAt), ends = [rules.minutes ? start + rules.minutes * 60000 : null, t(rules.closesAt)].filter(Boolean);
  return ends.length ? new Date(Math.min(...ends)).toISOString() : null;
}
export const GRACE_MS = 60000;
export function answersVisible(settings, rules) {
  const s = (settings || DEFAULT_SETTINGS).showAnswers;
  return s === 'immediately' || (s === 'after_close' && rules.closed);
}

/* ------------------------------------------------------------ Release dates and prerequisites */
/** Why a unit is not open to a learner yet, or null. */
export function unitLock(unit, { now = Date.now(), done = new Set(), best = new Map(), titles = new Map() } = {}) {
  if (unit.releaseAt && t(unit.releaseAt) > now) return { kind: 'date', reason: `Opens on ${new Date(unit.releaseAt).toUTCString().slice(0, 16)}` };
  if (unit.prerequisiteUnitId) {
    const name = titles.get(unit.prerequisiteUnitId) || 'the previous unit';
    if (unit.prerequisiteScore) { if ((best.get(unit.prerequisiteUnitId) ?? -1) < unit.prerequisiteScore) return { kind: 'prerequisite', reason: `Score ${unit.prerequisiteScore}% or more on the ${name} quiz to unlock` }; }
    else if (!done.has(unit.prerequisiteUnitId)) return { kind: 'prerequisite', reason: `Finish ${name} to unlock` };
  }
  return null;
}

/* ------------------------------------------------------------ Grading policy */
export const DEFAULT_POLICY = { categories: [{ kind: 'quiz', label: 'Quizzes', weight: 20, dropLowest: 0 }, { kind: 'assignment', label: 'Assignments & projects', weight: 40, dropLowest: 0 }, { kind: 'manual', label: 'Exams & other marks', weight: 40, dropLowest: 0 }], passMark: 40 };
export function validatePolicy(raw) {
  const cats = DEFAULT_POLICY.categories.map((d) => { const c = (raw?.categories || []).find((x) => x?.kind === d.kind) || d; const w = Number(c.weight), drop = Number(c.dropLowest || 0); if (!Number.isFinite(w) || w < 0 || w > 100) throw fail(`${d.label}: weight must be 0–100%.`); if (!Number.isInteger(drop) || drop < 0 || drop > 5) throw fail(`${d.label}: drop 0–5 lowest scores.`); return { kind: d.kind, label: String(c.label || d.label).trim().slice(0, 60) || d.label, weight: w, dropLowest: drop }; });
  const total = cats.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 0.001) throw fail(`The weights add up to ${total}%. They must add up to 100%.`);
  const pass = Number(raw?.passMark ?? 40); if (!Number.isFinite(pass) || pass < 0 || pass > 100) throw fail('The pass mark must be 0–100%.');
  return { categories: cats, passMark: pass };
}
/**
 * Weighted course grade from released marks. Each category is the average of its item
 * percentages after dropping the lowest ones; categories with no marks yet are left out and
 * the remaining weights are scaled up, so missing work is never counted as zero.
 */
export function weightedGrade(items, policy = DEFAULT_POLICY) {
  const byCategory = policy.categories.map((c) => {
    const pct = items.filter((i) => i.kind === c.kind && i.state === 'graded' && i.score !== null && i.max > 0).map((i) => (i.score / i.max) * 100).sort((a, b) => a - b);
    const drop = Math.min(c.dropLowest, Math.max(0, pct.length - 1)), kept = pct.slice(drop);
    return { ...c, counted: kept.length, dropped: drop, percent: kept.length ? Math.round((kept.reduce((s, x) => s + x, 0) / kept.length) * 100) / 100 : null };
  });
  const used = byCategory.filter((c) => c.percent !== null && c.weight > 0), weight = used.reduce((s, c) => s + c.weight, 0);
  const percent = weight ? Math.round((used.reduce((s, c) => s + c.percent * c.weight, 0) / weight) * 100) / 100 : null;
  return { percent, byCategory, passed: percent === null ? null : percent >= policy.passMark, complete: used.length === policy.categories.filter((c) => c.weight > 0).length };
}
