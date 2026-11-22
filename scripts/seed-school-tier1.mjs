// Adds fictional sample data for the school operations features to a workspace that already
// has the Grade 6 sample (scripts/seed-school-grade6.mjs): class routine, staff attendance and
// a leave, the Second Terminal exam routine, CAS scores and report remarks, calendar events,
// parent–teacher messages, an advance payment and opening balances.
//
//   node scripts/seed-school-tier1.mjs --org <org-id>
//
// Records go through the normal EMIS validation and audit log and are flagged as sample data.
import { mysql } from './common.mjs';
import { verified } from './common.mjs';
import { MySQLDatabase } from '../modules/emis/server/database.mjs';
import { Store } from '../modules/emis/server/store.mjs';
import { schoolRoute } from '../modules/emis/server/school.mjs';
import { classStudents, sortClasses } from '../modules/emis/shared/school.mjs';
import { CAS_AREAS, SCHOOL_DAYS, weekday } from '../modules/emis/shared/school-ops.mjs';

const cfg = await verified();
const pool = mysql.createPool({ ...cfg.db, connectionLimit: 4, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, jsonStrings: true });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const orgId = arg('--org');
if (!orgId) { console.error('Run with --org <school org id>.'); process.exit(1); }
const [[owner]] = await pool.query("SELECT u.id,u.name FROM emis_roles r JOIN users u ON u.id=r.user_id JOIN organizations o ON o.id=r.org_id WHERE r.org_id=? AND r.role='Super Admin' AND o.kind='school' LIMIT 1", [orgId]);
if (!owner) { console.error('That organization is not a school EMIS workspace with a Super Admin.'); process.exit(1); }
const user = { id: owner.id, name: owner.name, role: 'Super Admin' };
class ScriptDatabase extends MySQLDatabase {
  async tx(fn) { if (this.context.getStore()) return fn(); const c = await this.pool.getConnection(); try { await c.beginTransaction(); const v = await this.context.run(c, fn); await c.commit(); return v; } catch (e) { await c.rollback(); throw e; } finally { c.release(); } }
}
const store = new Store(new ScriptDatabase(pool, orgId, null, user));
const profile = await store.meta('profile'), year = profile.year;
let all = await store.all();
const classes = sortClasses(all.classes.filter((c) => c.year === year && c.name === 'Grade 6'));
if (classes.length < 2) { console.error('Add the Grade 6 sample first (scripts/seed-school-grade6.mjs).'); process.exit(1); }
if (all.routine.some((r) => r.year === year)) { console.error('A class routine already exists for this year. Nothing was changed.'); process.exit(1); }
const startedAt = new Date(Date.now() - 1000).toISOString();
const save = (entity, value, id = null) => store.save(user, entity, { year, ...value }, id);
const call = (path, body) => schoolRoute(store, user, path, 'POST', async () => ({ year, ...body }));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const today = iso(Date.now());

console.log(`Adding school operations sample data to ${profile.name} (${year})…`);
await store.tx(async () => {
  // Class routine: 7 periods, Sunday–Friday. Section B is offset so no teacher is in two rooms at once.
  const times = [['10:00', '10:45'], ['10:45', '11:30'], ['11:30', '12:15'], ['12:45', '13:30'], ['13:30', '14:15'], ['14:15', '15:00'], ['15:00', '15:45']];
  const busy = new Set();
  for (const [ci, cls] of classes.entries()) {
    const subs = all.subjects.filter((s) => s.classId === cls.id).sort((a, b) => a.name.localeCompare(b.name));
    for (const [di, day] of SCHOOL_DAYS.entries()) for (const [pi, [startTime, endTime]] of times.entries()) {
      if (day === 'Friday' && pi > 4) continue; // Friday is a half day
      const sub = [...Array(subs.length).keys()].map((k) => subs[(di + pi + ci * 3 + k) % subs.length]).find((x) => !x.teacherId || !busy.has(`${x.teacherId}|${day}|${pi}`));
      if (!sub) continue;
      if (sub.teacherId) busy.add(`${sub.teacherId}|${day}|${pi}`);
      await save('routine', { classId: cls.id, day, period: pi + 1, startTime, endTime, subjectId: sub.id, facultyId: sub.teacherId, room: cls.room || '' });
    }
  }
  // Staff attendance for the last ten school days, with one absence and one approved leave.
  const faculty = all.faculty.filter((f) => f.status === 'Active');
  let days = 0;
  for (let t = Date.now() - 864e5; days < 10; t -= 864e5) {
    const d = iso(t); if (weekday(d) === 'Saturday') continue; days++;
    await call('/api/school/staff-attendance', { date: d, rows: faculty.map((f, i) => ({ facultyId: f.id, status: days === 3 && i === 2 ? 'Absent' : days === 5 && i === 4 ? 'Late' : 'Present', checkIn: days === 5 && i === 4 ? '10:20' : '09:45' })) });
  }
  const next = (wd) => { for (let t = Date.now() + 864e5; ; t += 864e5) if (weekday(iso(t)) === wd) return iso(t); };
  const leaveDay = next('Sunday');
  await save('leaves', { facultyId: faculty[0].id, type: 'Casual', fromDate: leaveDay, toDate: leaveDay, days: 1, reason: 'Family function', status: 'Approved', approver: 'Principal' });

  // Calendar (sample: check dates against the published calendar before relying on them).
  for (const e of [
    ['Tihar holidays', '2026-11-08', '2026-11-12', 'Public holiday', 'Everyone'],
    ['Second Terminal examination', '2026-11-22', '2026-11-30', 'Examination', 'Everyone'],
    ['Parent–teacher meeting: Grade 6', '2026-12-05', '', 'Parent–teacher meeting', 'Parents & students'],
    ['Staff meeting: term review', '2026-12-04', '', 'Event', 'Staff'],
    ['Annual sports week', '2026-12-14', '2026-12-18', 'Event', 'Everyone'],
    ['Winter vacation', '2027-01-10', '2027-01-20', 'School holiday', 'Everyone'],
  ]) await save('events', { name: e[0], date: e[1], endDate: e[2], type: e[3], audience: e[4] });

  // Second Terminal exam routine: one paper a day from 1 Mangsir week, skipping Saturdays.
  const term2 = all.terms.find((t) => t.year === year && t.name === 'Second Terminal');
  if (term2) {
    const subs = all.subjects.filter((s) => s.classId === classes[0].id).sort((a, b) => a.name.localeCompare(b.name));
    let t = Date.parse('2026-11-22T00:00:00Z');
    for (const sub of subs) {
      while (weekday(iso(t)) === 'Saturday') t += 864e5;
      for (const cls of classes) { const same = all.subjects.find((s) => s.classId === cls.id && s.name === sub.name); if (same) await save('examSchedule', { termId: term2.id, classId: cls.id, subjectId: same.id, date: iso(t), startTime: '10:00', endTime: sub.theoryFull > 50 ? '13:00' : '12:00', room: cls.room || '' }); }
      t += 864e5;
    }
  }
});

