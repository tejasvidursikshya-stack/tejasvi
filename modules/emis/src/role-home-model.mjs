// Figures for the role dashboards (EMIS home). Pure functions over the
// records the server already scoped to the signed-in member, so every role
// only ever sees numbers built from what it may read.
import { can, invoiceBalance, globalModules } from '../shared/schema.mjs';
import { campusNow } from './dashboard-model.mjs';

const DAY = 86400000;
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sum = (list, f) => list.reduce((s, r) => s + (Number(f(r)) || 0), 0);
const pct = (part, whole) => (whole ? (part / whole) * 100 : null);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const attended = (r) => r.status === 'Present' || r.status === 'Late';

/** Morning / afternoon / evening in Nepal time. */
export function greeting(now = new Date()) {
  const hour = Number(campusNow(now).time.slice(0, 2));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

/** Attendance rate with excused sessions left out, like the institution indicators. */
export function attendanceRate(rows) {
  const counted = rows.filter((r) => r.status !== 'Excused');
  return { rate: pct(counted.filter(attended).length, counted.length), present: counted.filter(attended).length, total: counted.length };
}

export function invoices(ctx) {
  const payments = ctx.rows('payments');
  return ctx.rows('fees').map((r) => ({ ...r, ...invoiceBalance(r, payments) }));
}

/** Unpaid invoices past their due date, oldest first, with days overdue. */
export function overdueInvoices(ctx, now = new Date()) {
  const today = campusNow(now).date;
  return invoices(ctx)
    .filter((r) => r.balance > 0 && r.dueDate && r.dueDate < today)
    .map((r) => ({ ...r, daysOverdue: daysBetween(r.dueDate, today) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Timetable entries for today, earliest first. */
export function todaysClasses(ctx, now = new Date()) {
  const clock = campusNow(now);
  return ctx
    .rows('timetable')
    .filter((t) => t.day === clock.day)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
    .map((t) => {
      const taken = ctx.rows('attendance').some((a) => a.courseId === t.courseId && a.date === clock.date);
      const started = !!t.startTime && t.startTime <= clock.time;
      const ended = !!t.endTime && t.endTime <= clock.time;
      return { ...t, taken, started, ended, needsAttendance: started && !taken };
    });
}

/** Students enrolled on a course: same program and semester, active this year. */
export function courseStudents(ctx, course) {
  return ctx
    .rows('students')
    .filter((s) => s.programId === course.programId && (!s.semester || !course.semester || Number(s.semester) === Number(course.semester)) && s.status !== 'Withdrawn' && s.status !== 'Dropped out');
}

/** Exams that have taken place but still have students without marks. */
export function marksToEnter(ctx, now = new Date()) {
  const today = campusNow(now).date;
  const courses = new Map(ctx.rows('courses').map((c) => [c.id, c]));
  return ctx
    .rows('exams')
    .filter((e) => e.date && e.date <= today && e.status !== 'Published' && courses.has(e.courseId))
    .map((e) => {
      const expected = courseStudents(ctx, courses.get(e.courseId)).length;
      const entered = ctx.rows('results').filter((r) => r.examId === e.id).length;
      return { ...e, expected, entered, remaining: Math.max(0, expected - entered) };
    })
    .filter((e) => e.expected > 0)
    .sort((a, b) => b.remaining - a.remaining || String(a.date).localeCompare(String(b.date)));
}

/** Students a teacher should look at: low attendance, recent absences, marks below pass. */
export function studentsToWatch(ctx, threshold = 75) {
  const exams = new Map(ctx.rows('exams').map((e) => [e.id, e]));
  const out = [];
  for (const s of ctx.rows('students')) {
    const att = ctx.rows('attendance').filter((a) => a.studentId === s.id);
    const { rate, total } = attendanceRate(att);
    const recent = [...att].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
    const below = ctx.rows('results').filter((r) => r.studentId === s.id && exams.get(r.examId) && Number(r.marks) < Number(exams.get(r.examId).passMarks));
    if (total >= 4 && rate !== null && rate < threshold) out.push({ student: s, reason: 'Low attendance', detail: `Attendance ${Math.round(rate)}%`, severity: 2 });
    else if (recent.length === 3 && recent.every((a) => a.status === 'Absent')) out.push({ student: s, reason: 'Absent 3×', detail: 'Absent from the last 3 classes', severity: 2 });
    else if (below.length) {
      const e = exams.get(below[0].examId);
      out.push({ student: s, reason: 'Below pass', detail: `${e.name}: ${below[0].marks} of ${e.maxMarks}`, severity: 1 });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}

/** Upcoming exams from today, soonest first. */
export function upcomingExams(ctx, now = new Date(), limit = 4) {
  const today = campusNow(now).date;
  return ctx
    .rows('exams')
    .filter((e) => e.date && e.date >= today && e.status !== 'Published')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)))
    .slice(0, limit);
}

/** Admin "needs your action" items, most urgent first. Only modules the role can read are counted. */
export function adminActions(ctx, now = new Date()) {
  const role = ctx.user.role, today = campusNow(now).date, out = [];
  if (can(role, 'fees')) {
    const overdue = overdueInvoices(ctx, now);
    if (overdue.length) out.push({ key: 'fees', tone: 'urgent', label: 'Urgent', title: `${overdue.length} fee invoice${overdue.length === 1 ? ' is' : 's are'} overdue`, detail: `NPR ${Math.round(sum(overdue, (r) => r.balance)).toLocaleString('en-IN')} outstanding · oldest ${overdue[0].daysOverdue} days`, cta: 'Review', entity: 'fees' });
  }
  if (can(role, 'admissions')) {
    const n = ctx.rows('admissions').filter((a) => a.status === 'Applied' || a.status === 'Under review').length;
    if (n) out.push({ key: 'admissions', tone: 'urgent', label: 'Decide', title: `${n} application${n === 1 ? '' : 's'} waiting for a decision`, detail: 'Accept, waitlist or reject to keep applicants informed', cta: 'Decide', entity: 'admissions' });
  }
  if (can(role, 'results')) {
    const n = ctx.rows('results').filter((r) => r.status === 'Draft').length;
    if (n) out.push({ key: 'results', tone: 'today', label: 'Review', title: `${n} draft result${n === 1 ? '' : 's'} to review`, detail: 'Check marks before they are published to students', cta: 'Review', entity: 'results' });
  }
  if (can(role, 'evidence')) {
    const missing = ctx.rows('evidence').filter((e) => e.status === 'Missing').length;
    if (missing) out.push({ key: 'evidence', tone: 'week', label: 'This term', title: `${missing} QAA evidence item${missing === 1 ? '' : 's'} missing`, detail: 'Assign an owner and a review date', cta: 'Assign', entity: 'evidence' });
  }
  if (can(role, 'actions')) {
    const late = ctx.rows('actions').filter((a) => a.status !== 'Completed' && a.deadline && a.deadline < today).length;
    if (late) out.push({ key: 'actions', tone: 'week', label: 'Overdue', title: `${late} improvement action${late === 1 ? '' : 's'} past deadline`, detail: 'IQAC action plan', cta: 'Open', entity: 'actions' });
  }
  if (can(role, 'grievances')) {
    const old = ctx.rows('grievances').filter((g) => !['Resolved', 'Closed'].includes(g.status) && g.date && daysBetween(g.date, today) > 7).length;
    if (old) out.push({ key: 'grievances', tone: 'follow', label: 'Follow up', title: `${old} support request${old === 1 ? '' : 's'} open longer than 7 days`, detail: 'Student Affairs', cta: 'Open', entity: 'grievances' });
  }
  return out;
}

/** Student counts per program for the selected year, largest first. */
export function studentsByProgram(ctx, limit = 6) {
  const students = ctx.rows('students').filter((s) => s.status === 'Active' || !s.status);
  return ctx
    .rows('programs')
    .map((p) => ({ program: p, count: students.filter((s) => s.programId === p.id).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Received payments per month for the last n months (Nepal time). */
export function collectionByMonth(ctx, months = 6, now = new Date()) {
  const anchor = campusNow(now).date.slice(0, 7);
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      amount: sum(ctx.rows('payments').filter((p) => String(p.date || '').startsWith(key)), (p) => p.amount),
    };
  });
}

/** Paid share of invoiced fees per program (for finance). */
export function collectionByProgram(ctx) {
  const students = new Map(ctx.rows('students').map((s) => [s.id, s]));
  const byProgram = new Map();
  for (const inv of invoices(ctx)) {
    const programId = students.get(inv.studentId)?.programId;
    if (!programId) continue;
    const row = byProgram.get(programId) || { invoiced: 0, paid: 0 };
    row.invoiced += Number(inv.amount) || 0;
    row.paid += Math.min(Number(inv.amount) || 0, inv.paid);
    byProgram.set(programId, row);
  }
  return [...byProgram.entries()]
    .map(([programId, r]) => ({ programId, rate: pct(r.paid, r.invoiced), ...r }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

export function financeSummary(ctx, now = new Date()) {
  const today = campusNow(now).date, soon = addDays(today, 14), all = invoices(ctx), overdue = overdueInvoices(ctx, now);
  const income = sum(ctx.rows('transactions').filter((t) => t.type === 'Income'), (t) => t.amount) + sum(ctx.rows('payments'), (p) => p.amount);
  const expense = sum(ctx.rows('transactions').filter((t) => t.type === 'Expenditure'), (t) => t.amount);
  const dueSoon = all.filter((r) => r.balance > 0 && r.dueDate && r.dueDate >= today && r.dueDate <= soon);
  const scholarships = ctx.rows('scholarships');
  return {
    invoiced: sum(all, (r) => r.amount),
    collected: sum(ctx.rows('payments'), (p) => p.amount),
    overdue,
    overdueAmount: sum(overdue, (r) => r.balance),
    overdueStudents: new Set(overdue.map((r) => r.studentId)).size,
    dueSoon,
    dueSoonAmount: sum(dueSoon, (r) => r.balance),
    income,
    expense,
    net: income - expense,
    scholarshipAmount: sum(scholarships, (s) => s.amount),
    scholarshipStudents: new Set(scholarships.map((s) => s.studentId)).size,
    renewalsDue: scholarships.filter((s) => s.status === 'Renewal due').length,
    todaysPayments: ctx.rows('payments').filter((p) => p.date === today),
  };
}

/** The signed-in student's own picture. */
export function studentSummary(ctx, now = new Date()) {
  const today = campusNow(now).date, monthEnd = addDays(today, 31);
  const exams = new Map(ctx.rows('exams').map((e) => [e.id, e]));
  const published = ctx.rows('results').filter((r) => r.status === 'Published').sort((a, b) => String(exams.get(b.examId)?.date).localeCompare(String(exams.get(a.examId)?.date)));
  const points = published.map((r) => Number(r.gradePoint)).filter((g) => Number.isFinite(g) && g > 0);
  const percents = published.map((r) => { const e = exams.get(r.examId); return e?.maxMarks ? (Number(r.marks) / Number(e.maxMarks)) * 100 : null; }).filter((x) => x !== null);
  const unpaid = invoices(ctx).filter((r) => r.balance > 0).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  const byCourse = ctx.rows('courses').map((c) => ({ course: c, ...attendanceRate(ctx.rows('attendance').filter((a) => a.courseId === c.id)) })).filter((x) => x.total > 0);
  return {
    attendance: attendanceRate(ctx.rows('attendance')),
    byCourse,
    gpa: points.length ? sum(points, (g) => g) / points.length : null,
    average: percents.length ? sum(percents, (p) => p) / percents.length : null,
    published,
    nextFee: unpaid[0] || null,
    balance: sum(unpaid, (r) => r.balance),
    paid: sum(ctx.rows('payments'), (p) => p.amount),
    examsSoon: ctx.rows('exams').filter((e) => e.date && e.date >= today && e.date <= monthEnd && e.status !== 'Published').sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
}

/** What a staff role's home focuses on: its own modules, in order. */
export const staffFocus = {
  'Exam Coordinator': ['exams', 'results', 'courses', 'students'],
  'Academic Coordinator': ['courses', 'timetable', 'attendance', 'programs'],
  'Program Director': ['students', 'courses', 'results', 'attendance'],
  'HR/Admin': ['faculty', 'staff', 'development', 'facilities'],
  'Research Head': ['research', 'publications', 'outreach', 'partnerships'],
  Library: ['library', 'students'],
  'Student Affairs': ['enquiries', 'admissions', 'grievances', 'services'],
  'Alumni Coordinator': ['alumni', 'placements', 'partnerships', 'feedback'],
  'IT Officer': ['facilities', 'library'],
};

/** Count records in a module for the year, with a short status line where one helps. */
export function moduleCount(ctx, entity, now = new Date()) {
  const rows = ctx.rows(entity), today = campusNow(now).date;
  const open = (statuses) => rows.filter((r) => statuses.includes(r.status)).length;
  const lines = {
    exams: () => `${rows.filter((e) => e.date >= today && e.status !== 'Published').length} upcoming`,
    results: () => `${open(['Draft'])} draft · ${open(['Published'])} published`,
    admissions: () => `${open(['Applied', 'Under review'])} awaiting a decision`,
    enquiries: () => `${rows.filter((e) => e.followUp && e.followUp <= today && !['Applied', 'Closed'].includes(e.status)).length} follow-ups due`,
    grievances: () => `${rows.filter((g) => !['Resolved', 'Closed'].includes(g.status)).length} open`,
    faculty: () => `${open(['Active'])} active`,
    staff: () => `${open(['Active'])} active`,
    students: () => `${open(['Active'])} active`,
    library: () => `${open(['On loan'])} on loan`,
    facilities: () => `${open(['Maintenance'])} in maintenance`,
    research: () => `${open(['In progress'])} in progress`,
    placements: () => `${open(['Offered', 'In progress'])} active`,
    courses: () => `${open(['Active'])} active`,
    timetable: () => `${rows.filter((t) => t.day === days[new Date(Date.parse(`${today}T12:00:00Z`)).getUTCDay()]).length} classes today`,
    attendance: () => { const r = attendanceRate(rows).rate; return r === null ? 'Nothing recorded yet' : `${Math.round(r)}% attended`; },
  };
  return { entity, count: rows.length, line: lines[entity] ? lines[entity]() : globalModules.includes(entity) ? 'All years' : `In ${ctx.year}` };
}
