import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cleanRecord, modules, scopeRecord } from '../modules/emis/shared/schema.mjs';
import { billFor, payslipFor } from '../modules/emis/shared/school.mjs';
import { adToBs, bsToAd, formatBs, bsYearOf, isProjected } from '../modules/emis/shared/bs.mjs';
import { routineClash, freeTeachers, periodsToCover, unpaidDays, payMonthRange, seatPlan, examClash, casInternal, siblingRanks, overdueForFine, ledgerEntries, chartOfAccounts, trialBalance, financialStatements, ledgerFor, weekday } from '../modules/emis/shared/school-ops.mjs';
import { schoolRoute, validateSchool } from '../modules/emis/server/school.mjs';

const year = '2026/27', admin = { role: 'Admin' };
function fakeStore(profile = {}) {
  const rows = Object.fromEntries(Object.keys(modules).map((k) => [k, []]));
  const all = async () => JSON.parse(JSON.stringify(rows));
  return {
    rows, all, meta: async () => ({ kind: 'school', name: 'Whitefield School', ...profile }), tx: async (fn) => fn(), log: async () => {},
    async get(id) { for (const [entity, list] of Object.entries(rows)) { const r = list.find((x) => x.id === id); if (r) return { ...r, entity }; } return null; },
    async archive(user, entity, id) { rows[entity] = rows[entity].filter((r) => r.id !== id); },
    async save(user, entity, input, id = null) {
      const value = cleanRecord(entity, input, 'school'), snap = await all(), byId = new Map(Object.values(snap).flat().map((r) => [r.id, r]));
      if (!scopeRecord(user, entity, { ...value, id: id || '' }, snap, true)) throw Object.assign(new Error('Permission denied.'), { status: 403 });
      validateSchool(entity, value, id, snap, (x) => byId.get(x), user);
      if (id) { const i = rows[entity].findIndex((r) => r.id === id); rows[entity][i] = { ...value, id, version: rows[entity][i].version + 1 }; return rows[entity][i]; }
      const r = { ...value, id: randomUUID(), version: 1 }; rows[entity].push(r); return r;
    },
  };
}
const call = (store, user, path, body) => schoolRoute(store, user, path, 'POST', async () => body);

test('Bikram Sambat dates match the published calendar', () => {
  assert.deepEqual(adToBs('2026-04-14'), { year: 2083, month: 1, day: 1, projected: false });
  assert.equal(formatBs('2026-11-07'), '21 Kartik 2083');
  assert.equal(bsToAd(2082, 8, 1), '2025-11-17'); // 1 Mangsir 2082
  assert.equal(bsToAd(2083, 12, 30), '2027-04-14');
  assert.equal(formatBs(bsToAd(2081, 12, 31)), '31 Chaitra 2081');
  assert.equal(bsYearOf('2026/27'), 2083);
  assert.equal(isProjected(2083), false); assert.equal(isProjected(2085), true);
  assert.throws(() => bsToAd(2083, 2, 32), /does not exist/);
  for (const iso of ['2023-04-14', '2024-12-31', '2026-07-16', '2027-01-01']) { const b = adToBs(iso); assert.equal(bsToAd(b.year, b.month, b.day), iso); }
});

test('the routine stops double-booked classes and teachers', () => {
  const routine = [{ id: 'r1', year, classId: 'c1', day: 'Sunday', period: 1, startTime: '10:00', endTime: '10:45', facultyId: 't1' }];
  assert.match(routineClash({ year, classId: 'c1', day: 'Sunday', period: 1, startTime: '11:00', endTime: '11:45' }, routine), /already has period 1/);
  assert.match(routineClash({ year, classId: 'c2', day: 'Sunday', period: 1, startTime: '10:30', endTime: '11:15', facultyId: 't1' }, routine), /teacher already teaches/);
  assert.equal(routineClash({ year, classId: 'c2', day: 'Monday', period: 1, startTime: '10:00', endTime: '10:45', facultyId: 't1' }, routine), null);
});

test('substitutions: who is away, which periods need cover, who is free', () => {
  const date = '2026-11-08'; assert.equal(weekday(date), 'Sunday');
  const records = {
    faculty: [{ id: 't1', name: 'Sita', status: 'Active' }, { id: 't2', name: 'Ram', status: 'Active' }, { id: 't3', name: 'Gita', status: 'Active' }],
    routine: [{ id: 'r1', year, classId: 'c1', day: 'Sunday', period: 1, startTime: '10:00', endTime: '10:45', facultyId: 't1' }, { id: 'r2', year, classId: 'c2', day: 'Sunday', period: 1, startTime: '10:00', endTime: '10:45', facultyId: 't2' }],
    staffAttendance: [{ date, facultyId: 't1', status: 'Absent' }], leaves: [], substitutions: [],
  };
  const cover = periodsToCover(records, date, year);
  assert.deepEqual(cover.map((p) => p.id), ['r1']);
  assert.deepEqual(freeTeachers(records, cover[0], date, year).map((t) => t.id), ['t3']); // t1 away, t2 teaching
});

