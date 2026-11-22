import { can, calculateIndicators, invoiceBalance, modules } from '../shared/schema.mjs';

export const number = value => new Intl.NumberFormat('en-NP', { maximumFractionDigits: 2 }).format(Number(value) || 0);
export const amount = value => `NPR ${number(value)}`;
export const percentage = value => value == null ? '—' : `${value.toFixed(1)}%`;
export function campusNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, day: parts.weekday };
}
export function dateLabel(value) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kathmandu' }) : 'No date';
}
export function upcomingClasses(entries, current = true, now = new Date()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], clock = campusNow(now), day = days.indexOf(clock.day);
  return entries.filter(r => days.includes(r.day)).map(r => {
    let offset = (days.indexOf(r.day) - day + 7) % 7;
    if (offset === 0 && (r.endTime || r.startTime || '') <= clock.time) offset = 7;
    return { ...r, offset, when: current ? offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : r.day : r.day };
  }).sort((a, b) => (current ? a.offset - b.offset : days.indexOf(a.day) - days.indexOf(b.day)) || String(a.startTime).localeCompare(String(b.startTime))).slice(0, 4);
}
export function cashSeries(payments, transactions, months = 6, now = new Date()) {
  const clock = campusNow(now), anchor = new Date(`${clock.date.slice(0, 7)}-01T00:00:00Z`);
  const points = Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - months + 1 + i, 1));
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), income: 0, expense: 0, count: 0 };
  });
  // Integer cents keep chart totals consistent with the finance registers.
  for (const row of [...payments.map(p => ({ ...p, type: 'Income' })), ...transactions]) {
    const point = points.find(p => p.key === String(row.date || '').slice(0, 7));
    if (point && ['Income', 'Expenditure'].includes(row.type) && Number.isFinite(Number(row.amount))) { point[row.type === 'Income' ? 'income' : 'expense'] += Math.round(Number(row.amount) * 100); point.count++; }
  }
  return points.map(p => ({ ...p, income: p.income / 100, expense: p.expense / 100 }));
}
export function feeSummary(ctx, now = new Date()) {
  const invoices = ctx.rows('fees').map(r => ({ ...r, ...invoiceBalance(r, ctx.rows('payments')) }));
  const overdue = invoices.filter(r => r.balance > 0 && r.dueDate && r.dueDate < campusNow(now).date);
  return { invoices, overdue, balance: invoices.reduce((sum, r) => sum + Math.round(r.balance * 100), 0) / 100 };
}
// Personal learning follows the semester on the selected year's enrollment.
// Attendance, invoices and published results retain their full year history.
export function learningRows(ctx, entity) {
  if (ctx.user.role !== 'Student' || !['courses', 'timetable', 'exams'].includes(entity)) return ctx.rows(entity);
  const enrollments = ctx.rows('students');
  if (!enrollments.length) return ctx.rows(entity);
  const courses = ctx.rows('courses').filter(c => enrollments.some(s => s.programId === c.programId && (!s.semester || Number(s.semester) === Number(c.semester))));
  return entity === 'courses' ? courses : ctx.rows(entity).filter(r => courses.some(c => c.id === r.courseId));
}
export function dashboardMetrics(ctx) {
  const m = calculateIndicators(ctx.records, ctx.year), role = ctx.user.role, fees = feeSummary(ctx);
  const attendance = ['attendance', 'Attendance', percentage(m.attendance), m.attendance == null ? 'No attendance marked yet' : 'Present + late · excused excluded', 'teal', 'attendance'];
  const students = ['students', ctx.allAccess ? 'Total students' : 'Student records', number(m.students), `${number(m.active)} active this year`, 'blue', 'students'];
  const courses = ['courses', role === 'Student' || role === 'Faculty' ? 'My courses' : 'Courses', number(learningRows(ctx, 'courses').length), role === 'Student' ? 'Your program and semester' : 'Recorded for this academic year', 'purple', 'courses'];
  const collected = ['payments', 'Fees collected', amount(m.payments), m.invoices ? `${percentage(m.payments / m.invoices * 100)} of invoiced fees` : 'No invoices issued yet', 'orange', 'payments'];
  const balance = ['fees', role === 'Student' ? 'My fee balance' : 'Fees outstanding', amount(fees.balance), fees.invoices.length ? `${fees.overdue.length} overdue invoice${fees.overdue.length === 1 ? '' : 's'}` : 'No invoices issued yet', 'orange', 'fees'];
  const results = ['results', 'Published results', number(ctx.rows('results').filter(r => r.status === 'Published').length), 'Open to see marks and grades', 'blue', 'results'];
  let specs;
  if (role === 'Student') specs = [courses, attendance, results, balance];
  else if (role === 'Finance Head') specs = [collected, balance, ['transactions', 'Expenses', amount(m.expense), 'Recorded expense vouchers', 'purple', 'transactions'], ['fees', 'Overdue invoices', number(fees.overdue.length), 'Unpaid after their due date', 'rose', 'fees']];
  else if (ctx.allAccess) specs = [students, attendance, collected, ['programs', 'Active programs', number(ctx.rows('programs').filter(r => r.status === 'Active').length), `${ctx.rows('programs').length} programs in the college`, 'purple', 'programs'], ['faculty', 'Active faculty', number(m.faculty), `${m.fullTime} full-time faculty members`, 'rose', 'faculty']];
  else if (can(role, 'courses')) specs = [courses, students, attendance, results];
  else specs = Object.keys(modules).filter(k => can(role, k, 'write')).slice(0, 4).map((k, i) => [k, modules[k].title, number(ctx.rows(k).length), 'Saved records you can manage', ['blue', 'teal', 'orange', 'purple'][i], k]);
  return specs.filter(([entity]) => can(role, entity));
}
