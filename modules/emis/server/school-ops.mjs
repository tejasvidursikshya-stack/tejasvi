// School operations: class routine and substitutions, staff attendance, exam routine,
// continuous assessment and report remarks, fee reminders, the books of account,
// the school calendar and parent–teacher messages. Every record write goes through
// store.save(), so permissions, scoping, versioning and the audit log still apply.
import { can, scopeRecord, invoiceBalance } from '../shared/schema.mjs';
import { classStudents } from '../shared/school.mjs';
import { routineClash, substitutionProblem, examClash, CAS_AREAS, CONDUCT, STAFF_STATUS, chartOfAccounts, casInternal } from '../shared/school-ops.mjs';
import { queueSms, sendQueuedSms } from './school-family.mjs';
import { pushToUsers } from './push.mjs';
import { many } from '../../../lib/campus-data.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const needs = (user, entity, op = 'write') => { if (!can(user.role, entity, op)) throw fail('You do not have permission for this.', 403); };
const today = () => new Date().toISOString().slice(0, 10);
const same = (a, b, keys) => keys.every((k) => (a[k] ?? '') === (b[k] ?? ''));
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

/** Extra checks for the operations registers, run inside store.validate(). */
export function validateOps(entity, r, id, all, find, user) {
  const dup = (keys) => all[entity].some((x) => x.id !== id && x.year === r.year && same(x, r, keys));
  const timeOrder = () => { if (r.startTime && r.endTime && r.endTime <= r.startTime) throw fail('The end time must be after the start time.'); };
  if (entity === 'routine') {
    timeOrder();
    if (r.subjectId && find(r.subjectId)?.classId !== r.classId) throw fail('Choose a subject taught in this class.');
    const clash = routineClash({ ...r, id }, all.routine); if (clash) throw fail(clash);
  }
  if (entity === 'substitutions') {
    const problem = substitutionProblem({ ...r, id }, all); if (problem) throw fail(problem);
  }
  if (entity === 'staffAttendance') {
    if (!r.facultyId === !r.staffId) throw fail('Choose either a teacher or a staff member.');
    if (dup(['facultyId', 'staffId', 'date'])) throw fail('Attendance is already recorded for this person on this date.');
    if (r.checkIn && r.checkOut && r.checkOut < r.checkIn) throw fail('Check-out must be after check-in.');
  }
  if (entity === 'examSchedule') {
    timeOrder();
    if (find(r.subjectId)?.classId !== r.classId) throw fail('Choose a subject taught in this class.');
    const clash = examClash({ ...r, id }, all.examSchedule); if (clash) throw fail(clash);
  }
  if (entity === 'cas') {
    if (r.score > r.outOf) throw fail(`The score cannot be more than ${r.outOf}.`);
    if (dup(['studentId', 'subjectId', 'termId', 'area'])) throw fail('This student already has a score for this area.');
    if (find(r.studentId)?.classId !== find(r.subjectId)?.classId) throw fail('The student does not study this subject.');
    if (user.role === 'Faculty' && find(r.termId)?.status === 'Published') throw fail('Results for this examination are already published.');
  }
  if (entity === 'reportRemarks' && dup(['studentId', 'termId'])) throw fail('This student already has a remark for this examination.');
  if (entity === 'advances') {
    if ((Number(r.used) || 0) > r.amount) throw fail('The adjusted amount cannot exceed the advance.');
    if (all.advances.some((x) => x.id !== id && x.receiptNo === r.receiptNo)) throw fail('This receipt number is already used.');
  }
  if (entity === 'ledgerAccounts') {
    if (!/^\d{3,6}$/.test(r.code)) throw fail('Use a 3–6 digit account code.');
    if (chartOfAccounts().some((a) => a.code === r.code) || dup(['code'])) throw fail('This account code is already in use.');
  }
  if (entity === 'journals') {
    const codes = new Set(chartOfAccounts(all.ledgerAccounts.filter((a) => a.year === r.year)).map((a) => a.code));
    if (!codes.has(r.debitAccount) || !codes.has(r.creditAccount)) throw fail('Choose accounts from the chart of accounts.');
    if (r.debitAccount === r.creditAccount) throw fail('The debit and credit accounts must be different.');
    if (dup(['voucherNo'])) throw fail('This voucher number is already used.');
  }
  if (entity === 'events' && r.endDate && r.endDate < r.date) throw fail('The end date is before the start date.');
  if (entity === 'messages') {
    const family = ['Parent', 'Student'].includes(user.role), old = id && find(id);
    if (!id && r.fromSide !== (family ? 'Family' : 'School')) throw fail('Send messages from your own side of the conversation.');
    if (old && (old.body !== r.body || old.fromSide !== r.fromSide || old.studentId !== r.studentId)) throw fail('Messages cannot be changed after they are sent.');
  }
}

