// School workflows: rules for school registers, the daily attendance register,
// marks entry and monthly billing. Every write goes through store.save(), so the
// normal permission, scoping, versioning and audit rules still apply.
import { can, scopeRecord } from '../shared/schema.mjs';
import { billFor, billingKey, classStudents, MONTHS_BS } from '../shared/school.mjs';
import { familyRoute, absenceSms, sendQueuedSms } from './school-family.mjs';
import { previewPromotion, applyPromotion } from './school-promotion.mjs';
import { validateOps, opsRoute } from './school-ops.mjs';
import { siblingRanks, overdueForFine, advanceBalance } from '../shared/school-ops.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const same = (a, b, keys) => keys.every((k) => (a[k] ?? '') === (b[k] ?? ''));

/** Extra checks for school records, run inside store.validate(). */
export function validateSchool(entity, r, id, all, find, user) {
  const dup = (keys) => all[entity].some((x) => x.id !== id && x.year === r.year && same(x, r, keys));
  if (entity === 'classes' && dup(['name', 'section', 'stream'])) throw fail('This class and section already exist for the academic year.');
  if (entity === 'subjects' && dup(['classId', 'name'])) throw fail('This class already has a subject with that name.');
  if (entity === 'terms' && dup(['name'])) throw fail('This examination already exists for the academic year.');
  if (entity === 'feeHeads' && dup(['classId', 'head', 'frequency', 'appliesTo'])) throw fail('This fee head is already set for the class.');
  if (entity === 'schoolAttendance') {
    if (dup(['studentId', 'date'])) throw fail('Attendance is already recorded for this student on this date.');
    if (find(r.studentId)?.classId !== r.classId) throw fail('The student is not in this class.');
  }
  if (entity === 'students' && r.classId && r.rollNo && all.students.some((x) => x.id !== id && x.year === r.year && x.classId === r.classId && Number(x.rollNo) === Number(r.rollNo) && x.status === 'Active'))
    throw fail(`Roll number ${r.rollNo} is already used in this class.`);
  const dateOrder = (from, to, label) => { if (r[from] && r[to] && r[to] < r[from]) throw fail(`${label}: the end date is before the start date.`); };
  if (entity === 'leaveRequests') {
    dateOrder('fromDate', 'toDate', 'Leave note');
    if (user.role === 'Parent' && r.status !== 'Pending') throw fail('Leave notes are sent as Pending; the school approves them.');
  }
  if (entity === 'leaves') {
    dateOrder('fromDate', 'toDate', 'Leave');
    if (!r.facultyId === !r.staffId) throw fail('Choose either a teacher or a staff member.');
    if (user.role === 'Faculty' && (r.status !== 'Requested' || r.facultyId !== user.facultyId)) throw fail('Teachers request their own leave; HR approves it.');
  }
  if (['salaryStructures', 'payslips'].includes(entity) && !r.facultyId === !r.staffId) throw fail('Choose either a teacher or a staff member.');
  if (entity === 'salaryStructures' && r.status === 'Active' && all.salaryStructures.some((x) => x.id !== id && x.status === 'Active' && x.year === r.year && (x.facultyId || x.staffId) === (r.facultyId || r.staffId))) throw fail('This person already has an active salary structure. Stop the old one first.');
  if (entity === 'payslips' && dup(['facultyId', 'staffId', 'month'])) throw fail('A payslip for this month already exists.');
  if (entity === 'homework') {
    if (find(r.subjectId)?.classId !== r.classId) throw fail('Choose a subject taught in this class.');
    dateOrder('assignedDate', 'dueDate', 'Assignment');
  }
  if (entity === 'homeworkChecks') {
    if (dup(['homeworkId', 'studentId'])) throw fail('This student is already checked for the assignment.');
    if (find(r.homeworkId)?.classId !== find(r.studentId)?.classId) throw fail('The student is not in the assignment’s class.');
  }
  if (entity === 'diary' && user.role === 'Faculty' && r.facultyId !== user.facultyId) throw fail('Teachers write their own diary.');
  if (entity === 'busAttendance' && dup(['studentId', 'date', 'trip'])) throw fail('Bus attendance is already recorded for this trip.');
  if (entity === 'certificates' && all.certificates.some((x) => x.id !== id && x.certificateNo === r.certificateNo)) throw fail('This certificate number is already used.');
  if (entity === 'loans') {
    dateOrder('issueDate', 'dueDate', 'Loan');
    if (!r.studentId === !r.facultyId) throw fail('Choose either a student or a teacher as the borrower.');
  }
  if (entity === 'notices' && r.audience === 'One class' && !r.classId) throw fail('Choose the class for this notice.');
  if (entity === 'marks') {
    if (dup(['studentId', 'termId', 'subjectId'])) throw fail('Marks already exist for this student, subject and examination.');
    const subject = find(r.subjectId), student = find(r.studentId), term = find(r.termId);
    if (!subject || student?.classId !== subject.classId) throw fail('The student does not study this subject.');
    if (r.theory !== undefined && r.theory > Number(subject.theoryFull)) throw fail(`Theory marks cannot exceed ${subject.theoryFull}.`);
    if (r.practical !== undefined && r.practical > (Number(subject.practicalFull) || 0)) throw fail(subject.practicalFull ? `Practical marks cannot exceed ${subject.practicalFull}.` : 'This subject has no practical marks.');
    if (user.role === 'Faculty' && r.status === 'Published') throw fail('Teachers save marks as drafts. The examination team publishes results.');
    if (user.role === 'Faculty' && id && find(id)?.status === 'Published') throw fail('Published marks can only be changed by the examination team.');
    if (user.role === 'Faculty' && term?.status === 'Published') throw fail('Results for this examination are already published.');
  }
  validateOps(entity, r, id, all, find, user);
}

