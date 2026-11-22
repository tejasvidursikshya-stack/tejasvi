// School phase 2 and 3 workflows: parent access, bus attendance, homework checking,
// the library desk, payroll, SMS alerts and eSewa online payment.
// Every record write goes through store.save(), so permissions, scoping and the audit log apply.
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { can, scopeRecord, invoiceBalance } from '../shared/schema.mjs';
import { canManageUsers } from '../shared/access.mjs';
import { MONTHS_BS, payslipFor, loanFine, smsPhone } from '../shared/school.mjs';
import { unpaidDays, payMonthRange } from '../shared/school-ops.mjs';
import { one, many } from '../../../lib/campus-data.mjs';
import { hashPassword } from '../../../lib/password.ts';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const today = () => new Date().toISOString().slice(0, 10);
const needs = (user, entity, op = 'write') => { if (!can(user.role, entity, op)) throw fail('You do not have permission for this.', 403); };

/* ------------------------------------------------------------ Parent access */
const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) && e.length <= 254;
async function studentPerson(store, studentId) {
  const st = await store.get(studentId);
  if (!st || st.entity !== 'students') throw fail('Student not found.', 404);
  return { st, person: st.personId || st.id };
}
async function guardians(store, user, b) {
  if (!canManageUsers(user.role)) throw fail('Only administrators manage parent access.', 403);
  const { person } = await studentPerson(store, b.studentId);
  return many(store.db.connection(), 'SELECT g.user_id id,g.relation,u.name,u.email,m.active FROM emis_guardians g JOIN users u ON u.id=g.user_id JOIN institution_memberships m ON m.org_id=g.org_id AND m.user_id=g.user_id WHERE g.org_id=? AND g.student_person_id=? ORDER BY u.name', [store.org, person]);
}
async function addGuardian(store, user, b) {
  if (!canManageUsers(user.role)) throw fail('Only administrators manage parent access.', 403);
  const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 120);
  const relation = ['Father', 'Mother', 'Guardian', 'Grandparent', 'Relative'].includes(b.relation) ? b.relation : 'Guardian';
  if (!validEmail(email)) throw fail('Enter a valid email address for the parent login.');
  if (!name) throw fail('Enter the parent’s name.');
  return store.tx(async () => {
    const c = store.db.connection(), { st, person } = await studentPerson(store, b.studentId);
    let account = await one(c, 'SELECT id,platform_admin FROM users WHERE email=? FOR UPDATE', [email]), created = false;
    if (account?.platform_admin) throw fail('The platform owner account cannot be used as a parent login.', 403);
    const member = account && await one(c, 'SELECT m.role,r.role erp FROM institution_memberships m LEFT JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE m.org_id=? AND m.user_id=?', [store.org, account.id]);
    if (member && member.erp !== 'Parent') throw fail('This email already belongs to a staff or student account here. Use a different email for the parent.', 409);
    if (!account) {
      if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128) throw fail('Set an initial password of 12–128 characters. The parent changes it at first sign-in.');
      account = { id: randomUUID() }; created = true;
      await c.execute('INSERT INTO users(id,name,email,password_hash,must_change_password) VALUES(?,?,?,?,1)', [account.id, name, email, await hashPassword(b.password)]);
    }
    if (!member) {
      await c.execute("INSERT INTO institution_memberships(org_id,user_id,role,display_name) VALUES(?,?,'ops',?)", [store.org, account.id, name]);
      await c.execute("INSERT INTO emis_roles(org_id,user_id,role) VALUES(?,?,'Parent')", [store.org, account.id]);
    }
    await c.execute('INSERT INTO emis_guardians(org_id,user_id,student_person_id,relation,created_by) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE relation=VALUES(relation)', [store.org, account.id, person, relation, user.id]);
    await store.log(user, 'gave parent access', 'students', st.id, null, { parent: email, relation });
    return { id: account.id, created };
  });
}
async function removeGuardian(store, user, b) {
  if (!canManageUsers(user.role)) throw fail('Only administrators manage parent access.', 403);
  return store.tx(async () => {
    const c = store.db.connection(), { st, person } = await studentPerson(store, b.studentId);
    await c.execute('DELETE FROM emis_guardians WHERE org_id=? AND user_id=? AND student_person_id=?', [store.org, b.userId, person]);
    const left = await one(c, 'SELECT COUNT(*) n FROM emis_guardians WHERE org_id=? AND user_id=?', [store.org, b.userId]);
    if (!Number(left.n)) await c.execute("UPDATE institution_memberships SET active=0 WHERE org_id=? AND user_id=? AND EXISTS(SELECT 1 FROM emis_roles r WHERE r.org_id=institution_memberships.org_id AND r.user_id=institution_memberships.user_id AND r.role='Parent')", [store.org, b.userId]);
    await store.log(user, 'removed parent access', 'students', st.id, null, { parent: b.userId });
    return { ok: true };
  });
}

