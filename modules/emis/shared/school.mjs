// School-only rules shared by the server, the web app and tests: Nepal letter grading,
// grade sheets, attendance summaries and monthly billing. Pure functions, no I/O.
import { CLASS_NAMES } from './schema.mjs';

/**
 * Letter grading, following the Letter Grading Directive 2078 (grades 1–12).
 * Sources disagree on the internal-assessment threshold; both minimums live here so a
 * school can be updated in one place when the Ministry issues a new circular.
 */
export const GRADING = {
  theoryMin: 35,      // below this percentage in theory, the subject is NG
  internalMin: 40,    // below this percentage in practical / internal assessment, the subject is NG
  bands: [
    { min: 90, grade: 'A+', gp: 4.0, remark: 'Outstanding' },
    { min: 80, grade: 'A', gp: 3.6, remark: 'Excellent' },
    { min: 70, grade: 'B+', gp: 3.2, remark: 'Very good' },
    { min: 60, grade: 'B', gp: 2.8, remark: 'Good' },
    { min: 50, grade: 'C+', gp: 2.4, remark: 'Satisfactory' },
    { min: 40, grade: 'C', gp: 2.0, remark: 'Acceptable' },
    { min: 35, grade: 'D', gp: 1.6, remark: 'Basic' },
  ],
};
const NG = { grade: 'NG', gp: 0, remark: 'Not graded' };

export const MONTHS_BS = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

export const round2 = (n) => Math.round(n * 100) / 100;
export function band(percent) {
  if (!Number.isFinite(percent)) return NG;
  return GRADING.bands.find((b) => percent >= b.min) || NG;
}

/** One subject's result from its marks row. Missing marks are treated as not yet entered. */
export function subjectResult(subject, mark) {
  const theoryFull = Number(subject.theoryFull) || 0, practicalFull = Number(subject.practicalFull) || 0;
  const full = theoryFull + practicalFull;
  if (!mark || (mark.theory === undefined && mark.practical === undefined && mark.absent !== 'Yes'))
    return { subjectId: subject.id, name: subject.name, creditHours: Number(subject.creditHours) || 0, full, entered: false, additional: subject.type === 'Additional' };
  const absent = mark.absent === 'Yes';
  const theory = absent ? 0 : Number(mark.theory) || 0, practical = absent ? 0 : Number(mark.practical) || 0;
  const theoryPct = theoryFull ? (theory / theoryFull) * 100 : 100;
  const practicalPct = practicalFull ? (practical / practicalFull) * 100 : 100;
  const total = theory + practical, percent = full ? (total / full) * 100 : 0;
  const failedPart = absent || theoryPct < GRADING.theoryMin || (practicalFull > 0 && practicalPct < GRADING.internalMin);
  const theoryGrade = theoryFull ? (theoryPct < GRADING.theoryMin ? NG : band(theoryPct)) : null;
  const practicalGrade = practicalFull ? (practicalPct < GRADING.internalMin ? NG : band(practicalPct)) : null;
  const final = failedPart ? NG : band(percent);
  return {
    subjectId: subject.id, name: subject.name, creditHours: Number(subject.creditHours) || 0, full, entered: true, absent, additional: subject.type === 'Additional',
    theory, practical, theoryFull, practicalFull, total, percent: round2(percent),
    theoryGrade: theoryGrade?.grade || null, practicalGrade: practicalGrade?.grade || null,
    grade: final.grade, gp: final.gp, remark: final.remark, ng: final.grade === 'NG',
  };
}

/** Credit-weighted GPA. A GPA is only awarded when every subject is graded (no NG, nothing missing). */
export function gpaOf(all) {
  // Additional subjects appear on the grade sheet but do not count towards GPA.
  const results = all.filter((r) => !r.additional);
  const entered = results.filter((r) => r.entered);
  const credits = entered.reduce((s, r) => s + r.creditHours, 0);
  const complete = entered.length === results.length && results.length > 0;
  const anyNg = entered.some((r) => r.ng);
  const raw = credits ? entered.reduce((s, r) => s + r.gp * r.creditHours, 0) / credits : 0;
  const totalMarks = entered.reduce((s, r) => s + r.total, 0), fullMarks = entered.reduce((s, r) => s + r.full, 0);
  return {
    gpa: complete && !anyNg ? round2(raw) : null,
    grade: complete && !anyNg ? gpaGrade(raw) : anyNg ? 'NG' : null,
    complete, anyNg, totalMarks: round2(totalMarks), fullMarks, percent: fullMarks ? round2((totalMarks / fullMarks) * 100) : 0,
  };
}
// Overall grade from GPA: 3.6–4.0 A+, 3.2–<3.6 A, 2.8–<3.2 B+, 2.4–<2.8 B, 2.0–<2.4 C+, 1.6–<2.0 C, below D.
export const GPA_BANDS = [[3.6, 'A+'], [3.2, 'A'], [2.8, 'B+'], [2.4, 'B'], [2.0, 'C+'], [1.6, 'C'], [0, 'D']];
export const gpaGrade = (gpa) => GPA_BANDS.find(([min]) => gpa >= min - 1e-9)[1];

