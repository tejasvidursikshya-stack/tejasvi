import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cleanRecord, modules, scopeRecord } from '../modules/emis/shared/schema.mjs';
import { schoolRoute, validateSchool } from '../modules/emis/server/school.mjs';

// A small in-memory stand-in for the EMIS store: same validation path, no database.
function fakeStore(kind = 'school') {
  const rows = Object.fromEntries(Object.keys(modules).map((k) => [k, []]));
  const all = async () => JSON.parse(JSON.stringify(rows));
  return {
    rows, all, meta: async () => ({ kind }), tx: async (fn) => fn(),
    async save(user, entity, input, id = null) {
      const value = cleanRecord(entity, input, kind), snapshot = await all();
      const byId = new Map(Object.values(snapshot).flat().map((r) => [r.id, r]));
      if (!scopeRecord(user, entity, { ...value, id: id || '' }, snapshot, true)) throw Object.assign(new Error('Permission denied.'), { status: 403 });
      validateSchool(entity, value, id, snapshot, (x) => byId.get(x), user);
      if (id) { const i = rows[entity].findIndex((r) => r.id === id); rows[entity][i] = { ...value, id, version: rows[entity][i].version + 1 }; return rows[entity][i]; }
      const r = { ...value, id: randomUUID(), version: 1 }; rows[entity].push(r); return r;
    },
  };
}
const year = '2026/27', admin = { role: 'Admin' };
async function seed(store) {
  const t = await store.save(admin, 'faculty', { year, employeeNo: 'T1', name: 'Sita Rai', gender: 'Female', departmentId: undefined, designation: 'Teacher', employment: 'Full-time', status: 'Active' }).catch(() => null);
  const teacherId = t?.id || 'f1';
  const cls = await store.save(admin, 'classes', { year, name: 'Grade 5', section: 'A', classTeacherId: undefined, status: 'Active' });
  const sub = await store.save(admin, 'subjects', { year, classId: cls.id, name: 'Science', type: 'Compulsory', creditHours: 4, theoryFull: 75, practicalFull: 25, teacherId: undefined });
  const term = await store.save(admin, 'terms', { year, name: 'First Terminal', status: 'Marks entry' });
  const kids = [];
  for (const [i, name] of ['Asha', 'Bikash', 'Chandra'].entries())
    kids.push(await store.save(admin, 'students', { year, studentNo: 'S' + i, name, classId: cls.id, rollNo: i + 1, gender: 'Female', status: 'Active', transport: i === 0 ? 'School bus' : 'Walk' }));
  return { teacherId, cls, sub, term, kids };
}
const call = (store, user, path, body) => schoolRoute(store, user, path, 'POST', async () => body);

test('daily register saves once per student and date, and updates on change', async () => {
  const store = fakeStore(), { cls, kids } = await seed(store);
  const rows = kids.map((k, i) => ({ studentId: k.id, status: i === 1 ? 'Absent' : 'Present' }));
  assert.equal((await call(store, admin, '/api/school/attendance', { year, classId: cls.id, date: '2026-05-01', rows })).saved, 3);
  assert.equal((await call(store, admin, '/api/school/attendance', { year, classId: cls.id, date: '2026-05-01', rows })).saved, 0);
  rows[1].status = 'Leave';
  assert.equal((await call(store, admin, '/api/school/attendance', { year, classId: cls.id, date: '2026-05-01', rows })).saved, 1);
  assert.equal(store.rows.schoolAttendance.length, 3);
  await assert.rejects(call(store, admin, '/api/school/attendance', { year, classId: cls.id, date: '2999-01-01', rows }), /future/);
});

test('marks respect full marks and teachers cannot publish', async () => {
  const store = fakeStore(), { cls, sub, term, kids } = await seed(store);
  await assert.rejects(call(store, admin, '/api/school/marks', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kids[0].id, theory: 80 }] }), /cannot exceed 75/);
  const saved = await call(store, admin, '/api/school/marks', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kids[0].id, theory: 70, practical: 20 }, { studentId: kids[1].id, theory: '' }] });
  assert.equal(saved.saved, 1); assert.equal(store.rows.marks[0].status, 'Draft');
  // A teacher of the class may save drafts but not publish.
  store.rows.classes[0].classTeacherId = 'f9';
  const teacher = { role: 'Faculty', facultyId: 'f9' };
  await assert.rejects(call(store, teacher, '/api/school/marks', { year, termId: term.id, subjectId: sub.id, publish: true, rows: [{ studentId: kids[2].id, theory: 50, practical: 15 }] }), /examination team/);
  assert.equal((await call(store, teacher, '/api/school/marks', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kids[2].id, theory: 50, practical: 15 }] })).saved, 1);
  // Another teacher cannot enter marks for this class.
  await assert.rejects(call(store, { role: 'Faculty', facultyId: 'other' }, '/api/school/marks', { year, termId: term.id, subjectId: sub.id, rows: [{ studentId: kids[1].id, theory: 40, practical: 15 }] }), /Permission denied/);
});

test('monthly billing creates one invoice per student and never bills twice', async () => {
  const store = fakeStore(), { cls, kids } = await seed(store);
  await store.save(admin, 'feeHeads', { year, classId: cls.id, head: 'Tuition', amount: 2500, frequency: 'Monthly', appliesTo: 'All students' });
  await store.save(admin, 'feeHeads', { year, head: 'Transport', amount: 1000, frequency: 'Monthly', appliesTo: 'School bus users' });
  await store.save(admin, 'scholarships', { year, studentId: kids[2].id, category: 'Merit', amount: 1, percentage: 100, status: 'Approved' });
  const body = { year, month: 'Baishakh', dueDate: '2026-05-10', classIds: [cls.id] };
  const preview = await call(store, admin, '/api/school/billing/preview', body);
  assert.deepEqual(preview.bills.map((b) => b.total), [3500, 2500, 0]);
  const done = await call(store, admin, '/api/school/billing/apply', body);
  assert.equal(done.created, 2); assert.equal(store.rows.fees.length, 2);
  assert.match(store.rows.fees[0].notes, /Tuition: NPR 2,500/);
  assert.equal((await call(store, admin, '/api/school/billing/apply', body)).created, 0);
  assert.equal(store.rows.fees[0].billingPeriod, '2026/27 Baishakh');
});

test('school tools are refused for colleges, and roll numbers stay unique', async () => {
  await assert.rejects(call(fakeStore('college'), admin, '/api/school/attendance', { year }), /school workspaces/);
  const store = fakeStore(), { cls } = await seed(store);
  await assert.rejects(store.save(admin, 'students', { year, studentNo: 'S9', name: 'Dup', classId: cls.id, rollNo: 2, gender: 'Male', status: 'Active' }), /Roll number 2/);
});