/* ------------------------------------------------------------ Bulk registers */
async function busAttendance(store, user, b) {
  needs(user, 'busAttendance');
  if (!['Morning pickup', 'Afternoon drop'].includes(b.trip)) throw fail('Choose the trip.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || b.date > today()) throw fail('Choose a valid date, not in the future.');
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 200) throw fail('Mark 1–200 students.');
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) {
      const existing = all.busAttendance.find((a) => a.studentId === row.studentId && a.date === b.date && a.trip === b.trip && a.year === b.year);
      if (existing?.status === row.status) continue;
      await store.save(user, 'busAttendance', { year: b.year, studentId: row.studentId, routeId: b.routeId, date: b.date, trip: b.trip, status: row.status, version: existing?.version }, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}
async function homeworkChecks(store, user, b) {
  needs(user, 'homeworkChecks');
  if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 200) throw fail('Check 1–200 students.');
  let saved = 0;
  await store.tx(async () => {
    const all = await store.all();
    for (const row of b.rows) {
      const existing = all.homeworkChecks.find((x) => x.homeworkId === b.homeworkId && x.studentId === row.studentId);
      if (existing && existing.status === row.status && (existing.remark || '') === (row.remark || '')) continue;
      await store.save(user, 'homeworkChecks', { year: b.year, homeworkId: b.homeworkId, studentId: row.studentId, status: row.status, remark: row.remark || '', version: existing?.version }, existing?.id || null);
      saved++;
    }
  });
  return { saved };
}

/* ------------------------------------------------------------ Library desk */
async function libraryIssue(store, user, b) {
  needs(user, 'loans');
  const all = await store.all();
  const book = all.library.find((x) => x.accessionNo === String(b.accessionNo || '').trim());
  if (!book) throw fail('No library resource has that accession number.');
  const student = all.students.find((x) => x.studentNo === String(b.borrowerNo || '').trim() && x.year === b.year && x.status === 'Active');
  const teacher = !student && all.faculty.find((x) => x.employeeNo === String(b.borrowerNo || '').trim());
  if (!student && !teacher) throw fail('No active student or teacher has that ID.');
  const out = all.loans.filter((l) => l.resourceId === book.id && l.status === 'Issued').length;
  if (out >= Math.max(1, Number(book.copies) || 1)) throw fail('All copies of this resource are already on loan.');
  const days = Math.min(60, Math.max(1, Number(b.days) || 14)), due = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  return store.tx(() => store.save(user, 'loans', { year: b.year, resourceId: book.id, studentId: student?.id, facultyId: teacher?.id, issueDate: today(), dueDate: due, status: 'Issued' }));
}
async function libraryReturn(store, user, b) {
  needs(user, 'loans');
  const loan = await store.get(b.loanId);
  if (!loan || loan.entity !== 'loans' || loan.status !== 'Issued') throw fail('This loan is not open.');
  const fine = loanFine(loan, today(), Number((await store.meta('profile'))?.libraryFinePerDay) || 5);
  return store.tx(() => store.save(user, 'loans', { ...loan, returnDate: today(), fine, status: b.lost ? 'Lost' : 'Returned' }, loan.id));
}

