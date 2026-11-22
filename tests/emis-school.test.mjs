import test from 'node:test';
import assert from 'node:assert/strict';
import { band, subjectResult, gpaOf, gradeSheets, billFor, attendanceSummary, GRADING } from '../modules/emis/shared/school.mjs';
import { specFor, cleanRecord, scopeRecord } from '../modules/emis/shared/schema.mjs';

const maths = { id: 'm', name: 'Mathematics', creditHours: 5, theoryFull: 75, practicalFull: 25 };
const nepali = { id: 'n', name: 'Nepali', creditHours: 4, theoryFull: 100, practicalFull: 0 };

test('letter grade bands follow the 2078 directive', () => {
  assert.deepEqual([90, 89.99, 80, 70, 60, 50, 40, 35, 34.9].map((p) => band(p).grade), ['A+', 'A', 'A', 'B+', 'B', 'C+', 'C', 'D', 'NG']);
  assert.equal(band(85).gp, 3.6);
});

test('a subject is NG when theory or internal falls below the minimum', () => {
  const ok = subjectResult(maths, { theory: 60, practical: 20 });
  assert.equal(ok.percent, 80); assert.equal(ok.grade, 'A'); assert.equal(ok.ng, false);
  const lowTheory = subjectResult(maths, { theory: 20, practical: 25 }); // 26.7% theory
  assert.equal(lowTheory.grade, 'NG'); assert.equal(lowTheory.theoryGrade, 'NG');
  const lowInternal = subjectResult(maths, { theory: 75, practical: 9 }); // 36% internal < 40
  assert.equal(lowInternal.grade, 'NG'); assert.equal(GRADING.internalMin, 40);
  assert.equal(subjectResult(maths, { absent: 'Yes' }).grade, 'NG');
  assert.equal(subjectResult(nepali, { theory: 35 }).grade, 'D');
  assert.equal(subjectResult(nepali, undefined).entered, false);
});

test('GPA is credit-weighted and withheld when a subject is NG or missing', () => {
  const a = subjectResult(maths, { theory: 70, practical: 22 }); // 92 → A+ 4.0
  const b = subjectResult(nepali, { theory: 65 });                 // 65 → B 2.8
  const g = gpaOf([a, b]);
  assert.equal(g.gpa, Math.round(((4 * 5 + 2.8 * 4) / 9) * 100) / 100); assert.equal(g.grade, 'A');
  assert.equal(gpaOf([a, subjectResult(nepali, { theory: 10 })]).gpa, null);
  assert.equal(gpaOf([a, subjectResult(nepali, undefined)]).gpa, null);
  assert.equal(gpaOf([a, b, subjectResult({ ...nepali, id: 'x', type: 'Additional' }, { theory: 5 })]).gpa, g.gpa); // additional subject ignored
});

test('grade sheets rank students and share ranks on ties', () => {
  const y = '2026/27', base = { year: y, status: 'Active', classId: 'c' };
  const records = {
    students: [{ ...base, id: 's1', name: 'Asha', rollNo: 1 }, { ...base, id: 's2', name: 'Bikash', rollNo: 2 }, { ...base, id: 's3', name: 'Chandra', rollNo: 3 }],
    subjects: [{ ...nepali, year: y, classId: 'c', type: 'Compulsory' }], terms: [{ id: 't', year: y, name: 'First Terminal' }], schoolAttendance: [],
    marks: [{ studentId: 's1', termId: 't', subjectId: 'n', theory: 90 }, { studentId: 's2', termId: 't', subjectId: 'n', theory: 90 }, { studentId: 's3', termId: 't', subjectId: 'n', theory: 70 }],
  };
  const { sheets } = gradeSheets(records, { classId: 'c', termId: 't', year: y });
  assert.deepEqual(sheets.map((x) => x.rank), [1, 1, 3]);
});

test('monthly bill applies class heads, bus users and a tuition scholarship', () => {
  const heads = [
    { id: 'h1', head: 'Tuition', amount: 3000, frequency: 'Monthly', appliesTo: 'All students', classId: 'c' },
    { id: 'h2', head: 'Transport', amount: 1200, frequency: 'Monthly', appliesTo: 'School bus users' },
    { id: 'h3', head: 'Examination', amount: 500, frequency: 'Each terminal', appliesTo: 'All students' },
    { id: 'h4', head: 'Tuition', amount: 9999, frequency: 'Monthly', appliesTo: 'All students', classId: 'other' },
  ];
  const s = { id: 's', classId: 'c', transport: 'School bus' };
  const bill = billFor(s, heads, [{ studentId: 's', status: 'Approved', percentage: 50, category: 'Merit' }], { month: 'Baishakh', includeOccasional: ['h3'] });
  assert.deepEqual(bill.lines.map((l) => l.head), ['Tuition', 'Transport', 'Examination']);
  assert.equal(bill.gross, 4700); assert.equal(bill.discount, 1500); assert.equal(bill.total, 3200);
  assert.equal(billFor({ ...s, transport: 'Walk' }, heads, [], { month: 'Jestha' }).total, 3000);
});

test('attendance summary counts late as present', () => {
  const rows = [{ studentId: 's', status: 'Present', date: '2026-05-01' }, { studentId: 's', status: 'Late', date: '2026-05-02' }, { studentId: 's', status: 'Absent', date: '2026-05-03' }, { studentId: 's', status: 'Leave', date: '2026-05-04' }];
  assert.deepEqual(attendanceSummary(rows, 's'), { days: 4, present: 2, absent: 1, leave: 1, rate: 50 });
});

test('school and college student forms differ', () => {
  const school = specFor('students', 'school').fields.map((f) => f.key), college = specFor('students', 'college').fields.map((f) => f.key);
  assert.ok(school.includes('classId') && school.includes('rollNo') && !school.includes('programId'));
  assert.ok(college.includes('programId') && !college.includes('classId'));
  assert.throws(() => cleanRecord('courses', { year: '2026/27' }, 'school'), /colleges/);
  assert.throws(() => cleanRecord('students', { year: '2026/27', studentNo: '1', name: 'A', gender: 'Female', status: 'Active' }, 'school'), /Class & section is required/);
});

test('teachers see only the classes they teach or look after', () => {
  const records = { classes: [{ id: 'c1', classTeacherId: 'f1' }, { id: 'c2' }, { id: 'c3' }], subjects: [{ id: 'x', classId: 'c2', teacherId: 'f1' }, { id: 'y', classId: 'c3', teacherId: 'f2' }] };
  const user = { role: 'Faculty', facultyId: 'f1' };
  assert.equal(scopeRecord(user, 'classes', { id: 'c1' }, records), true);
  assert.equal(scopeRecord(user, 'classes', { id: 'c2' }, records), true);
  assert.equal(scopeRecord(user, 'classes', { id: 'c3' }, records), false);
  assert.equal(scopeRecord(user, 'marks', { subjectId: 'x' }, records, true), true);
  assert.equal(scopeRecord(user, 'marks', { subjectId: 'y' }, records, true), false);
});
