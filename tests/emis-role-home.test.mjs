import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  greeting, firstName, attendanceRate, overdueInvoices, todaysClasses, marksToEnter, studentsToWatch,
  adminActions, studentsByProgram, collectionByMonth, collectionByProgram, financeSummary, studentSummary, moduleCount, upcomingExams,
} from '../modules/emis/src/role-home-model.mjs';

// Friday 6 Nov 2026, 10:30 in Kathmandu (UTC+5:45).
const now = new Date('2026-11-06T04:45:00Z');

function ctxFor(role, records) {
  return { user: { role, name: 'Test User' }, year: '2026/27', profile: { year: '2026/27' }, rows: (k) => records[k] || [] };
}

const records = {
  programs: [{ id: 'p1', name: 'BBA', code: 'BBA' }, { id: 'p2', name: 'BCA', code: 'BCA' }],
  students: [
    { id: 's1', name: 'Anisha', programId: 'p1', semester: 3, status: 'Active' },
    { id: 's2', name: 'Rohan', programId: 'p1', semester: 3, status: 'Active' },
    { id: 's3', name: 'Kiran', programId: 'p2', semester: 1, status: 'Active' },
  ],
  courses: [{ id: 'c1', name: 'Accounting', programId: 'p1', semester: 3 }],
  timetable: [
    { id: 't1', courseId: 'c1', day: 'Friday', startTime: '08:00', endTime: '09:00' },
    { id: 't2', courseId: 'c1', day: 'Friday', startTime: '13:00', endTime: '14:00' },
    { id: 't3', courseId: 'c1', day: 'Monday', startTime: '09:00', endTime: '10:00' },
  ],
  attendance: [
    { studentId: 's1', courseId: 'c1', date: '2026-11-03', status: 'Present' },
    { studentId: 's1', courseId: 'c1', date: '2026-11-04', status: 'Late' },
    { studentId: 's1', courseId: 'c1', date: '2026-11-05', status: 'Excused' },
    { studentId: 's2', courseId: 'c1', date: '2026-11-02', status: 'Present' },
    { studentId: 's2', courseId: 'c1', date: '2026-11-03', status: 'Absent' },
    { studentId: 's2', courseId: 'c1', date: '2026-11-04', status: 'Absent' },
    { studentId: 's2', courseId: 'c1', date: '2026-11-05', status: 'Absent' },
  ],
  exams: [
    { id: 'e1', name: 'Internal 1', courseId: 'c1', date: '2026-11-02', maxMarks: 50, passMarks: 20, status: 'Completed' },
    { id: 'e2', name: 'Internal 2', courseId: 'c1', date: '2026-11-20', maxMarks: 50, passMarks: 20, status: 'Scheduled' },
  ],
  results: [
    { studentId: 's1', examId: 'e1', marks: 42, gradePoint: 3.6, status: 'Published' },
  ],
  fees: [
    { id: 'f1', studentId: 's1', amount: 10000, dueDate: '2026-10-01' },
    { id: 'f2', studentId: 's2', amount: 5000, dueDate: '2026-11-10' },
    { id: 'f3', studentId: 's3', amount: 8000, dueDate: '2026-09-01' },
  ],
  payments: [
    { invoiceId: 'f1', amount: 4000, date: '2026-11-06' },
    { invoiceId: 'f3', amount: 8000, date: '2026-09-02' },
  ],
  transactions: [{ type: 'Expenditure', amount: 3000, date: '2026-10-01' }, { type: 'Income', amount: 1000, date: '2026-10-01' }],
  admissions: [{ status: 'Applied' }, { status: 'Under review' }, { status: 'Accepted' }],
  evidence: [{ status: 'Missing' }, { status: 'Verified' }],
  grievances: [{ status: 'Open', date: '2026-10-20' }, { status: 'Open', date: '2026-11-05' }],
  scholarships: [{ studentId: 's1', amount: 2000, status: 'Renewal due' }],
};