export const classLabel = (c) => (c ? [c.name, c.section].filter(Boolean).join(' · ') + (c.stream ? ` (${c.stream})` : '') : 'No class');
export const classOrder = (c) => { const i = CLASS_NAMES.indexOf(c?.name); return (i < 0 ? 99 : i) * 100 + (c?.section || '').charCodeAt(0); };
export const sortClasses = (list) => [...list].sort((a, b) => classOrder(a) - classOrder(b));
export const rollSort = (a, b) => (Number(a.rollNo) || 9999) - (Number(b.rollNo) || 9999) || String(a.name).localeCompare(String(b.name));

/** Students of a class (active only), ordered by roll number. */
export function classStudents(records, classId, year) {
  return (records.students || []).filter((s) => s.classId === classId && s.year === year && s.status === 'Active').sort(rollSort);
}

/** Days present / total school days for a student, from the daily register. */
export function attendanceSummary(rows, studentId, from = null, to = null) {
  const mine = rows.filter((r) => r.studentId === studentId && (!from || r.date >= from) && (!to || r.date <= to));
  const present = mine.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  return { days: mine.length, present, absent: mine.filter((r) => r.status === 'Absent').length, leave: mine.filter((r) => r.status === 'Leave').length, rate: mine.length ? Math.round((present / mine.length) * 100) : null };
}

/** Grade sheets for every student in a class for one examination, with class rank. */
export function gradeSheets(records, { classId, termId, year, publishedOnly = false }) {
  const subjects = (records.subjects || []).filter((x) => x.classId === classId && x.year === year)
    .sort((a, b) => (a.type === 'Compulsory' ? 0 : 1) - (b.type === 'Compulsory' ? 0 : 1) || a.name.localeCompare(b.name));
  const marks = (records.marks || []).filter((m) => m.termId === termId && (!publishedOnly || m.status === 'Published'));
  const term = (records.terms || []).find((t) => t.id === termId);
  const sheets = classStudents(records, classId, year).map((st) => {
    const rows = subjects.map((sub) => subjectResult(sub, marks.find((m) => m.studentId === st.id && m.subjectId === sub.id)));
    return { student: st, results: rows, summary: gpaOf(rows), attendance: attendanceSummary((records.schoolAttendance || []).filter((a) => a.year === year), st.id, null, term?.resultDate || null) };
  });
  // Rank by GPA, then percentage, among students with a full graded result.
  const ranked = sheets.filter((x) => x.summary.gpa !== null).sort((a, b) => b.summary.gpa - a.summary.gpa || b.summary.percent - a.summary.percent);
  let last = null, rank = 0;
  ranked.forEach((x, i) => { const key = x.summary.gpa + '|' + x.summary.percent; if (key !== last) rank = i + 1; last = key; x.rank = rank; });
  return { subjects, term, sheets };
}