/* ------------------------------------------------------------ Staff attendance register */
async function staffAttendance(store, user, b) {
  needs(user, 'staffAttendance');
  if (!validDate(b.date) || b.date > today()) throw fail('Choose a valid date, not in the future.');
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 300) throw fail('Mark 1–300 people.');
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) {
      if (!STAFF_STATUS.includes(row.status)) throw fail('Choose a valid status.');
      const who = row.facultyId ? { facultyId: row.facultyId } : { staffId: row.staffId };
      const existing = all.staffAttendance.find((a) => a.date === b.date && (a.facultyId || a.staffId) === (row.facultyId || row.staffId));
      const next = { year: b.year, date: b.date, ...who, status: row.status, checkIn: row.checkIn || '', checkOut: row.checkOut || '', notes: row.notes || '', version: existing?.version };
      if (existing && same(existing, next, ['status', 'checkIn', 'checkOut', 'notes'])) continue;
      await store.save(user, 'staffAttendance', next, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}

/* ------------------------------------------------------------ Continuous assessment */
async function saveCas(store, user, b) {
  needs(user, 'cas');
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 200) throw fail('Enter scores for 1–200 students.');
  const outOf = Object.fromEntries(CAS_AREAS.map(([a, d]) => [a, Number(b.outOf?.[a]) || d]));
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) for (const [area] of CAS_AREAS) {
      const raw = row.scores?.[area];
      const existing = all.cas.find((x) => x.studentId === row.studentId && x.subjectId === b.subjectId && x.termId === b.termId && x.area === area && x.year === b.year);
      if (raw === '' || raw === undefined || raw === null) { if (existing && user.role !== 'Faculty') { await store.archive(user, 'cas', existing.id, existing.version); saved++; } continue; }
      const score = Number(raw); if (!Number.isFinite(score) || score < 0) throw fail('Scores must be positive numbers.');
      const next = { year: b.year, studentId: row.studentId, subjectId: b.subjectId, termId: b.termId, area, score, outOf: outOf[area], remark: existing?.remark || '', version: existing?.version };
      if (existing && same(existing, next, ['score', 'outOf'])) continue;
      await store.save(user, 'cas', next, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}
/** Fills each student's internal (practical) marks from their CAS scores, as a draft. */
async function fillInternal(store, user, b) {
  needs(user, 'marks');
  const all = await store.all(), subject = all.subjects.find((s) => s.id === b.subjectId);
  if (!subject || !scopeRecord(user, 'subjects', subject, all)) throw fail('Subject not found.', 404);
  if (!(Number(subject.practicalFull) > 0)) throw fail('This subject has no internal (practical) marks to fill.');
  let filled = 0, skipped = 0;
  await store.tx(async () => {
    for (const st of classStudents(all, subject.classId, b.year)) {
      const internal = casInternal(all.cas.filter((x) => x.studentId === st.id && x.subjectId === subject.id && x.termId === b.termId), Number(subject.practicalFull));
      if (internal === undefined) continue;
      const mark = all.marks.find((m) => m.studentId === st.id && m.subjectId === subject.id && m.termId === b.termId && m.year === b.year);
      if (mark?.status === 'Published') { skipped++; continue; }
      if (mark && mark.practical === internal) continue;
      await store.save(user, 'marks', { ...(mark || { year: b.year, studentId: st.id, termId: b.termId, subjectId: subject.id, absent: 'No' }), practical: internal, status: 'Draft', version: mark?.version }, mark?.id || null);
      filled++;
    }
  });
  return { filled, skipped };
}
async function saveRemarks(store, user, b) {
  needs(user, 'reportRemarks');
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 200) throw fail('Write remarks for 1–200 students.');
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) {
      const remark = String(row.remark || '').trim(), existing = all.reportRemarks.find((x) => x.studentId === row.studentId && x.termId === b.termId && x.year === b.year);
      if (row.conduct && !CONDUCT.includes(row.conduct)) throw fail('Choose a valid conduct grade.');
      if (!remark) { if (existing && user.role !== 'Faculty') { await store.archive(user, 'reportRemarks', existing.id, existing.version); saved++; } continue; }
      const next = { year: b.year, studentId: row.studentId, termId: b.termId, remark, conduct: row.conduct || '', version: existing?.version };
      if (existing && same(existing, next, ['remark', 'conduct'])) continue;
      await store.save(user, 'reportRemarks', next, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}

/* ------------------------------------------------------------ Fee reminders */
const phonesOf = (st) => [st.fatherPhone, st.motherPhone, st.guardianPhone];
async function feeReminders(store, user, b, send) {
  needs(user, 'fees');
  const all = await store.all(), profile = await store.meta('profile'), t = today();
  const due = new Map();
  for (const f of all.fees.filter((x) => x.year === b.year && x.dueDate && x.dueDate < t)) {
    const { balance } = invoiceBalance(f, all.payments);
    if (balance > 0) due.set(f.studentId, { amount: (due.get(f.studentId)?.amount || 0) + balance, bills: (due.get(f.studentId)?.bills || 0) + 1, oldest: [due.get(f.studentId)?.oldest, f.dueDate].filter(Boolean).sort()[0] });
  }
  const list = [...due.entries()].map(([id, d]) => { const st = all.students.find((s) => s.id === id); return st && { studentId: id, name: st.name, classId: st.classId, rollNo: st.rollNo, ...d, phones: phonesOf(st).filter(Boolean).length }; }).filter(Boolean).sort((a, b2) => b2.amount - a.amount);
  if (!send) return { students: list, total: list.reduce((s, x) => s + x.amount, 0) };
  let queued = 0;
  for (const x of list) {
    const st = all.students.find((s) => s.id === x.studentId);
    queued += await queueSms(store, 'fee-reminder', `${x.studentId}:${t}`, phonesOf(st), `${profile.name}: NPR ${Math.round(x.amount).toLocaleString('en-IN')} school fee for ${st.name} is overdue. Please pay at the school office${profile.esewa ? ' or online' : ''}. Ignore if already paid.`);
  }
  await store.log(user, 'sent fee reminders', 'fees', null, null, { students: list.length, messages: queued });
  return { queued, ...(await sendQueuedSms(store)) };
}

/* ------------------------------------------------------------ Messages */
async function guardianUsers(store, st) {
  return (await many(store.db.connection(), 'SELECT user_id u FROM emis_guardians WHERE org_id=? AND student_person_id=?', [store.org, st.personId || st.id])).map((x) => x.u);
}
async function teacherUsers(store, all, st) {
  const cls = all.classes.find((c) => c.id === st.classId);
  if (!cls?.classTeacherId) return [];
  return (await many(store.db.connection(), 'SELECT user_id u FROM emis_roles WHERE org_id=? AND faculty_id=?', [store.org, cls.classTeacherId])).map((x) => x.u);
}
async function sendMessage(store, user, b) {
  needs(user, 'messages');
  const body = String(b.body || '').trim();
  if (!body || body.length > 2000) throw fail('Write a message of up to 2,000 characters.');
  const all = await store.all(), st = all.students.find((s) => s.id === b.studentId && s.year === b.year);
  if (!st || !scopeRecord(user, 'students', st, all)) throw fail('Student not found.', 404);
  const family = ['Parent', 'Student'].includes(user.role);
  const saved = await store.tx(() => store.save(user, 'messages', { year: b.year, studentId: st.id, body, fromSide: family ? 'Family' : 'School', author: user.name, readByFamily: family ? 'Yes' : 'No', readBySchool: family ? 'No' : 'Yes' }));
  const profile = await store.meta('profile');
  // Notifications carry no message text: only who it is about, so nothing private leaves the app.
  const users = family ? await teacherUsers(store, all, st) : await guardianUsers(store, st);
  const pushed = await pushToUsers(store, users, family ? `Message from ${st.name}’s family` : `New message from ${profile.name}`, family ? 'Open Tejasvi EMIS to read and reply.' : `About ${st.name}. Open Tejasvi to read it.`, { kind: 'emis-message', studentId: st.id }).catch(() => 0);
  let sms = 0;
  if (!family && profile.smsMessages === 'Yes') {
    sms = await queueSms(store, 'message', saved.id, phonesOf(st), `${profile.name}: you have a new message about ${st.name}. Sign in to Tejasvi to read it.`);
    if (sms) await sendQueuedSms(store).catch(() => null);
  }
  return { id: saved.id, pushed, sms };
}
async function readMessages(store, user, b) {
  needs(user, 'messages');
  const family = ['Parent', 'Student'].includes(user.role), key = family ? 'readByFamily' : 'readBySchool';
  let marked = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const m of all.messages.filter((x) => x.studentId === b.studentId && x[key] !== 'Yes' && (family ? x.fromSide === 'School' : x.fromSide === 'Family'))) {
      if (!scopeRecord(user, 'messages', m, all)) continue;
      await store.save(user, 'messages', { ...m, [key]: 'Yes' }, m.id); marked++;
    }
  });
  return { marked };
}

export async function opsRoute(store, user, path, b) {
  const map = {
    '/api/school/staff-attendance': () => staffAttendance(store, user, b),
    '/api/school/cas': () => saveCas(store, user, b),
    '/api/school/cas/fill': () => fillInternal(store, user, b),
    '/api/school/remarks': () => saveRemarks(store, user, b),
    '/api/school/fees/reminders/preview': () => feeReminders(store, user, b, false),
    '/api/school/fees/reminders/send': () => feeReminders(store, user, b, true),
    '/api/school/messages/send': () => sendMessage(store, user, b),
    '/api/school/messages/read': () => readMessages(store, user, b),
  };
  return map[path] ? map[path]() : undefined;
}
