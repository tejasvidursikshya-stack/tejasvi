import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cleanRecord, modules, scopeRecord, can } from '../modules/emis/shared/schema.mjs';
import { payslipFor, loanFine, smsPhone, flashCounts } from '../modules/emis/shared/school.mjs';
import { validateSchool } from '../modules/emis/server/school.mjs';
import { familyRoute, esewaSign } from '../modules/emis/server/school-family.mjs';

const year = '2026/27';
const kids = [{ id: 'a', personId: 'pa', year, classId: 'c1', status: 'Active' }, { id: 'b', personId: 'pb', year, classId: 'c2', status: 'Active' }];
const parent = { role: 'Parent', childPersonIds: ['pa'] };

test('a parent sees only their own child, published marks and the right notices', () => {
  const records = { students: kids, classes: [{ id: 'c1' }, { id: 'c2' }] };
  assert.equal(scopeRecord(parent, 'students', kids[0], records), true);
  assert.equal(scopeRecord(parent, 'students', kids[1], records), false);
  assert.equal(scopeRecord(parent, 'students', kids[0], records, true), false); // read-only
  assert.equal(scopeRecord(parent, 'marks', { studentId: 'a', status: 'Draft' }, records), false);
  assert.equal(scopeRecord(parent, 'marks', { studentId: 'a', status: 'Published' }, records), true);
  assert.equal(scopeRecord(parent, 'fees', { studentId: 'b' }, records), false);
  const notice = (audience, extra = {}) => ({ status: 'Published', publishDate: '2020-01-01', audience, ...extra });
  assert.equal(scopeRecord(parent, 'notices', notice('Parents'), records), true);
  assert.equal(scopeRecord(parent, 'notices', notice('Students'), records), false);
  assert.equal(scopeRecord(parent, 'notices', notice('One class', { classId: 'c1' }), records), true);
  assert.equal(scopeRecord(parent, 'notices', notice('One class', { classId: 'c2' }), records), false);
  assert.equal(scopeRecord(parent, 'notices', notice('Everyone', { status: 'Draft' }), records), false);
  assert.equal(scopeRecord(parent, 'leaveRequests', { studentId: 'a', status: 'Pending' }, records, true), true);
  assert.equal(scopeRecord(parent, 'leaveRequests', { studentId: 'a', status: 'Approved' }, records, true), false);
  assert.equal(can('Parent', 'marks', 'write'), false);
});

test('payslip applies SSF 11% / 20% on basic only', () => {
  const p = payslipFor({ basic: 30000, allowances: 5000, ssf: 'Yes', cit: 1000, tds: 500 });
  assert.deepEqual([p.ssfEmployee, p.ssfEmployer, p.net], [3300, 6000, 30200]);
  assert.equal(payslipFor({ basic: 20000, ssf: 'No' }).net, 20000);
});