test('greeting follows Nepal time and first names are safe', () => {
  assert.equal(greeting(now), 'Good morning');
  assert.equal(greeting(new Date('2026-11-06T09:00:00Z')), 'Good afternoon');
  assert.equal(firstName('Sita Rai'), 'Sita');
  assert.equal(firstName(''), 'there');
});

test('attendance leaves out excused sessions', () => {
  assert.deepEqual(attendanceRate(records.attendance.filter((a) => a.studentId === 's1')), { rate: 100, present: 2, total: 2 });
  assert.equal(attendanceRate([]).rate, null);
});

test('overdue invoices are oldest first with remaining balance', () => {
  const o = overdueInvoices(ctxFor('Admin', records), now);
  assert.deepEqual(o.map((r) => [r.id, r.balance, r.daysOverdue]), [['f1', 6000, 36]]);
});

test("today's classes know when attendance is still needed", () => {
  const t = todaysClasses(ctxFor('Faculty', records), now);
  assert.deepEqual(t.map((c) => [c.id, c.taken, c.needsAttendance]), [['t1', false, true], ['t2', false, false]]);
});

test('marks to enter counts students on the course still without a mark', () => {
  const m = marksToEnter(ctxFor('Faculty', records), now);
  assert.deepEqual(m.map((e) => [e.id, e.entered, e.expected, e.remaining]), [['e1', 1, 2, 1]]);
});

test('students to watch flags repeated absence and low attendance', () => {
  const w = studentsToWatch(ctxFor('Faculty', records));
  assert.deepEqual(w.map((x) => [x.student.id, x.reason]), [['s2', 'Low attendance']]);
});

test('admin actions only include modules the role can read', () => {
  const admin = adminActions(ctxFor('Admin', records), now).map((a) => a.key);
  assert.deepEqual(admin, ['fees', 'admissions', 'evidence', 'grievances']);
  const hr = adminActions(ctxFor('HR/Admin', records), now);
  assert.deepEqual(hr, []);
});

test('program and month breakdowns', () => {
  const ctx = ctxFor('Admin', records);
  assert.deepEqual(studentsByProgram(ctx).map((x) => [x.program.id, x.count]), [['p1', 2], ['p2', 1]]);
  const months = collectionByMonth(ctx, 3, now);
  assert.deepEqual(months.map((m) => [m.key, m.amount]), [['2026-09', 8000], ['2026-10', 0], ['2026-11', 4000]]);
  assert.deepEqual(collectionByProgram(ctx).map((r) => [r.programId, Math.round(r.rate)]), [['p2', 100], ['p1', 27]]);
});

test('finance summary', () => {
  const f = financeSummary(ctxFor('Finance Head', records), now);
  assert.equal(f.collected, 12000);
  assert.equal(f.overdueAmount, 6000);
  assert.equal(f.dueSoon.length, 1);
  assert.equal(f.net, 13000 - 3000);
  assert.equal(f.renewalsDue, 1);
  assert.equal(f.todaysPayments.length, 1);
});

test('student summary uses only published results', () => {
  const own = { ...records, results: [...records.results, { studentId: 's1', examId: 'e2', marks: 10, status: 'Draft' }] };
  const s = studentSummary(ctxFor('Student', own), now);
  assert.equal(s.gpa, 3.6);
  assert.equal(s.average, 84);
  assert.equal(s.published.length, 1);
  assert.equal(s.examsSoon[0].id, 'e2');
});

test('module counts give a useful status line', () => {
  const ctx = ctxFor('Student Affairs', records);
  assert.deepEqual(moduleCount(ctx, 'admissions', now), { entity: 'admissions', count: 3, line: '2 awaiting a decision' });
  assert.equal(moduleCount(ctx, 'timetable', now).line, '2 classes today');
  assert.equal(upcomingExams(ctx, now)[0].id, 'e2');
});