test('unpaid days come from absence without approved leave, and reduce basic pay', () => {
  const records = {
    staffAttendance: [{ facultyId: 'f', date: '2026-10-20', status: 'Absent' }, { facultyId: 'f', date: '2026-10-21', status: 'Absent' }, { facultyId: 'f', date: '2026-10-22', status: 'Half day' }],
    leaves: [{ facultyId: 'f', type: 'Sick', status: 'Approved', fromDate: '2026-10-21', toDate: '2026-10-21' }, { facultyId: 'f', type: 'Unpaid', status: 'Approved', fromDate: '2026-10-26', toDate: '2026-10-27' }],
  };
  const range = payMonthRange(year, 'Kartik');
  assert.deepEqual([range.from, range.to, range.days], ['2026-10-18', '2026-11-16', 30]);
  assert.equal(unpaidDays(records, 'f', range.from, range.to), 1 + 0.5 + 2);
  const slip = payslipFor({ basic: 30000, ssf: 'No' }, { unpaidDays: 3.5, monthDays: 30 });
  assert.equal(slip.absenceDeduction, 3500); assert.equal(slip.net, 26500);
});

test('seat plan alternates classes along a row and reports overflow', () => {
  const g = (label, n) => ({ label, students: Array.from({ length: n }, (_, i) => ({ id: label + i, name: label + i })) });
  const r = seatPlan([g('6A', 3), g('7A', 3)], [{ name: 'R1', rows: 1, cols: 4 }, { name: 'R2', rows: 1, cols: 1 }]);
  assert.deepEqual(r.plan[0].seats.map((s) => s.student.classLabel), ['6A', '7A', '6A', '7A']);
  assert.equal(r.unseated.length, 1);
  assert.match(examClash({ year, termId: 't', classId: 'c', subjectId: 's2', date: '2026-12-01', startTime: '11:00', endTime: '12:00' }, [{ id: 'x', year, termId: 't', classId: 'c', subjectId: 's1', date: '2026-12-01', startTime: '10:00', endTime: '13:00' }]), /already has a paper/);
});

test('CAS scales to internal marks; billing applies the largest discount and late fines', () => {
  assert.equal(casInternal([{ score: 4, outOf: 5 }, { score: 8, outOf: 10 }, { score: 3, outOf: 5 }], 25), 19); // 15/20 of 25 = 18.75, rounded to the nearest half mark
  assert.equal(casInternal([], 25), undefined);
  const students = [
    { id: 'a', name: 'Elder', status: 'Active', classId: 'c8', fatherPhone: '9841000001' },
    { id: 'b', name: 'Younger', status: 'Active', classId: 'c3', motherPhone: '9851000002', fatherPhone: '+977 9841000001' },
    { id: 'c', name: 'Other', status: 'Active', classId: 'c3', fatherPhone: '9800000009' }];
  const ranks = siblingRanks(students, [{ id: 'c8', name: 'Grade 8' }, { id: 'c3', name: 'Grade 3' }]);
  assert.deepEqual([ranks.get('a').rank, ranks.get('b').rank, ranks.get('c').size], [0, 1, 1]);
  const heads = [{ id: 'h', head: 'Tuition', amount: 4000, frequency: 'Monthly', appliesTo: 'All students' }];
  const bill = billFor({ ...students[1], staffChild: 'Yes' }, heads, [], { month: 'Mangsir', siblingRank: 1, siblingPct: 10, staffChildPct: 25, overdue: [{ id: 'old', invoiceNo: 'SB-1' }], lateFine: 200 });
  assert.deepEqual([bill.discount, bill.discountNote, bill.total], [1000, 'Staff child discount 25% of tuition', 3200]);
  const overdue = overdueForFine([{ id: 'i1', amount: 100, dueDate: '2026-10-01' }, { id: 'i2', amount: 100, dueDate: '2026-10-01', lateFined: 'Yes' }, { id: 'i3', amount: 100, dueDate: '2026-11-05' }], [], '2026-11-07', 3);
  assert.deepEqual(overdue.map((x) => x.id), ['i1']);
});