test('library fines, phone numbers and the eSewa signature', () => {
  assert.equal(loanFine({ dueDate: '2026-05-10' }, '2026-05-10'), 0);
  assert.equal(loanFine({ dueDate: '2026-05-10' }, '2026-05-14', 5), 20);
  assert.deepEqual(['+977-9841234567', '98 4123 4567', '01-5551234', '9612345678'].map(smsPhone), ['9841234567', '9841234567', null, null]);
  // HMAC-SHA256 over "k=v" pairs in the signed order, base64 — any change to the amount changes the signature.
  const fields = { total_amount: '100', transaction_uuid: '11-201-13', product_code: 'EPAYTEST' }, names = 'total_amount,transaction_uuid,product_code';
  const sig = esewaSign('8gBm/:&EnhH.1/q', fields, names);
  assert.match(sig, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(esewaSign('8gBm/:&EnhH.1/q', { ...fields }, names), sig);
  assert.notEqual(esewaSign('8gBm/:&EnhH.1/q', { ...fields, total_amount: '1' }, names), sig);
});

test('Flash report counts students by class, sex and group', () => {
  const r = flashCounts({ classes: [{ id: 'c6', year, name: 'Grade 6' }], students: [
    { year, status: 'Active', classId: 'c6', gender: 'Female', ethnicity: 'Dalit', disability: 'None' },
    { year, status: 'Active', classId: 'c6', gender: 'Male', ethnicity: 'Janajati', disability: 'Visual' },
    { year, status: 'Withdrawn', classId: 'c6', gender: 'Male' }], faculty: [{ status: 'Active', gender: 'Female' }] }, year);
  assert.deepEqual(r.rows[0], { className: 'Grade 6', girls: 1, boys: 1, other: 0, total: 2, dalit: 1, janajati: 1, disability: 1 });
  assert.equal(r.teachers.female, 1);
});

function fakeStore() {
  const rows = Object.fromEntries(Object.keys(modules).map((k) => [k, []]));
  const all = async () => JSON.parse(JSON.stringify(rows));
  return { rows, all, meta: async () => ({ kind: 'school', libraryFinePerDay: 10 }), tx: async (fn) => fn(), log: async () => {},
    async get(id) { for (const [entity, list] of Object.entries(rows)) { const r = list.find((x) => x.id === id); if (r) return { ...r, entity }; } return null; },
    async save(user, entity, input, id = null) {
      const value = cleanRecord(entity, input, 'school'), snap = await all(), byId = new Map(Object.values(snap).flat().map((r) => [r.id, r]));
      if (!scopeRecord(user, entity, { ...value, id: id || '' }, snap, true)) throw Object.assign(new Error('Permission denied.'), { status: 403 });
      validateSchool(entity, value, id, snap, (x) => byId.get(x), user);
      if (id) { const i = rows[entity].findIndex((r) => r.id === id); rows[entity][i] = { ...value, id, version: rows[entity][i].version + 1 }; return rows[entity][i]; }
      const r = { ...value, id: randomUUID(), version: 1 }; rows[entity].push(r); return r;
    } };
}
const admin = { role: 'Admin' };

test('parents can only send pending leave notes, teachers request their own leave', async () => {
  const s = fakeStore();
  const c = await s.save(admin, 'classes', { year, name: 'Grade 6', section: 'A', status: 'Active' });
  const st = await s.save(admin, 'students', { year, studentNo: 'S1', name: 'Asha', classId: c.id, gender: 'Female', status: 'Active' });
  const p = { role: 'Parent', childPersonIds: [st.id] };
  await s.save(p, 'leaveRequests', { year, studentId: st.id, fromDate: '2026-06-01', toDate: '2026-06-02', reason: 'Fever', status: 'Pending' });
  await assert.rejects(s.save(p, 'leaveRequests', { year, studentId: st.id, fromDate: '2026-06-01', toDate: '2026-06-02', reason: 'x', status: 'Approved' }), /Permission denied|Pending/);
  await assert.rejects(s.save(admin, 'leaveRequests', { year, studentId: st.id, fromDate: '2026-06-05', toDate: '2026-06-02', reason: 'x', status: 'Pending' }), /end date/);
  const t = { role: 'Faculty', facultyId: 'f1' };
  await s.save(t, 'leaves', { year, facultyId: 'f1', type: 'Sick', fromDate: '2026-06-01', toDate: '2026-06-01', days: 1, reason: 'Fever', status: 'Requested' }).catch((e) => assert.match(e.message, /Teacher no longer exists|exists/));
});

test('payroll and the library desk through the route handler', async () => {
  const s = fakeStore();
  s.rows.faculty.push({ id: 'f1', year, employeeNo: 'T-1', name: 'Sita Rai', status: 'Active' });
  s.rows.salaryStructures.push({ id: 'ss', year, facultyId: 'f1', basic: 25000, allowances: 2000, ssf: 'Yes', status: 'Active', version: 1 });
  const pv = await familyRoute(s, admin, '/api/school/payroll/preview', { year, month: 'Shrawan' }, {});
  assert.equal(pv.slips[0].net, 25000 + 2000 - 2750);
  assert.equal((await familyRoute(s, admin, '/api/school/payroll/apply', { year, month: 'Shrawan' }, {})).created, 1);
  assert.equal((await familyRoute(s, admin, '/api/school/payroll/apply', { year, month: 'Shrawan' }, {})).created, 0);

  s.rows.library.push({ id: 'bk', year, name: 'Muna Madan', accessionNo: 'ACC-1', copies: 1, status: 'Available', version: 1 });
  s.rows.students.push({ id: 'st', year, studentNo: 'S-9', name: 'Bikash', classId: 'c', status: 'Active', version: 1 });
  const loan = await familyRoute(s, admin, '/api/school/library/issue', { year, accessionNo: 'ACC-1', borrowerNo: 'S-9', days: 7 }, {});
  assert.equal(loan.status, 'Issued');
  await assert.rejects(familyRoute(s, admin, '/api/school/library/issue', { year, accessionNo: 'ACC-1', borrowerNo: 'S-9' }, {}), /already on loan/);
  const back = await familyRoute(s, admin, '/api/school/library/return', { loanId: loan.id }, {});
  assert.equal(back.status, 'Returned'); assert.equal(back.fine, 0);
});

test('year-end promotion moves students up, keeps repeaters and graduates Grade 12', async () => {
  const { previewPromotion, applyPromotion } = await import('../modules/emis/server/school-promotion.mjs');
  const s = fakeStore();
  let profile = { kind: 'school', year, years: [year] };
  s.meta = async () => profile; s.setMeta = async (_, v) => { profile = v; };
  s.validate = async (entity, input) => cleanRecord(entity, input, 'school');
  s.insertRaw = async (entity, value, id) => { const r = { ...value, id, version: 1 }; s.rows[entity].push(r); return r; };
  s.db = { prepare: () => ({ run: async () => {} }) };
  const g6 = await s.save(admin, 'classes', { year, name: 'Grade 6', section: 'A', status: 'Active' });
  const g12 = await s.save(admin, 'classes', { year, name: 'Grade 12', section: 'A', stream: 'Science', status: 'Active' });
  await s.save(admin, 'subjects', { year, classId: g6.id, name: 'Maths', type: 'Compulsory', creditHours: 5, theoryFull: 50 });
  await s.save(admin, 'feeHeads', { year, classId: g6.id, head: 'Tuition', amount: 4500, frequency: 'Monthly', appliesTo: 'All students' });
  const a = await s.save(admin, 'students', { year, studentNo: 'A1', name: 'Asha', classId: g6.id, rollNo: 1, gender: 'Female', status: 'Active' });
  const b = await s.save(admin, 'students', { year, studentNo: 'B1', name: 'Bikash', classId: g6.id, rollNo: 2, gender: 'Male', status: 'Active' });
  await s.save(admin, 'students', { year, studentNo: 'C1', name: 'Chandra', classId: g12.id, rollNo: 1, gender: 'Male', status: 'Active' });
  const body = { sourceYear: year, targetYear: '2027/28', repeat: [b.id], setDefaultYear: true };
  const p = await previewPromotion(s, admin, body);
  assert.deepEqual(p.moves.map((m) => `${m.name}:${m.to}`), ['Asha:Grade 7 A', 'Bikash:Grade 6 A']);
  assert.equal(p.graduates[0].name, 'Chandra');
  const r = await applyPromotion(s, admin, body);
  assert.deepEqual([r.promoted, r.repeated, r.graduated, r.classesCreated, r.subjectsCopied], [1, 1, 1, 2, 1]);
  const next = s.rows.students.filter((x) => x.year === '2027/28');
  assert.equal(next.length, 2);
  assert.equal(s.rows.students.find((x) => x.name === 'Chandra').status, 'Graduated');
  assert.equal(profile.year, '2027/28');
  assert.equal(s.rows.feeHeads.filter((h) => h.year === '2027/28').length, 1);
});