const num = (v, label) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v); if (!Number.isFinite(n) || n < 0) throw fail(`${label} must be a positive number.`); return n;
};

/** POST /api/school/attendance { year, classId, date, rows:[{studentId,status,notes?}] } */
async function saveAttendance(store, user, b) {
  if (!can(user.role, 'schoolAttendance', 'write')) throw fail('Attendance access is required.', 403);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw fail('Choose a valid date.');
  if (b.date > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) throw fail('Attendance cannot be taken for a future date.');
  if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 200) throw fail('Mark 1–200 students.');
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all(), seen = new Set();
    for (const row of b.rows) {
      if (seen.has(row.studentId)) throw fail('A student appears twice in the register.'); seen.add(row.studentId);
      const existing = all.schoolAttendance.find((a) => a.studentId === row.studentId && a.date === b.date && a.year === b.year);
      if (existing && existing.status === row.status && (existing.notes || '') === (row.notes || '')) continue;
      await store.save(user, 'schoolAttendance', { year: b.year, studentId: row.studentId, classId: b.classId, date: b.date, status: row.status, notes: row.notes || '', version: existing?.version }, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}

/** POST /api/school/marks { year, termId, subjectId, publish?, rows:[{studentId,theory,practical,absent}] } */
async function saveMarks(store, user, b) {
  if (!can(user.role, 'marks', 'write')) throw fail('Marks access is required.', 403);
  if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 200) throw fail('Enter marks for 1–200 students.');
  const status = b.publish ? 'Published' : 'Draft';
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) {
      const theory = num(row.theory, 'Theory marks'), practical = num(row.practical, 'Practical marks');
      if (theory === undefined && practical === undefined && row.absent !== 'Yes') continue;
      const existing = all.marks.find((m) => m.studentId === row.studentId && m.termId === b.termId && m.subjectId === b.subjectId && m.year === b.year);
      const next = { year: b.year, studentId: row.studentId, termId: b.termId, subjectId: b.subjectId, theory, practical, absent: row.absent === 'Yes' ? 'Yes' : 'No', status, notes: existing?.notes, version: existing?.version };
      if (existing && same(existing, next, ['theory', 'practical', 'absent', 'status'])) continue;
      await store.save(user, 'marks', next, existing?.id || null);
      saved++;
    }
  });
  return { saved, status };
}

