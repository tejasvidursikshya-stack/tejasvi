import { campusNow } from './dashboard-model.mjs';

export const GENDERS = ['Female', 'Male', 'Other', 'Not disclosed'];
export const ETHNICITIES = ['Dalit', 'Janajati', 'Madhesi', 'Muslim', 'Brahmin / Chhetri', 'Other', 'Not disclosed'];
export const UNASSIGNED_SECTION = '__unassigned_section__';
const text = value => String(value ?? '').trim();
const money = value => Math.round((Number(value) || 0) * 100);
const genderOf = row => GENDERS.includes(row.gender) ? row.gender : 'Not disclosed';
const ethnicityOf = row => ETHNICITIES.includes(row.ethnicity) ? row.ethnicity : 'Not disclosed';
export const emptyDashboardFilters = year => ({ year, batch: '', programId: '', semester: '', section: '' });

export function matchingStudent(row, filters, includeYear = true) {
  return (!includeYear || row.year === filters.year)
    && (!filters.batch || text(row.batch) === filters.batch)
    && (!filters.programId || row.programId === filters.programId)
    && (!filters.semester || String(row.semester) === filters.semester)
    && (!filters.section || (filters.section === UNASSIGNED_SECTION ? !text(row.section) : text(row.section) === filters.section));
}

export function dashboardFilterOptions(records, year) {
  const students = (records.students || []).filter(s => s.year === year);
  const unique = key => [...new Set(students.map(s => text(s[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { batches: unique('batch'), semesters: unique('semester'), sections: unique('section'), unassignedSection: students.some(s => !text(s.section)) };
}

const genderColors = ['#df448b', '#4d73de', '#24a6b9', '#8795aa'];
export const genderSeries = GENDERS.map((label, index) => ({ key: label, label, color: genderColors[index] }));
const ethnicityColors = [
  ['#f0be50', '#b87a13', '#d9a22b', '#f7dc91'],
  ['#70d4bb', '#158977', '#3baf99', '#a5e5d5'],
  ['#ffb29f', '#d65348', '#e98573', '#ffd3c7'],
  ['#c1a4eb', '#7658b0', '#9977cc', '#dbc9f3'],
  ['#a1adef', '#4d73de', '#758fe5', '#c8d0f8'],
  ['#ed9ac2', '#bc4f92', '#d67caf', '#f5c6de'],
  ['#b6c0d0', '#73829c', '#96a3b8', '#d6dde8']
];

function makeSeries(students, breakdown) {
  if (breakdown === 'gender') return genderSeries;
  if (breakdown === 'ethnicity') return ETHNICITIES.filter(label => students.some(s => ethnicityOf(s) === label)).map(label => ({ key: label, label, color: ethnicityColors[ETHNICITIES.indexOf(label)][1] }));
  return ETHNICITIES.flatMap((ethnicity, ei) => GENDERS.flatMap((gender, gi) => students.some(s => ethnicityOf(s) === ethnicity && genderOf(s) === gender) ? [{ key: `${ethnicity}|${gender}`, label: `${ethnicity} · ${gender}`, color: ethnicityColors[ei][gi] }] : []));
}

function categories(programs, students, programId) {
  const rows = programs.filter(p => !programId || p.id === programId).map(p => ({ key: p.id, label: p.code || p.name, name: p.name, departmentId: p.departmentId }));
  for (const student of students) if (!rows.some(p => p.key === student.programId)) rows.push({ key: student.programId || '', label: 'Unassigned program', name: 'Program record unavailable', departmentId: '' });
  return rows;
}
function countGroups(groups, students, keyOf, series, seriesKey) {
  return groups.map(group => {
    const members = students.filter(student => keyOf(student) === group.key);
    return { ...group, total: members.length, values: Object.fromEntries(series.map(s => [s.key, members.filter(row => seriesKey(row) === s.key).length])) };
  });
}

/** All figures use saved enrollment/invoice records. No institution-wide data is fetched here. */
export function superAdminInsights(records, filters, breakdown = 'ethnicity-gender', now = new Date()) {
  const allStudents = records.students || [], programs = records.programs || [], departments = records.departments || [];
  const students = allStudents.filter(s => matchingStudent(s, filters)), ids = new Set(students.map(s => s.id));
  const groups = categories(programs, students, filters.programId), series = makeSeries(students, breakdown);
  const seriesKey = row => breakdown === 'gender' ? genderOf(row) : breakdown === 'ethnicity' ? ethnicityOf(row) : `${ethnicityOf(row)}|${genderOf(row)}`;
  const enrollment = countGroups(groups, students, s => s.programId || '', series, seriesKey);
  const dropouts = students.filter(s => s.status === 'Dropped out');
  const programGender = countGroups(groups, students, s => s.programId || '', genderSeries, genderOf);
  const dropoutGender = countGroups(groups, dropouts, s => s.programId || '', genderSeries, genderOf);
  const programMap = new Map(programs.map(p => [p.id, p]));
  const departmentOf = student => programMap.get(student.programId)?.departmentId || '';
  const departmentIds = [...new Set(groups.map(g => g.departmentId || ''))];
  const faculties = departmentIds.map(id => { const department = departments.find(d => d.id === id); return { key: id, label: department?.name || 'Unassigned faculty', name: department?.name || 'Unassigned faculty' }; });
  const facultyGender = countGroups(faculties, students, departmentOf, genderSeries, genderOf);

  const paid = new Map();
  for (const payment of records.payments || []) if (payment.year === filters.year) paid.set(payment.invoiceId, (paid.get(payment.invoiceId) || 0) + money(payment.amount));
  const byId = new Map(students.map(s => [s.id, s]));
  const invoices = (records.fees || []).filter(f => f.year === filters.year && ids.has(f.studentId)).map(invoice => ({ ...invoice, student: byId.get(invoice.studentId), balanceCents: Math.max(0, money(invoice.amount) - (paid.get(invoice.id) || 0)) })).filter(f => f.balanceCents > 0).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) || String(a.invoiceNo || a.id).localeCompare(String(b.invoiceNo || b.id)));
  const today = campusNow(now).date, overdue = invoices.filter(invoice => invoice.dueDate && invoice.dueDate < today);

  const end = Number(filters.year.slice(0, 4));
  const history = Array.from({ length: 5 }, (_, index) => {
    const start = end - 4 + index, year = `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
    const saved = allStudents.filter(s => s.year === year), cohort = saved.filter(s => matchingStudent(s, filters, false));
    return { key: year, label: year, recorded: saved.length > 0, enrollment: saved.length ? cohort.length : null, dropouts: saved.length ? cohort.filter(s => s.status === 'Dropped out').length : null };
  });
  return {
    students: students.length, active: students.filter(s => s.status === 'Active').length, dropouts: dropouts.length,
    enrollment, enrollmentSeries: series, programGender, dropoutGender, facultyGender, history,
    invoices, outstanding: invoices.reduce((total, f) => total + f.balanceCents, 0) / 100,
    overdue: overdue.reduce((total, f) => total + f.balanceCents, 0) / 100, overdueCount: overdue.length,
    debtors: new Set(invoices.map(f => f.studentId)).size,
    sectionMissing: students.filter(s => !text(s.section)).length
  };
}