test('books of account always balance', () => {
  const records = {
    students: [{ id: 's', name: 'Asha' }], faculty: [{ id: 'f', name: 'Sita' }],
    fees: [{ year, invoiceNo: 'SB-1', studentId: 's', category: 'Monthly bill', amount: 5000, dueDate: '2026-05-10' }],
    payments: [{ year, receiptNo: 'R-1', invoiceId: 'x', amount: 3000, date: '2026-05-12', method: 'Cash' }, { year, receiptNo: 'R-2', invoiceId: 'x', amount: 1000, date: '2026-05-13', method: 'eSewa' }],
    advances: [{ year, receiptNo: 'ADV-1', studentId: 's', amount: 2000, date: '2026-05-01', method: 'Bank transfer' }],
    transactions: [{ year, reference: 'E-1', name: 'Electricity', type: 'Expenditure', category: 'Administration', amount: 800, date: '2026-05-20' }],
    payslips: [{ year, month: 'Jestha 2026/27', facultyId: 'f', basic: 30000, allowances: 2000, ssfEmployee: 3300, ssfEmployer: 6000, cit: 1000, tds: 500, otherDeductions: 0, absenceDeduction: 1000, net: 26200, status: 'Paid', paidDate: '2026-06-14' }],
    journals: [{ year, voucherNo: 'JV-1', date: '2026-04-14', debitAccount: '1010', creditAccount: '3000', amount: 50000, narration: 'Opening bank balance' }],
    ledgerAccounts: [{ year, code: '1500', name: 'Furniture', type: 'Asset', openingBalance: 20000 }],
  };
  const entries = ledgerEntries(records, year), accounts = chartOfAccounts(records.ledgerAccounts);
  for (const e of entries) assert.equal(e.lines.reduce((s, l) => s + (l.dr || 0) - (l.cr || 0), 0), 0, e.voucher);
  const tb = trialBalance(entries, accounts);
  assert.equal(tb.dr, tb.cr);
  assert.equal(ledgerFor(entries, '1000', '2026-04-01', '2026-12-31', 'Asset').closing, 3000 - 800);
  const fs = financialStatements(entries, accounts, '2026-04-14', '2027-04-13');
  assert.equal(fs.totalAssets, fs.totalClaims);
  assert.equal(fs.surplus, 5000 - 800 - (32000 - 1000) - 6000);
});

test('parents see their own class routine, events and messages; teachers see their pupils only', () => {
  const records = { students: [{ id: 'a', personId: 'pa', year, classId: 'c1', status: 'Active' }, { id: 'b', personId: 'pb', year, classId: 'c2', status: 'Active' }], classes: [{ id: 'c1', classTeacherId: 'f1' }, { id: 'c2' }], subjects: [], terms: [{ id: 't1', status: 'Published' }, { id: 't2', status: 'Marks entry' }] };
  const parent = { role: 'Parent', childPersonIds: ['pa'] }, teacher = { role: 'Faculty', facultyId: 'f1' };
  assert.equal(scopeRecord(parent, 'routine', { classId: 'c1' }, records), true);
  assert.equal(scopeRecord(parent, 'routine', { classId: 'c2' }, records), false);
  assert.equal(scopeRecord(parent, 'events', { audience: 'Staff' }, records), false);
  assert.equal(scopeRecord(parent, 'events', { audience: 'Everyone' }, records), true);
  assert.equal(scopeRecord(parent, 'messages', { studentId: 'a' }, records, true), true);
  assert.equal(scopeRecord(parent, 'messages', { studentId: 'b' }, records), false);
  assert.equal(scopeRecord(parent, 'reportRemarks', { studentId: 'a', termId: 't2' }, records), false);
  assert.equal(scopeRecord(parent, 'reportRemarks', { studentId: 'a', termId: 't1' }, records), true);
  assert.equal(scopeRecord(teacher, 'messages', { studentId: 'a' }, records, true), true);
  assert.equal(scopeRecord(teacher, 'messages', { studentId: 'b' }, records), false);
  assert.equal(scopeRecord(teacher, 'staffAttendance', { facultyId: 'f2' }, records), false);
});