// CAS for the Second Terminal and report remarks for the published First Terminal (Grade 6 A).
all = await store.all();
const term1 = all.terms.find((t) => t.year === year && t.name === 'First Terminal'), term2 = all.terms.find((t) => t.year === year && t.name === 'Second Terminal');
const kids = classStudents(all, classes[0].id, year);
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
if (term2) for (const sub of all.subjects.filter((s) => s.classId === classes[0].id && Number(s.practicalFull) > 0).slice(0, 3))
  await call('/api/school/cas', { termId: term2.id, subjectId: sub.id, rows: kids.map((k) => ({ studentId: k.id, scores: Object.fromEntries(CAS_AREAS.map(([a, full]) => [a, Math.round((0.55 + rnd() * 0.45) * full * 2) / 2])) })) });
const remarks = ['Works hard and shows steady progress.', 'Participates actively in class discussions.', 'Should complete homework more regularly.', 'Helpful and respectful to classmates.', 'Reads well; should practise mathematics at home.'];
if (term1) await call('/api/school/remarks', { termId: term1.id, rows: kids.map((k, i) => ({ studentId: k.id, remark: remarks[i % remarks.length], conduct: ['Excellent', 'Very good', 'Good'][i % 3] })) });

// Messages, an advance payment and opening balances.
await store.tx(async () => {
  const [a, b] = kids, family = (k) => k.fatherName || k.guardian || 'Parent';
  const msg = async (k, side, author, body) => save('messages', { studentId: k.id, body, fromSide: side, author, readByFamily: side === 'Family' ? 'Yes' : 'No', readBySchool: side === 'School' ? 'Yes' : 'No' });
  const asParent = { id: user.id, name: family(a), role: 'Parent', childPersonIds: [a.personId || a.id] };
  await store.save(asParent, 'messages', { year, studentId: a.id, body: `${a.name.split(' ')[0]} has a fever today and will not come to school. We will send a leave note.`, fromSide: 'Family', author: family(a), readBySchool: 'Yes', readByFamily: 'Yes' });
  await msg(a, 'School', 'Class teacher', 'Thank you for letting us know. Please make sure she rests. Today’s homework is on the parent page.');
  await msg(b, 'School', 'Class teacher', `${b.name.split(' ')[0]} did very well in the science quiz today. Please encourage the project work at home.`);
  await save('advances', { receiptNo: 'ADV-0001', studentId: kids[2].id, amount: 9000, date: today, method: 'Bank transfer', reference: 'Sample deposit', used: 0, status: 'Available' });
  await save('ledgerAccounts', { code: '1500', name: 'Furniture and equipment', type: 'Asset', openingBalance: 450000 });
  await save('journals', { voucherNo: 'JV-0001', date: year.slice(0, 4) + '-04-14', debitAccount: '1010', creditAccount: '3000', amount: 850000, narration: 'Opening bank balance' });
  await save('journals', { voucherNo: 'JV-0002', date: year.slice(0, 4) + '-04-14', debitAccount: '1000', creditAccount: '3000', amount: 25000, narration: 'Opening cash in hand' });
});

await pool.query('UPDATE emis_records SET sample=1 WHERE org_id=? AND created_at>=?', [orgId, startedAt]);
const [[count]] = await pool.query("SELECT COUNT(*) n FROM emis_records WHERE org_id=? AND created_at>=? AND entity IN ('routine','staffAttendance','leaves','events','examSchedule','cas','reportRemarks','messages','advances','ledgerAccounts','journals')", [orgId, startedAt]);
console.log(`Done. ${count.n} sample records added to ${profile.name}.`);
await pool.end();