/* ------------------------------------------------------------ Payroll */
async function payroll(store, user, b, apply) {
  needs(user, 'payslips');
  if (!MONTHS_BS.includes(b.month)) throw fail('Choose a month.');
  const all = await store.all(), month = `${b.month} ${b.year}`;
  const people = Object.fromEntries([...all.faculty, ...all.staff].map((p) => [p.id, p]));
  const range = payMonthRange(b.year, b.month);
  const slips = all.salaryStructures.filter((x) => x.year === b.year && x.status === 'Active').map((x) => {
    const who = x.facultyId || x.staffId, slip = payslipFor(x, { unpaidDays: unpaidDays(all, who, range.from, range.to), monthDays: range.days });
    const already = all.payslips.find((p) => (p.facultyId || p.staffId) === who && p.month === month);
    return { ...slip, facultyId: x.facultyId, staffId: x.staffId, name: people[who]?.name || 'Unknown', already: !!already };
  });
  if (!apply) return { month, slips, from: range.from, to: range.to };
  let created = 0;
  await store.tx(async () => { for (const s of slips) { if (s.already) continue; const { name, already, ...data } = s; await store.save(user, 'payslips', { ...data, year: b.year, month, status: 'Draft' }); created++; } });
  return { month, created };
}

/* ------------------------------------------------------------ SMS (Sparrow SMS when configured) */
export async function queueSms(store, kind, recordId, phones, message) {
  const c = store.db.connection(), list = [...new Set(phones.map(smsPhone).filter(Boolean))];
  for (const phone of list) await c.execute('INSERT IGNORE INTO emis_sms_outbox(org_id,phone,message,kind,record_id) VALUES(?,?,?,?,?)', [store.org, phone, message.slice(0, 480), kind, recordId]);
  return list.length;
}
export async function sendQueuedSms(store) {
  const c = store.db.connection(), token = process.env.SPARROW_SMS_TOKEN, from = process.env.SPARROW_SMS_FROM;
  const queued = await many(c, "SELECT id,phone,message FROM emis_sms_outbox WHERE org_id=? AND status='Queued' ORDER BY id LIMIT 200", [store.org]);
  if (!token || !from) { if (queued.length) await c.execute("UPDATE emis_sms_outbox SET status='Not configured' WHERE org_id=? AND status='Queued'", [store.org]); return { sent: 0, configured: false }; }
  let sent = 0;
  for (const m of queued) {
    try {
      const r = await fetch('https://api.sparrowsms.com/v2/sms/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, from, to: m.phone, text: m.message }), signal: AbortSignal.timeout(10000) });
      const ok = r.ok; await c.execute('UPDATE emis_sms_outbox SET status=?,error=?,sent_at=? WHERE id=?', [ok ? 'Sent' : 'Failed', ok ? null : `HTTP ${r.status}`, new Date(), m.id]); if (ok) sent++;
    } catch (e) { await c.execute("UPDATE emis_sms_outbox SET status='Failed',error=? WHERE id=?", [String(e.message).slice(0, 250), m.id]); }
  }
  return { sent, configured: true };
}
const guardianPhones = (st) => [st.fatherPhone, st.motherPhone, st.guardianPhone];
export async function absenceSms(store, all, profile, classId, date, rows) {
  if (profile?.smsAbsence !== 'Yes') return 0;
  let n = 0;
  for (const row of rows.filter((r) => r.status === 'Absent')) {
    const st = all.students.find((x) => x.id === row.studentId);
    if (st) n += await queueSms(store, 'absence', `${st.id}:${date}`, guardianPhones(st), `${profile.name}: ${st.name} was absent from school on ${date}. Please contact the class teacher if this is unexpected.`);
  }
  return n;
}
async function noticeSms(store, user, b) {
  needs(user, 'notices');
  const notice = await store.get(b.noticeId), all = await store.all(), profile = await store.meta('profile');
  if (!notice || notice.entity !== 'notices' || notice.status !== 'Published') throw fail('Publish the notice first.');
  if (!['Everyone', 'Parents', 'One class'].includes(notice.audience)) throw fail('SMS goes to parents. Choose Everyone, Parents or One class as the audience.');
  const kids = all.students.filter((s) => s.year === notice.year && s.status === 'Active' && (notice.audience !== 'One class' || s.classId === notice.classId));
  const text = `${profile.name}: ${notice.name}. ${notice.body}`.replace(/\s+/g, ' ').slice(0, 300);
  const queued = await queueSms(store, 'notice', notice.id, kids.flatMap(guardianPhones), text);
  await store.log(user, 'queued notice SMS', 'notices', notice.id, null, { recipients: queued });
  return { queued, ...(await sendQueuedSms(store)) };
}
async function smsLog(store, user) {
  needs(user, 'notices');
  return { configured: !!(process.env.SPARROW_SMS_TOKEN && process.env.SPARROW_SMS_FROM), messages: await many(store.db.connection(), 'SELECT id,phone,message,kind,status,error,created_at createdAt,sent_at sentAt FROM emis_sms_outbox WHERE org_id=? ORDER BY id DESC LIMIT 200', [store.org]) };
}

/* ------------------------------------------------------------ eSewa ePay v2 */
const ESEWA = {
  test: { form: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', status: 'https://rc.esewa.com.np/api/epay/transaction/status/', product: 'EPAYTEST', secret: '8gBm/:&EnhH.1/q' },
  live: { form: 'https://epay.esewa.com.np/api/epay/main/v2/form', status: 'https://esewa.com.np/api/epay/transaction/status/' },
};
export function esewaConfig() {
  const mode = process.env.ESEWA_MODE;
  if (mode === 'test') return { mode, ...ESEWA.test, product: process.env.ESEWA_PRODUCT_CODE || ESEWA.test.product, secret: process.env.ESEWA_SECRET || ESEWA.test.secret };
  if (mode === 'live' && process.env.ESEWA_PRODUCT_CODE && process.env.ESEWA_SECRET) return { mode, ...ESEWA.live, product: process.env.ESEWA_PRODUCT_CODE, secret: process.env.ESEWA_SECRET };
  return null;
}
export const esewaSign = (secret, fields, names) => createHmac('sha256', secret).update(names.split(',').map((k) => `${k}=${fields[k]}`).join(',')).digest('base64');
async function esewaStart(store, user, b, origin, base) {
  const cfg = esewaConfig(); if (!cfg) throw fail('Online payment is not switched on for this school.', 409);
  needs(user, 'fees', 'read');
  const all = await store.all(), inv = all.fees.find((f) => f.id === b.invoiceId);
  if (!inv || !scopeRecord(user, 'fees', inv, all)) throw fail('Invoice not found.', 404);
  const { balance } = invoiceBalance(inv, all.payments);
  if (balance <= 0) throw fail('This invoice is already paid.');
  const id = randomUUID(), amount = balance.toFixed(2);
  await store.db.connection().execute('INSERT INTO emis_online_payments(id,org_id,invoice_id,user_id,provider,amount) VALUES(?,?,?,?,?,?)', [id, store.org, inv.id, user.id, 'eSewa', amount]);
  const fields = { amount, tax_amount: '0', total_amount: amount, transaction_uuid: id, product_code: cfg.product, product_service_charge: '0', product_delivery_charge: '0', success_url: `${origin}${base}/api/pay/esewa/return`, failure_url: `${origin}${base}/api/pay/esewa/return?failed=${id}`, signed_field_names: 'total_amount,transaction_uuid,product_code' };
  return { action: cfg.form, fields: { ...fields, signature: esewaSign(cfg.secret, fields, fields.signed_field_names) }, test: cfg.mode === 'test' };
}
/** GET /api/pay/esewa/return — eSewa redirects the payer here. Verifies the signature and asks eSewa for the status before recording anything. */
export async function esewaReturn(store, user, url) {
  const cfg = esewaConfig(); if (!cfg) throw fail('Online payment is not switched on.', 409);
  const c = store.db.connection();
  if (url.searchParams.get('failed')) { await c.execute("UPDATE emis_online_payments SET status='Failed' WHERE org_id=? AND id=? AND status='Started'", [store.org, url.searchParams.get('failed')]); return { ok: false, message: 'The eSewa payment was cancelled or failed. No money was recorded.' }; }
  let data; try { data = JSON.parse(Buffer.from(String(url.searchParams.get('data') || ''), 'base64').toString('utf8')); } catch { throw fail('The payment response could not be read.'); }
  const expected = Buffer.from(esewaSign(cfg.secret, data, String(data.signed_field_names || ''))), got = Buffer.from(String(data.signature || ''));
  if (!data.signed_field_names?.includes('transaction_uuid') || expected.length !== got.length || !timingSafeEqual(expected, got)) throw fail('The payment response signature is not valid.', 400);
  const attempt = await one(c, 'SELECT * FROM emis_online_payments WHERE org_id=? AND id=?', [store.org, data.transaction_uuid]);
  if (!attempt) throw fail('Payment attempt not found.', 404);
  if (attempt.status === 'Complete') return { ok: true, message: 'This payment is already recorded.', invoiceId: attempt.invoice_id };
  const q = new URLSearchParams({ product_code: cfg.product, total_amount: String(attempt.amount), transaction_uuid: attempt.id });
  const status = await (await fetch(cfg.status + '?' + q, { signal: AbortSignal.timeout(15000) })).json();
  if (status.status !== 'COMPLETE' || Number(status.total_amount) !== Number(attempt.amount)) {
    if (['NOT_FOUND', 'CANCELED', 'FULL_REFUND'].includes(status.status)) await c.execute("UPDATE emis_online_payments SET status='Failed' WHERE id=?", [attempt.id]);
    return { ok: false, message: `eSewa reports the payment as ${String(status.status || 'unknown').toLowerCase()}. Nothing was recorded.` };
  }
  const system = { id: attempt.user_id, name: 'eSewa', role: 'Super Admin' };
  return store.tx(async () => {
    const all = await store.all(), inv = all.fees.find((f) => f.id === attempt.invoice_id);
    const receiptNo = 'ES-' + String(status.ref_id || data.transaction_code).slice(0, 20);
    const pay = await store.save(system, 'payments', { year: inv.year, receiptNo, invoiceId: inv.id, amount: Number(attempt.amount), date: today(), method: 'eSewa', reference: String(status.ref_id || data.transaction_code), notes: `Paid online through eSewa${cfg.mode === 'test' ? ' (test mode)' : ''}.` });
    await c.execute("UPDATE emis_online_payments SET status='Complete',reference=?,payment_record_id=?,completed_at=? WHERE id=?", [String(status.ref_id || data.transaction_code), pay.id, new Date(), attempt.id]);
    return { ok: true, message: `Payment of NPR ${Number(attempt.amount).toLocaleString('en-IN')} received. Receipt ${receiptNo}.`, invoiceId: inv.id };
  });
}

/** Routes for these workflows. Returns undefined when the path is not one of them. */
export async function familyRoute(store, user, path, b, ctx) {
  const map = {
    '/api/school/guardians/list': () => guardians(store, user, b),
    '/api/school/guardians/add': () => addGuardian(store, user, b),
    '/api/school/guardians/remove': () => removeGuardian(store, user, b),
    '/api/school/bus-attendance': () => busAttendance(store, user, b),
    '/api/school/homework-checks': () => homeworkChecks(store, user, b),
    '/api/school/library/issue': () => libraryIssue(store, user, b),
    '/api/school/library/return': () => libraryReturn(store, user, b),
    '/api/school/payroll/preview': () => payroll(store, user, b, false),
    '/api/school/payroll/apply': () => payroll(store, user, b, true),
    '/api/school/notices/sms': () => noticeSms(store, user, b),
    '/api/school/sms/log': () => smsLog(store, user),
    '/api/school/pay/esewa/start': () => esewaStart(store, user, b, ctx.origin, ctx.base),
  };
  return map[path] ? map[path]() : undefined;
}