/** Bills for the chosen classes; preview returns them, apply creates one invoice per student. */
async function billing(store, user, b, apply) {
  if (!can(user.role, 'fees', 'write')) throw fail('Fee access is required.', 403);
  if (!MONTHS_BS.includes(b.month)) throw fail('Choose a billing month.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '')) throw fail('Choose a due date.');
  const all = await store.all(), period = billingKey(b.year, b.month);
  const classIds = new Set(Array.isArray(b.classIds) ? b.classIds : []);
  if (!classIds.size) throw fail('Choose at least one class.');
  const heads = all.feeHeads.filter((h) => h.year === b.year);
  const occasional = Array.isArray(b.occasional) ? b.occasional : [];
  const profile = (await store.meta('profile')) || {}, pct = (k) => Math.min(100, Math.max(0, Number(profile[k]) || 0));
  const yearStudents = all.students.filter((s) => s.year === b.year), ranks = siblingRanks(yearStudents, all.classes.filter((c) => c.year === b.year));
  const fees = all.fees.filter((f) => f.year === b.year), asOf = new Date().toISOString().slice(0, 10);
  const lateFine = Math.max(0, Number(profile.lateFineFlat) || 0), grace = Math.max(0, Number(profile.lateFineGraceDays) || 0);
  const bills = [...classIds].flatMap((classId) => classStudents(all, classId, b.year)).map((st) => {
    const overdue = lateFine ? overdueForFine(fees.filter((f) => f.studentId === st.id), all.payments, asOf, grace) : [];
    const bill = billFor(st, heads, all.scholarships.filter((x) => x.year === b.year), { month: b.month, includeOccasional: occasional, siblingRank: ranks.get(st.id)?.rank || 0, siblingPct: pct('siblingDiscount'), staffChildPct: pct('staffChildDiscount'), overdue, lateFine });
    const already = fees.find((f) => f.studentId === st.id && f.billingPeriod === period);
    const advance = advanceBalance(all.advances.filter((a) => a.year === b.year), st.id);
    return { ...bill, name: st.name, rollNo: st.rollNo, classId: st.classId, already: already ? already.invoiceNo : null, advance, fromAdvance: Math.min(advance, bill.total) };
  }).filter((x) => scopeRecord(user, 'students', all.students.find((s) => s.id === x.studentId), all));
  if (!apply) return { period, bills };
  let created = 0, adjusted = 0, next = fees.length + 1;
  const prefix = 'SB-' + b.year.slice(0, 4) + '-';
  await store.tx(async () => {
    const now = await store.all(), taken = new Set(now.fees.map((f) => f.invoiceNo)), receipts = new Set(now.payments.map((p) => p.receiptNo));
    for (const bill of bills) {
      if (bill.already || bill.total <= 0) continue;
      let invoiceNo; do { invoiceNo = prefix + String(next++).padStart(5, '0'); } while (taken.has(invoiceNo)); taken.add(invoiceNo);
      const notes = [...bill.lines.map((l) => `${l.head}${l.note ? ' (' + l.note + ')' : ''}: NPR ${l.amount.toLocaleString('en-IN')}`), bill.discount ? `Less ${bill.discountNote}: NPR ${bill.discount.toLocaleString('en-IN')}` : null].filter(Boolean).join('\n');
      const invoice = await store.save(user, 'fees', { year: b.year, invoiceNo, studentId: bill.studentId, category: 'Monthly bill', amount: bill.total, dueDate: b.dueDate, billingPeriod: period, lateFined: 'No', notes });
      created++;
      for (const l of bill.lines.filter((x) => x.forInvoiceId)) { const old = now.fees.find((f) => f.id === l.forInvoiceId); if (old) await store.save(user, 'fees', { ...old, lateFined: 'Yes' }, old.id, true); }
      // Money paid in advance settles the new bill first, oldest advance first.
      let left = bill.fromAdvance;
      for (const a of now.advances.filter((x) => x.studentId === bill.studentId && x.year === b.year && x.status !== 'Used').sort((x, y) => x.date.localeCompare(y.date))) {
        if (left <= 0) break;
        const take = Math.min(left, Number(a.amount) - (Number(a.used) || 0)); if (take <= 0) continue;
        let receiptNo = 'ADJ-' + a.receiptNo, k = 1; while (receipts.has(receiptNo)) receiptNo = 'ADJ-' + a.receiptNo + '-' + ++k; receipts.add(receiptNo);
        await store.save(user, 'payments', { year: b.year, receiptNo, invoiceId: invoice.id, amount: take, date: asOf, method: 'Advance', reference: a.receiptNo, notes: 'Adjusted from advance payment ' + a.receiptNo });
        const used = Math.round(((Number(a.used) || 0) + take) * 100) / 100;
        await store.save(user, 'advances', { ...a, used, status: used >= Number(a.amount) ? 'Used' : 'Available' }, a.id, true);
        left -= take; adjusted += take;
      }
    }
  });
  return { period, created, skipped: bills.length - created, adjusted };
}

/** Returns a response body, or undefined when the path is not a school route. */
export async function schoolRoute(store, user, path, method, readBody, ctx = {}) {
  if (method !== 'POST' || !path.startsWith('/api/school/')) return undefined;
  const kind = (await store.meta('profile'))?.kind;
  if (kind !== 'school') throw fail('School tools are available to school workspaces.', 403);
  const b = await readBody();
  if (!['/api/school/sms/log', '/api/school/guardians/list', '/api/school/guardians/add', '/api/school/guardians/remove', '/api/school/library/return', '/api/school/notices/sms', '/api/school/pay/esewa/start', '/api/school/promotion/preview', '/api/school/promotion/apply'].includes(path) && (typeof b.year !== 'string' || !/^\d{4}\/\d{2}$/.test(b.year))) throw fail('Choose a valid academic year.');
  if (path === '/api/school/attendance') {
    const result = await saveAttendance(store, user, b);
    const queued = await absenceSms(store, await store.all(), await store.meta('profile'), b.classId, b.date, b.rows).catch(() => 0);
    if (queued) await sendQueuedSms(store).catch(() => null);
    return { ...result, smsQueued: queued };
  }
  if (path === '/api/school/promotion/preview') { const { plan, ...rest } = await previewPromotion(store, user, b); return rest; }
  if (path === '/api/school/promotion/apply') return applyPromotion(store, user, b);
  const ops = await opsRoute(store, user, path, b);
  if (ops !== undefined) return ops;
  const family = await familyRoute(store, user, path, b, ctx);
  if (family !== undefined) return family;
  if (path === '/api/school/marks') return saveMarks(store, user, b);
  if (path === '/api/school/billing/preview') return billing(store, user, b, false);
  if (path === '/api/school/billing/apply') return billing(store, user, b, true);
  throw fail('Not found.', 404);
}
