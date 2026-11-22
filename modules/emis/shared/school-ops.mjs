// School operations rules shared by the server, the web app and tests: class routine and
// substitutions, staff attendance and unpaid days, exam seat plans, continuous assessment,
// fee discounts and late fines, and the double-entry books. Pure functions, no I/O.
import { classOrder, smsPhone, round2 } from './school.mjs';
import { bsMonthRange, bsYearOf, BS_MONTHS } from './bs.mjs';

/* ------------------------------------------------------------ Class routine */
// Nepal's weekly holidays are Saturday and Sunday; school runs Monday to Friday.
export const WEEKLY_HOLIDAYS = ['Saturday', 'Sunday'];
export const SCHOOL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekday = (iso) => WEEK[new Date(iso + 'T00:00:00Z').getUTCDay()];
export const isWeeklyHoliday = (iso) => WEEKLY_HOLIDAYS.includes(weekday(iso));
const overlaps = (a, b) => a.startTime < b.endTime && b.startTime < a.endTime;

/** Why a routine period cannot be saved (a class or teacher booked twice), or null. */
export function routineClash(entry, routine) {
  for (const o of routine) {
    if (o.id === entry.id || o.year !== entry.year || o.day !== entry.day) continue;
    if (o.classId === entry.classId && (Number(o.period) === Number(entry.period) || overlaps(o, entry))) return `This class already has period ${o.period} (${o.startTime}–${o.endTime}) on ${o.day}.`;
    if (entry.facultyId && o.facultyId === entry.facultyId && overlaps(o, entry)) return `This teacher already teaches another class at ${o.startTime}–${o.endTime} on ${o.day}.`;
  }
  return null;
}
/** Teachers away on a date: marked absent or on leave, or with approved leave covering the date. */
export function teachersAway(records, date) {
  const ids = new Set();
  for (const a of records.staffAttendance || []) if (a.date === date && a.facultyId && ['Absent', 'On leave'].includes(a.status)) ids.add(a.facultyId);
  for (const l of records.leaves || []) if (l.facultyId && l.status === 'Approved' && l.fromDate <= date && l.toDate >= date) ids.add(l.facultyId);
  return ids;
}
/** Periods on a date whose teacher is away, each with its substitution if one is arranged. */
export function periodsToCover(records, date, year) {
  const day = weekday(date), away = teachersAway(records, date), subs = (records.substitutions || []).filter((s) => s.date === date && s.status !== 'Cancelled');
  return (records.routine || []).filter((r) => r.year === year && r.day === day && away.has(r.facultyId))
    .map((r) => ({ ...r, substitution: subs.find((s) => s.routineId === r.id) || null }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || String(a.classId).localeCompare(String(b.classId)));
}
/** Teachers free for a period on a date (not away, not teaching, not already substituting), least busy first. */
export function freeTeachers(records, period, date, year) {
  const day = weekday(date), away = teachersAway(records, date);
  const today = (records.routine || []).filter((r) => r.year === year && r.day === day);
  const routineById = Object.fromEntries((records.routine || []).map((r) => [r.id, r]));
  const busy = new Set(today.filter((r) => overlaps(r, period)).map((r) => r.facultyId));
  for (const s of records.substitutions || []) if (s.date === date && s.status !== 'Cancelled' && routineById[s.routineId] && overlaps(routineById[s.routineId], period)) busy.add(s.substituteId);
  const load = (id) => today.filter((r) => r.facultyId === id).length;
  return (records.faculty || []).filter((f) => f.status === 'Active' && !away.has(f.id) && !busy.has(f.id)).sort((a, b) => load(a.id) - load(b.id) || a.name.localeCompare(b.name));
}
export function substitutionProblem(sub, records) {
  const period = (records.routine || []).find((r) => r.id === sub.routineId);
  if (!period) return 'Choose a period from the class routine.';
  if (weekday(sub.date) !== period.day) return `That period is on ${period.day}, not ${weekday(sub.date)}.`;
  if (sub.substituteId === period.facultyId) return 'The substitute must be a different teacher.';
  const others = { ...records, substitutions: (records.substitutions || []).filter((s) => s.id !== sub.id) };
  if (!freeTeachers(others, period, sub.date, sub.year).some((f) => f.id === sub.substituteId)) return 'This teacher is away or already teaching at that time.';
  return null;
}

/* ------------------------------------------------------------ Staff attendance and payroll */
export const STAFF_STATUS = ['Present', 'Absent', 'Late', 'Half day', 'On leave'];
const personOf = (r) => r.facultyId || r.staffId;
const datesBetween = (from, to) => { const out = []; for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
/**
 * Unpaid days for one person in a date range: approved unpaid leave, plus days marked absent
 * (or half days) that no approved leave covers. Paid leave is never deducted.
 */
export function unpaidDays(records, personId, from, to) {
  const leaves = (records.leaves || []).filter((l) => personOf(l) === personId && l.status === 'Approved');
  const covered = (date) => leaves.find((l) => l.fromDate <= date && l.toDate >= date);
  const days = new Map();
  for (const l of leaves) if (l.type === 'Unpaid') for (const d of datesBetween(l.fromDate > from ? l.fromDate : from, l.toDate < to ? l.toDate : to)) days.set(d, 1);
  for (const a of records.staffAttendance || []) {
    if (personOf(a) !== personId || a.date < from || a.date > to || covered(a.date)) continue;
    if (a.status === 'Absent') days.set(a.date, 1); else if (a.status === 'Half day') days.set(a.date, Math.max(days.get(a.date) || 0, 0.5));
  }
  return [...days.values()].reduce((s, n) => s + n, 0);
}
/** The AD date range of a BS month in an academic year ('2026/27', 'Kartik'). */
export function payMonthRange(year, month) {
  const r = bsMonthRange(bsYearOf(year), BS_MONTHS.indexOf(month) + 1);
  return { ...r, days: (Date.parse(r.to) - Date.parse(r.from)) / 864e5 + 1 };
}
export const absenceDeduction = (basic, unpaid, monthDays) => (unpaid > 0 && monthDays > 0 ? Math.round((basic / monthDays) * unpaid) : 0);
export function staffAttendanceSummary(records, personId, from, to) {
  const rows = (records.staffAttendance || []).filter((a) => personOf(a) === personId && a.date >= from && a.date <= to);
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { days: rows.length, present: count('Present') + count('Late'), late: count('Late'), absent: count('Absent'), half: count('Half day'), leave: count('On leave') };
}

/* ------------------------------------------------------------ Exam seat plan */
/**
 * Seats students of several classes in exam rooms. Classes are taken in turn, so students
 * sitting side by side come from different classes. rooms: [{ name, rows, cols }].
 */
export function seatPlan(groups, rooms) {
  const queues = groups.map((g) => g.students.map((s) => ({ ...s, classLabel: g.label })));
  const order = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) order.push(q.shift());
  let i = 0;
  const plan = rooms.map((r) => {
    const seats = [];
    for (let row = 1; row <= r.rows; row++) for (let col = 1; col <= r.cols; col++) seats.push({ row, col, student: i < order.length ? order[i++] : null });
    return { ...r, seats, used: seats.filter((s) => s.student).length };
  });
  return { plan, unseated: order.slice(i), capacity: rooms.reduce((s, r) => s + r.rows * r.cols, 0), students: order.length };
}
/** Exam timetable clash: a class with two papers at overlapping times on the same day. */
export function examClash(entry, schedule) {
  const o = schedule.find((x) => x.id !== entry.id && x.year === entry.year && x.termId === entry.termId && x.classId === entry.classId && (x.subjectId === entry.subjectId || (x.date === entry.date && overlaps(x, entry))));
  if (!o) return null;
  return o.subjectId === entry.subjectId ? 'This subject is already in the exam routine for this class.' : `This class already has a paper at ${o.startTime}–${o.endTime} on ${o.date}.`;
}

/* ------------------------------------------------------------ Continuous assessment (CAS) */
// Areas and default full marks follow the basic-level internal assessment used by schools
// under the CDC curriculum; teachers can change the full marks for each area.
export const CAS_AREAS = [['Participation', 5], ['Project & practical work', 10], ['Classwork & homework', 5], ['Unit tests', 5], ['Creativity & conduct', 5]];
export const CONDUCT = ['Excellent', 'Very good', 'Good', 'Satisfactory', 'Needs improvement'];
/** Internal (practical) marks from a student's CAS records, scaled to the subject's internal full marks. */
export function casInternal(rows, practicalFull) {
  const outOf = rows.reduce((s, r) => s + (Number(r.outOf) || 0), 0), score = rows.reduce((s, r) => s + (Number(r.score) || 0), 0);
  if (!outOf || !practicalFull) return undefined;
  return Math.min(practicalFull, Math.round((score / outOf) * practicalFull * 2) / 2);
}

/* ------------------------------------------------------------ Fees */
/** Order of brothers and sisters in school (by a shared parent phone): 0 = eldest, who pays full fees. */
export function siblingRanks(students, classes) {
  const active = students.filter((s) => s.status === 'Active'), parent = new Map(active.map((s) => [s.id, s.id]));
  const root = (x) => (parent.get(x) === x ? x : root(parent.get(x)));
  const byPhone = new Map();
  for (const s of active) for (const p of [s.fatherPhone, s.motherPhone, s.guardianPhone].map(smsPhone).filter(Boolean)) {
    if (byPhone.has(p)) parent.set(root(s.id), root(byPhone.get(p))); else byPhone.set(p, s.id);
  }
  const families = new Map();
  for (const s of active) { const k = root(s.id); families.set(k, [...(families.get(k) || []), s]); }
  const cls = Object.fromEntries((classes || []).map((c) => [c.id, c]));
  const ranks = new Map();
  for (const kids of families.values()) {
    kids.sort((a, b) => classOrder(cls[b.classId]) - classOrder(cls[a.classId]) || String(a.dob || '9').localeCompare(String(b.dob || '9')) || a.name.localeCompare(b.name));
    kids.forEach((k, i) => ranks.set(k.id, { rank: i, size: kids.length }));
  }
  return ranks;
}
/** Invoices still owed after the grace period that have not had a late fine yet. */
export function overdueForFine(invoices, payments, asOf, graceDays = 0) {
  const limit = new Date(Date.parse(asOf + 'T00:00:00Z') - graceDays * 864e5).toISOString().slice(0, 10);
  return invoices.filter((f) => f.dueDate && f.dueDate < limit && f.lateFined !== 'Yes' && f.category !== 'Late fine')
    .filter((f) => payments.filter((p) => p.invoiceId === f.id).reduce((s, p) => s + Number(p.amount), 0) < Number(f.amount));
}
export function advanceBalance(advances, studentId) {
  return round2((advances || []).filter((a) => a.studentId === studentId && a.status !== 'Used').reduce((s, a) => s + Number(a.amount) - (Number(a.used) || 0), 0));
}

/* ------------------------------------------------------------ Books of account */
export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
export const SYSTEM_ACCOUNTS = [
  ['1000', 'Cash in hand', 'Asset'], ['1010', 'Bank', 'Asset'], ['1020', 'Digital wallets (eSewa, Khalti, Fonepay)', 'Asset'], ['1100', 'Fees receivable', 'Asset'],
  ['2000', 'Advance fees from students', 'Liability'], ['2100', 'SSF payable', 'Liability'], ['2110', 'CIT payable', 'Liability'], ['2120', 'Income tax (TDS) payable', 'Liability'], ['2130', 'Other salary deductions payable', 'Liability'],
  ['3000', 'Capital fund', 'Equity'],
  ['4000', 'Tuition and monthly fees', 'Income'], ['4010', 'Admission fees', 'Income'], ['4020', 'Examination fees', 'Income'], ['4030', 'Transport fees', 'Income'], ['4040', 'Other fees and fines', 'Income'], ['4100', 'Grants and donations', 'Income'], ['4900', 'Other income', 'Income'],
  ['5000', 'Salaries and wages', 'Expense'], ['5010', 'Employer SSF contribution', 'Expense'], ['5100', 'Academic and student activities', 'Expense'], ['5200', 'Infrastructure and maintenance', 'Expense'], ['5300', 'Administration', 'Expense'], ['5900', 'Other expenses', 'Expense'],
].map(([code, name, type]) => ({ code, name, type, system: true }));
export function chartOfAccounts(custom = []) {
  return [...SYSTEM_ACCOUNTS, ...custom.map((a) => ({ code: a.code, name: a.name, type: a.type, opening: Number(a.openingBalance) || 0, id: a.id }))].sort((a, b) => a.code.localeCompare(b.code));
}
const FEE_INCOME = { Admission: '4010', Examination: '4020', Transport: '4030', 'Late fine': '4040', Library: '4040', Other: '4040' };
const MONEY = { Cash: '1000', 'Bank transfer': '1010', Cheque: '1010', Online: '1020', eSewa: '1020', Khalti: '1020', Fonepay: '1020', Advance: '2000' };
const EXPENSE = { Salary: '5000', 'Academic activities': '5100', Library: '5100', ICT: '5100', 'Student welfare': '5100', Scholarships: '5100', Research: '5100', Infrastructure: '5200', Administration: '5300' };
/** Every posting for the year, derived from fees, payments, advances, income/expenditure, paid payslips and journal vouchers. */
export function ledgerEntries(records, year) {
  const of = (k) => (records[k] || []).filter((r) => r.year === year);
  const out = [], add = (date, voucher, narration, source, lines) => { const l = lines.filter((x) => x.dr || x.cr); if (l.length) out.push({ date, voucher, narration, source, lines: l }); };
  const cls = Object.fromEntries((records.students || []).map((s) => [s.id, s.name]));
  for (const a of of('ledgerAccounts')) if (Number(a.openingBalance)) {
    const debitSide = ['Asset', 'Expense'].includes(a.type), amt = Math.abs(Number(a.openingBalance));
    add(year.slice(0, 4) + '-04-14', 'OPEN-' + a.code, `Opening balance: ${a.name}`, 'Opening', debitSide ? [{ account: a.code, dr: amt }, { account: '3000', cr: amt }] : [{ account: '3000', dr: amt }, { account: a.code, cr: amt }]);
  }
  for (const f of of('fees')) add(dayOf(f.createdAt) || f.dueDate, f.invoiceNo, `Invoice: ${cls[f.studentId] || 'Student'}${f.billingPeriod ? ' · ' + f.billingPeriod : ''}`, 'Fees', [{ account: '1100', dr: Number(f.amount) }, { account: FEE_INCOME[f.category] || '4000', cr: Number(f.amount) }]);
  for (const p of of('payments')) add(p.date, p.receiptNo, `Receipt${p.method === 'Advance' ? ' (from advance)' : ''}`, 'Receipts', [{ account: MONEY[p.method] || '1000', dr: Number(p.amount) }, { account: '1100', cr: Number(p.amount) }]);
  for (const a of of('advances')) add(a.date, a.receiptNo, `Advance received: ${cls[a.studentId] || 'Student'}`, 'Receipts', [{ account: MONEY[a.method] || '1000', dr: Number(a.amount) }, { account: '2000', cr: Number(a.amount) }]);
  for (const t of of('transactions')) {
    const amt = Number(t.amount);
    if (t.type === 'Income') add(t.date, t.reference, t.name, 'Income & expenditure', [{ account: '1000', dr: amt }, { account: ['Grant', 'Donation'].includes(t.category) ? '4100' : '4900', cr: amt }]);
    else add(t.date, t.reference, t.name, 'Income & expenditure', [{ account: EXPENSE[t.category] || '5900', dr: amt }, { account: '1000', cr: amt }]);
  }
  const people = Object.fromEntries([...(records.faculty || []), ...(records.staff || [])].map((p) => [p.id, p.name]));
  for (const s of of('payslips').filter((p) => p.status === 'Paid')) {
    const n = (k) => Number(s[k]) || 0;
    add(s.paidDate || dayOf(s.updatedAt) || year.slice(0, 4) + '-04-14', 'PAY-' + s.month.replace(/\s+/g, '-'), `Salary ${s.month}: ${people[s.facultyId || s.staffId] || 'Staff'}`, 'Payroll', [
      { account: '5000', dr: n('basic') + n('allowances') - n('absenceDeduction') }, { account: '5010', dr: n('ssfEmployer') },
      { account: '1010', cr: n('net') }, { account: '2100', cr: n('ssfEmployee') + n('ssfEmployer') }, { account: '2110', cr: n('cit') }, { account: '2120', cr: n('tds') }, { account: '2130', cr: n('otherDeductions') }]);
  }
  for (const j of of('journals')) add(j.date, j.voucherNo, j.narration, 'Journal', [{ account: j.debitAccount, dr: Number(j.amount) }, { account: j.creditAccount, cr: Number(j.amount) }]);
  return out.filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date) || String(a.voucher).localeCompare(String(b.voucher)));
}
const dayOf = (v) => { const d = v instanceof Date ? v.toISOString() : String(v || ''); return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : ''; };
const normal = (type) => (['Asset', 'Expense'].includes(type) ? 1 : -1);
/** Debit and credit totals and closing balance (positive on the account's normal side) for each account up to a date. */
export function trialBalance(entries, accounts, asOf = '9999-12-31') {
  const map = new Map(accounts.map((a) => [a.code, { ...a, dr: 0, cr: 0 }]));
  for (const e of entries) if (e.date <= asOf) for (const l of e.lines) { const a = map.get(l.account) || map.set(l.account, { code: l.account, name: 'Unknown account ' + l.account, type: 'Asset', dr: 0, cr: 0 }).get(l.account); a.dr += l.dr || 0; a.cr += l.cr || 0; }
  const rows = [...map.values()].map((a) => ({ ...a, dr: round2(a.dr), cr: round2(a.cr), balance: round2((a.dr - a.cr) * normal(a.type)) }));
  return { rows, dr: round2(rows.reduce((s, r) => s + r.dr, 0)), cr: round2(rows.reduce((s, r) => s + r.cr, 0)) };
}
export function ledgerFor(entries, code, from = '0000-01-01', to = '9999-12-31', type = 'Asset') {
  let balance = 0;
  const lines = [];
  for (const e of entries) for (const l of e.lines) {
    if (l.account !== code || e.date > to) continue;
    const delta = ((l.dr || 0) - (l.cr || 0)) * normal(type);
    if (e.date < from) { balance += delta; continue; }
    balance += delta;
    lines.push({ date: e.date, voucher: e.voucher, narration: e.narration, dr: l.dr || 0, cr: l.cr || 0, balance: round2(balance) });
  }
  return { opening: round2(balance - lines.reduce((s, l) => s + ((l.dr - l.cr) * normal(type)), 0)), lines, closing: round2(balance) };
}
/** Income and expenditure for a period, and the balance sheet on its last day. */
export function financialStatements(entries, accounts, from, to) {
  const tbEnd = trialBalance(entries, accounts, to).rows;
  const period = trialBalance(entries.filter((e) => e.date >= from), accounts, to).rows;
  const income = period.filter((a) => a.type === 'Income' && a.balance), expense = period.filter((a) => a.type === 'Expense' && a.balance);
  const surplus = round2(income.reduce((s, a) => s + a.balance, 0) - expense.reduce((s, a) => s + a.balance, 0));
  const pick = (t) => tbEnd.filter((a) => a.type === t && a.balance);
  const retained = round2(tbEnd.filter((a) => a.type === 'Income').reduce((s, a) => s + a.balance, 0) - tbEnd.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0));
  const assets = pick('Asset'), liabilities = pick('Liability'), equity = pick('Equity');
  const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0)), totalClaims = round2(liabilities.reduce((s, a) => s + a.balance, 0) + equity.reduce((s, a) => s + a.balance, 0) + retained);
  return { income, expense, surplus, assets, liabilities, equity, retained, totalAssets, totalClaims };
}