const MONTHLY = { Monthly: 1 };
/** Which fee heads apply to a student, and the bill for one month. */
export function billFor(student, heads, scholarships, { month, includeOccasional = [], siblingRank = 0, siblingPct = 0, staffChildPct = 0, overdue = [], lateFine = 0 }) {
  const usesBus = student.transport === 'School bus';
  const lines = heads.filter((h) => (!h.classId || h.classId === student.classId)
      && (h.frequency in MONTHLY || includeOccasional.includes(h.id))
      && (h.appliesTo === 'All students' || (h.appliesTo === 'School bus users' && usesBus)
        || (h.appliesTo === 'Lunch users' && student.lunch === 'Yes') || (h.appliesTo === 'Hostel students' && student.hostel === 'Yes')))
    .map((h) => ({ headId: h.id, head: h.head, amount: Number(h.amount) || 0 }));
  // A late fine for each earlier bill still unpaid after its due date (charged once per bill).
  if (lateFine > 0) for (const inv of overdue) lines.push({ head: 'Late fine', amount: lateFine, forInvoiceId: inv.id, note: inv.invoiceNo });
  const gross = lines.reduce((s, l) => s + l.amount, 0);
  // Tuition discounts do not stack: the student gets the largest one that applies.
  const award = (scholarships || []).find((x) => x.studentId === student.id && ['Approved', 'Disbursed'].includes(x.status) && Number(x.percentage) > 0);
  const options = [
    award && { pct: Number(award.percentage), note: `${award.category} scholarship ${award.percentage}% of tuition` },
    siblingRank > 0 && siblingPct > 0 && { pct: siblingPct, note: `Sibling discount ${siblingPct}% of tuition` },
    student.staffChild === 'Yes' && staffChildPct > 0 && { pct: staffChildPct, note: `Staff child discount ${staffChildPct}% of tuition` },
  ].filter(Boolean).sort((a, b) => b.pct - a.pct);
  const best = options[0];
  const tuition = lines.filter((l) => l.head === 'Tuition').reduce((s, l) => s + l.amount, 0);
  const discount = best ? Math.round((tuition * Math.min(100, best.pct)) / 100) : 0;
  return { studentId: student.id, month, lines, gross, discount, discountNote: best && discount ? best.note : '', total: Math.max(0, gross - discount) };
}
export const billingKey = (year, month) => `${year} ${month}`;

/** Nepal Social Security Fund: 11% from the employee, 20% from the employer, on basic salary. */
export const SSF = { employee: 0.11, employer: 0.2 };
export function payslipFor(structure, { unpaidDays = 0, monthDays = 30 } = {}) {
  const n = (k) => Math.max(0, Number(structure[k]) || 0);
  const basic = n('basic'), allowances = n('allowances'), ssf = structure.ssf === 'Yes';
  const ssfEmployee = ssf ? Math.round(basic * SSF.employee) : 0, ssfEmployer = ssf ? Math.round(basic * SSF.employer) : 0;
  const cit = n('cit'), tds = n('tds'), otherDeductions = n('otherDeductions');
  // Unpaid days (absence without approved leave, or unpaid leave) are deducted pro rata from basic salary.
  const absenceDeduction = unpaidDays > 0 && monthDays > 0 ? Math.round((basic / monthDays) * unpaidDays) : 0;
  return { basic, allowances, ssfEmployee, ssfEmployer, cit, tds, otherDeductions, unpaidDays, absenceDeduction, net: Math.max(0, basic + allowances - ssfEmployee - cit - tds - otherDeductions - absenceDeduction) };
}
/** Library fine for an overdue loan, per calendar day late. */
export function loanFine(loan, onDate, perDay = 5) {
  if (!loan.dueDate || onDate <= loan.dueDate) return 0;
  const late = Math.round((Date.parse(onDate) - Date.parse(loan.dueDate)) / 864e5);
  return Math.max(0, late) * perDay;
}
/** Nepal mobile numbers (97/98 + 8 digits) in the 10-digit form SMS gateways expect, or null. */
export function smsPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '').replace(/^977/, '');
  return /^9[78]\d{8}$/.test(d) ? d : null;
}
/** Students' counts for the government school census (Flash I): by class, sex, caste/ethnicity and disability. */
export function flashCounts(records, year) {
  const students = (records.students || []).filter((s) => s.year === year && s.status === 'Active');
  const classes = sortClasses((records.classes || []).filter((c) => c.year === year));
  const byClass = new Map();
  for (const c of classes) { const key = c.name; if (!byClass.has(key)) byClass.set(key, { className: key, girls: 0, boys: 0, other: 0, total: 0, dalit: 0, janajati: 0, disability: 0 }); }
  for (const s of students) {
    const c = classes.find((x) => x.id === s.classId), row = c && byClass.get(c.name);
    if (!row) continue;
    row.total++; if (s.gender === 'Female') row.girls++; else if (s.gender === 'Male') row.boys++; else row.other++;
    if (s.ethnicity === 'Dalit') row.dalit++; if (s.ethnicity === 'Janajati') row.janajati++;
    if (s.disability && !['None', 'Not disclosed'].includes(s.disability)) row.disability++;
  }
  const teachers = (records.faculty || []).filter((f) => f.status === 'Active');
  return { rows: [...byClass.values()], teachers: { total: teachers.length, female: teachers.filter((t) => t.gender === 'Female').length, male: teachers.filter((t) => t.gender === 'Male').length } };
}