test('routes: staff attendance, CAS to internal marks, billing with advances, journals, messages', async () => {
  const s = fakeStore({ siblingDiscount: 10, lateFineFlat: 100, lateFineGraceDays: 0 });
  const f = { id: 'f1', year, employeeNo: 'T1', name: 'Sita Rai', status: 'Active', version: 1 }; s.rows.faculty.push(f);
  assert.equal((await call(s, admin, '/api/school/staff-attendance', { year, date: '2026-05-01', rows: [{ facultyId: f.id, status: 'Absent' }] })).saved, 1);
  assert.equal((await call(s, admin, '/api/school/staff-attendance', { year, date: '2026-05-01', rows: [{ facultyId: f.id, status: 'Absent' }] })).saved, 0);

  const cls = await s.save(admin, 'classes', { year, name: 'Grade 5', section: 'A', classTeacherId: f.id, status: 'Active' });
  const sub = await s.save(admin, 'subjects', { year, classId: cls.id, name: 'Science', type: 'Compulsory', creditHours: 4, theoryFull: 75, practicalFull: 25 });
  const term = await s.save(admin, 'terms', { year, name: 'First Terminal', status: 'Marks entry' });
  const kid = await s.save(admin, 'students', { year, studentNo: 'S1', name: 'Asha', classId: cls.id, rollNo: 1, gender: 'Female', status: 'Active', fatherPhone: '9841000001', dob: '2015-01-01' });
  await s.save(admin, 'students', { year, studentNo: 'S2', name: 'Anu', classId: cls.id, rollNo: 2, gender: 'Female', status: 'Active', fatherPhone: '9841000001', dob: '2016-01-01' });
  assert.equal((await call(s, admin, '/api/school/cas', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kid.id, scores: { Participation: 5, 'Project & practical work': 10 } }] })).saved, 2);
  await assert.rejects(call(s, admin, '/api/school/cas', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kid.id, scores: { Participation: 9 } }] }), /cannot be more than 5/);
  assert.equal((await call(s, admin, '/api/school/cas/fill', { year, termId: term.id, subjectId: sub.id })).filled, 1);
  assert.equal(s.rows.marks[0].practical, 25);

  await s.save(admin, 'feeHeads', { year, head: 'Tuition', amount: 4000, frequency: 'Monthly', appliesTo: 'All students' });
  await s.save(admin, 'advances', { year, receiptNo: 'ADV-1', studentId: kid.id, amount: 1500, date: '2026-05-01', method: 'Cash', used: 0, status: 'Available' });
  const old = await s.save(admin, 'fees', { year, invoiceNo: 'OLD-1', studentId: kid.id, category: 'Monthly bill', amount: 4000, dueDate: '2026-04-20' });
  const pv = await call(s, admin, '/api/school/billing/preview', { year, month: 'Jestha', dueDate: '2026-06-10', classIds: [cls.id] });
  const asha = pv.bills.find((b) => b.studentId === kid.id), anu = pv.bills.find((b) => b.studentId !== kid.id);
  assert.equal(asha.total, 4000 + 100); // eldest of the two pays full tuition, plus one late fine
  assert.equal(anu.discount, 400);
  assert.equal(asha.fromAdvance, 1500);
  const done = await call(s, admin, '/api/school/billing/apply', { year, month: 'Jestha', dueDate: '2026-06-10', classIds: [cls.id] });
  assert.deepEqual([done.created, done.adjusted], [2, 1500]);
  assert.equal(s.rows.fees.find((x) => x.id === old.id).lateFined, 'Yes');
  assert.equal(s.rows.advances[0].status, 'Used');
  assert.equal(s.rows.payments[0].method, 'Advance');

  await assert.rejects(s.save(admin, 'journals', { year, voucherNo: 'JV-1', date: '2026-05-01', debitAccount: '1000', creditAccount: '9999', amount: 10, narration: 'x' }), /chart of accounts/);
  await s.save(admin, 'journals', { year, voucherNo: 'JV-1', date: '2026-05-01', debitAccount: '1000', creditAccount: '3000', amount: 10, narration: 'Opening cash' });

  const parent = { role: 'Parent', name: 'Hari', childPersonIds: [kid.id] };
  s.db = { connection: () => ({ execute: async () => [[]], query: async () => [[]] }) };
  await assert.rejects(s.save(parent, 'messages', { year, studentId: kid.id, body: 'Hello', fromSide: 'School' }), /own side/);
  const m = await s.save(parent, 'messages', { year, studentId: kid.id, body: 'Asha will be late tomorrow.', fromSide: 'Family', author: 'Hari', readBySchool: 'No' });
  await assert.rejects(s.save(admin, 'messages', { ...m, body: 'Edited' }, m.id), /cannot be changed/);
  await s.save(admin, 'messages', { ...m, readBySchool: 'Yes' }, m.id);
});
