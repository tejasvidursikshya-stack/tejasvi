// Adds a complete, fictional Grade 6 to a school EMIS workspace:
// two sections, CDC basic-level subjects, teachers, 32 students, a published First Terminal,
// daily attendance, fee structure and bills, bus routes, homework, notices and a leave note.
//
//   node scripts/seed-school-grade6.mjs                  list school workspaces
//   node scripts/seed-school-grade6.mjs --org <org-id>   add Grade 6 to that school
//
// Records are saved through the normal EMIS validation and audit log and are flagged as sample
// data. Guardian phone numbers are landline-style placeholders, so no SMS can reach a real person.
import { mysql } from './common.mjs';
import { verified } from './common.mjs';
import { MySQLDatabase } from '../modules/emis/server/database.mjs';
import { Store } from '../modules/emis/server/store.mjs';
import { schoolRoute } from '../modules/emis/server/school.mjs';

const cfg = await verified();
const pool = mysql.createPool({ ...cfg.db, connectionLimit: 4, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, jsonStrings: true });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const orgId = arg('--org');
if (!orgId) {
  const [rows] = await pool.query("SELECT o.id,o.name,JSON_UNQUOTE(e.profile->'$.year') AS year FROM organizations o JOIN emis_campuses e ON e.org_id=o.id WHERE o.kind='school' ORDER BY o.name");
  console.log(rows.length ? 'School workspaces:\n' + rows.map((r) => `  ${r.id}  ${r.name} (${r.year})`).join('\n') + '\n\nRun again with --org <id>.' : 'No school workspace exists. Create one as Super Admin first.');
  await pool.end(); process.exit(0);
}
const [[owner]] = await pool.query("SELECT u.id,u.name FROM emis_roles r JOIN users u ON u.id=r.user_id JOIN organizations o ON o.id=r.org_id WHERE r.org_id=? AND r.role='Super Admin' AND o.kind='school' LIMIT 1", [orgId]);
if (!owner) { console.error('That organization is not a school EMIS workspace with a Super Admin.'); process.exit(1); }
const user = { id: owner.id, name: owner.name, role: 'Super Admin' };
// A local, trusted script has no browser session; skip only the session re-check that tx() performs.
class ScriptDatabase extends MySQLDatabase {
  async tx(fn) { if (this.context.getStore()) return fn(); const c = await this.pool.getConnection(); try { await c.beginTransaction(); const v = await this.context.run(c, fn); await c.commit(); return v; } catch (e) { await c.rollback(); throw e; } finally { c.release(); } }
}
const store = new Store(new ScriptDatabase(pool, orgId, null, user));
const profile = await store.meta('profile'), year = profile.year;
const all0 = await store.all();
if (all0.classes.some((c) => c.year === year && c.name === 'Grade 6')) { console.error(`Grade 6 already exists in ${profile.name} for ${year}. Nothing was changed.`); process.exit(1); }

const created = [], startedAt = new Date(Date.now() - 1000).toISOString();
const save = async (entity, value, id = null) => { const r = await store.save(user, entity, { year, ...value }, id); if (!id) created.push(r.id); return r; };
let seed = 20832; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const iso = (d) => d.toISOString().slice(0, 10);

console.log(`Adding Grade 6 to ${profile.name} (${year})…`);
await store.tx(async () => {
  // People
  const dept = await save('departments', { name: 'Basic level (Grades 6–8)', code: 'BASIC-68', type: 'Academic', head: 'Head teacher' });
  const teacherData = [
    ['T-601', 'Sarita Adhikari', 'Female', 'Nepali'], ['T-602', 'Rajendra Shrestha', 'Male', 'English'], ['T-603', 'Bimala Gurung', 'Female', 'Mathematics'],
    ['T-604', 'Kamal Bhattarai', 'Male', 'Science and Technology'], ['T-605', 'Laxmi Tamang', 'Female', 'Social Studies'], ['T-606', 'Hari Thapa', 'Male', 'Health, Physical Education and Creative Arts'], ['T-607', 'Anita Maharjan', 'Female', 'Computer Science'],
  ];
  const teachers = {};
  for (const [no, name, gender, subject] of teacherData)
    teachers[subject] = await save('faculty', { employeeNo: no, name, gender, departmentId: dept.id, designation: 'Teacher', qualification: 'B.Ed.', specialization: subject, employment: 'Full-time', appointmentDate: '2022-04-14', status: 'Active' });
  for (const [subject, t] of Object.entries(teachers))
    await save('salaryStructures', { facultyId: t.id, basic: subject === 'Computer Science' ? 32000 : 36000, allowances: 3000, ssf: 'Yes', cit: 1000, tds: 600, status: 'Active' });

  // Classes and subjects (CDC Basic Education Curriculum 2077, Grades 6–8)
  const secA = await save('classes', { name: 'Grade 6', section: 'A', classTeacherId: teachers['Mathematics'].id, room: '6-A', capacity: 40, status: 'Active' });
  const secB = await save('classes', { name: 'Grade 6', section: 'B', classTeacherId: teachers['English'].id, room: '6-B', capacity: 40, status: 'Active' });
  const subjects = [
    ['Nepali', 'NEP-6', 'Compulsory', 5], ['English', 'ENG-6', 'Compulsory', 5], ['Mathematics', 'MTH-6', 'Compulsory', 5],
    ['Science and Technology', 'SCI-6', 'Compulsory', 5], ['Social Studies and Human Value Education', 'SOC-6', 'Compulsory', 5],
    ['Health, Physical Education and Creative Arts', 'HPC-6', 'Compulsory', 4], ['Local subject / Mother tongue', 'LOC-6', 'Compulsory', 4], ['Computer Science', 'CMP-6', 'Additional', 2],
  ];
  const subjectsBy = {};
  for (const cls of [secA, secB]) {
    subjectsBy[cls.id] = [];
    for (const [name, code, type, creditHours] of subjects) {
      const teacher = teachers[name] || teachers[name.startsWith('Social') ? 'Social Studies' : name.startsWith('Local') ? 'Nepali' : 'Nepali'];
      subjectsBy[cls.id].push(await save('subjects', { classId: cls.id, name, code, type, creditHours, theoryFull: 50, practicalFull: 50, teacherId: teacher.id, notes: 'Written examination 50 + internal (continuous) assessment 50.' }));
    }
  }

  // Transport
  const bus = await save('vehicles', { registrationNo: 'BA 2 KHA 4521', name: 'School bus 1', type: 'Bus', capacity: 40, driver: 'Ram Bahadur K.C.', driverPhone: '01-5550101', route: 'Kalanki – Balkhu – School', status: 'Active' });
  const routes = [
    await save('routes', { name: 'Route 1 · Kalanki', vehicleId: bus.id, stops: 'Kalanki Chowk\nKhasi Bazar\nBalkhu\nSchool gate', pickupTime: '07:30', dropTime: '15:45', monthlyFare: 1800, status: 'Active' }),
    await save('routes', { name: 'Route 2 · Kirtipur', vehicleId: bus.id, stops: 'Naya Bazar\nChobhar\nTaukhel\nSchool gate', pickupTime: '07:15', dropTime: '15:45', monthlyFare: 2000, status: 'Active' }),
  ];

  // Students (fictional)
  const girls = ['Aarati', 'Anjali', 'Bipana', 'Dikshya', 'Gita', 'Isha', 'Jenisha', 'Kritika', 'Manisha', 'Nirjala', 'Pratiksha', 'Rojina', 'Sabina', 'Sunita', 'Trishna', 'Yashoda'];
  const boys = ['Aayush', 'Bibek', 'Dipesh', 'Gaurav', 'Kiran', 'Manish', 'Nabin', 'Prabin', 'Rabin', 'Sagar', 'Sandesh', 'Sujan', 'Suraj', 'Utsav', 'Yubraj', 'Ashish'];
  const surnames = [['Shrestha', 'Janajati'], ['Gurung', 'Janajati'], ['Tamang', 'Janajati'], ['Adhikari', 'Brahmin / Chhetri'], ['Poudel', 'Brahmin / Chhetri'], ['K.C.', 'Brahmin / Chhetri'], ['Bishwokarma', 'Dalit'], ['Pariyar', 'Dalit'], ['Maharjan', 'Janajati'], ['Yadav', 'Madhesi'], ['Rai', 'Janajati'], ['Thapa', 'Brahmin / Chhetri']];
  const fathers = ['Ram', 'Shyam', 'Krishna', 'Bishnu', 'Gopal', 'Dhan', 'Mohan', 'Bal', 'Hari', 'Narayan'], mothers = ['Sita', 'Gita', 'Kamala', 'Maya', 'Radha', 'Parbati', 'Sarita', 'Laxmi', 'Durga', 'Bimala'];
  const students = [];
  for (let i = 0; i < 32; i++) {
    const cls = i < 16 ? secA : secB, girl = i % 2 === 0, first = (girl ? girls : boys)[Math.floor(i / 2)], [surname, ethnicity] = surnames[i % surnames.length];
    const onBus = i % 3 === 0, route = routes[i % 2], month = 1 + (i % 12), day = 1 + ((i * 7) % 28);
    students.push(await save('students', {
      studentNo: `WS-2083-${String(601 + i).padStart(4, '0')}`, name: `${first} ${surname}`, classId: cls.id, rollNo: (i % 16) + 1, gender: girl ? 'Female' : 'Male',
      dob: `2014-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, dobBs: `2070-${String(((month + 8) % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, birthRegNo: `BR-${27000 + i}`,
      address: pick(['Kalanki, Kathmandu', 'Kirtipur-3', 'Balkhu, Kathmandu', 'Chobhar, Kirtipur', 'Naya Bazar, Kirtipur']), province: 'Bagmati', district: pick(['Kathmandu', 'Kathmandu', 'Lalitpur']),
      fatherName: `${pick(fathers)} ${surname}`, fatherPhone: `01-555${String(1000 + i * 2).padStart(4, '0')}`, motherName: `${pick(mothers)} ${surname}`, motherPhone: `01-555${String(1001 + i * 2).padStart(4, '0')}`,
      guardian: `${pick(fathers)} ${surname}`, guardianPhone: `01-555${String(1000 + i * 2).padStart(4, '0')}`, guardianRelation: 'Father', previousSchool: i < 26 ? 'Whitefield School (Grade 5)' : 'Kirtipur Basic School',
      transport: onBus ? 'School bus' : pick(['Walk', 'Own arrangement']), routeId: onBus ? route.id : undefined, busRoute: onBus ? route.stops.split('\n')[i % 3] : undefined, lunch: i % 4 === 0 ? 'Yes' : 'No',
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'B+', 'O+']), nationality: 'Nepali', ethnicity, disability: i === 9 ? 'Visual' : 'None', economicStatus: i % 7 === 0 ? 'Disadvantaged' : 'General',
      admissionDate: i < 26 ? '2025-04-14' : '2026-04-15', status: 'Active',
    }));
  }
  await save('scholarships', { studentId: students[4].id, category: 'Merit', amount: 2250, percentage: 50, startDate: '2026-04-14', duration: 'Academic year', status: 'Approved', notes: 'Top of Grade 5 final examination.' });
  await save('scholarships', { studentId: students[6].id, category: 'Dalit', amount: 4500, percentage: 100, startDate: '2026-04-14', duration: 'Academic year', status: 'Approved' });

  // Examinations and marks: First Terminal published, Second Terminal open for marks
  const first = await save('terms', { name: 'First Terminal', startDate: '2026-07-20', resultDate: '2026-08-05', weight: 20, status: 'Published' });
  await save('terms', { name: 'Second Terminal', startDate: '2026-11-22', resultDate: '2026-12-07', weight: 30, status: 'Marks entry' });
  const ability = students.map((_, i) => i === 13 ? 0.32 : 0.5 + rnd() * 0.45);
  for (const [i, st] of students.entries()) {
    for (const sub of subjectsBy[st.classId]) {
      const a = Math.min(0.98, Math.max(0.2, ability[i] + (rnd() - 0.5) * 0.18));
      await save('marks', { studentId: st.id, termId: first.id, subjectId: sub.id, theory: Math.round(50 * a), practical: Math.min(50, Math.round(50 * Math.min(1, a + 0.12 + rnd() * 0.08))), absent: 'No', status: 'Published' });
    }
  }

  // Daily attendance for the last 15 school days (Sunday–Friday)
  const days = []; for (let d = new Date(); days.length < 15; d = new Date(d.getTime() - 864e5)) if (d.getUTCDay() !== 6 && iso(d) < iso(new Date())) days.push(iso(d));
  for (const date of days.reverse()) {
    for (const st of students) {
      const r = rnd(), status = st.name.startsWith('Prabin') && r < 0.35 ? 'Absent' : r < 0.05 ? 'Absent' : r < 0.08 ? 'Late' : r < 0.1 ? 'Leave' : 'Present';
      await save('schoolAttendance', { studentId: st.id, classId: st.classId, date, status });
    }
  }

  // Fee structure
  for (const cls of [secA, secB]) await save('feeHeads', { classId: cls.id, head: 'Tuition', amount: 4500, frequency: 'Monthly', appliesTo: 'All students' });
  await save('feeHeads', { head: 'Computer', amount: 300, frequency: 'Monthly', appliesTo: 'All students' });
  await save('feeHeads', { head: 'Transport', amount: 1800, frequency: 'Monthly', appliesTo: 'School bus users' });
  await save('feeHeads', { head: 'Lunch', amount: 2200, frequency: 'Monthly', appliesTo: 'Lunch users' });
  await save('feeHeads', { head: 'Examination', amount: 900, frequency: 'Each terminal', appliesTo: 'All students' });
  await save('feeHeads', { head: 'Annual charge', amount: 6000, frequency: 'Annual', appliesTo: 'All students' });

  // Homework, notices, a leave note, a library book
  const sub = (cls, name) => subjectsBy[cls.id].find((s) => s.name === name);
  const hw1 = await save('homework', { classId: secA.id, subjectId: sub(secA, 'Mathematics').id, name: 'Exercise 4.2 — fractions', details: 'Questions 1 to 10 in the exercise book. Show your working.', type: 'Homework', assignedDate: days[days.length - 3], dueDate: days[days.length - 1], status: 'Assigned' });
  await save('homework', { classId: secA.id, subjectId: sub(secA, 'Science and Technology').id, name: 'Parts of a flower — labelled drawing', details: 'Draw and label a mustard flower. Bring it to class.', type: 'Project', assignedDate: days[days.length - 1], dueDate: iso(new Date(Date.now() + 5 * 864e5)), status: 'Assigned' });
  await save('homework', { classId: secB.id, subjectId: sub(secB, 'English').id, name: 'Write a letter to a friend', details: 'About 150 words: describe your Tihar holiday.', type: 'Homework', assignedDate: days[days.length - 1], dueDate: iso(new Date(Date.now() + 2 * 864e5)), status: 'Assigned' });
  for (const st of students.filter((s) => s.classId === secA.id)) await save('homeworkChecks', { homeworkId: hw1.id, studentId: st.id, status: rnd() < 0.8 ? 'Done' : rnd() < 0.5 ? 'Incomplete' : 'Not submitted' });
  await save('notices', { name: 'Second Terminal examination routine', body: 'The Second Terminal examination for Grades 6–8 begins on Mangsir 6. The routine is posted on the notice board and sent home with students.', audience: 'Everyone', publishDate: days[days.length - 2], priority: 'Important', sms: 'No', status: 'Published' });
  await save('notices', { name: 'Grade 6 science excursion', body: 'Grade 6 visits the Natural History Museum, Swayambhu, next Friday. Please send the signed consent slip by Wednesday.', audience: 'Parents', publishDate: days[days.length - 1], priority: 'Normal', sms: 'Yes', status: 'Published' });
  await save('leaveRequests', { studentId: students[10].id, fromDate: iso(new Date(Date.now() + 864e5)), toDate: iso(new Date(Date.now() + 2 * 864e5)), reason: 'Family puja at our home village.', status: 'Pending' });
  await save('library', { name: 'Muna Madan — Laxmi Prasad Devkota', accessionNo: 'LIB-0001', type: 'Book', author: 'Laxmi Prasad Devkota', copies: 3, status: 'Available' });
  await save('library', { name: 'Science and Technology, Grade 6 (CDC)', accessionNo: 'LIB-0002', type: 'Book', author: 'Curriculum Development Centre', copies: 5, status: 'Available' });
});

// Bills from Baishakh to Kartik through the real billing workflow, then payments for the earlier months.
for (const [i, month] of ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik'].entries()) {
  const all = await store.all(), classIds = all.classes.filter((c) => c.year === year && c.name === 'Grade 6').map((c) => c.id);
  const exam = all.feeHeads.filter((h) => h.year === year && h.head === 'Examination').map((h) => h.id), annual = all.feeHeads.filter((h) => h.year === year && h.head === 'Annual charge').map((h) => h.id);
  const due = `2026-${String(4 + i).padStart(2, '0')}-25`;
  const r = await schoolRoute(store, user, '/api/school/billing/apply', 'POST', async () => ({ year, month, dueDate: due, classIds, occasional: [...(month === 'Shrawan' ? exam : []), ...(month === 'Baishakh' ? annual : [])] }));
  console.log(`  ${month}: ${r.created} bills`);
}
await store.tx(async () => {
  const all = await store.all(); let n = 1;
  for (const inv of all.fees.filter((f) => f.year === year && f.billingPeriod)) {
    const month = inv.billingPeriod.split(' ')[1], late = ['Ashwin', 'Kartik'].includes(month), skip = late && (n % 3 !== 0);
    if (skip || (month === 'Bhadra' && n % 9 === 0)) { n++; continue; }
    await save('payments', { receiptNo: `RC-2083-${String(n++).padStart(5, '0')}`, invoiceId: inv.id, amount: inv.amount, date: inv.dueDate, method: pick(['Cash', 'Cash', 'Bank transfer', 'eSewa']), reference: '' });
  }
});
await pool.query('UPDATE emis_records SET sample=1 WHERE org_id=? AND created_at>=?', [orgId, startedAt]);
const [[count]] = await pool.query('SELECT COUNT(*) n FROM emis_records WHERE org_id=? AND sample=1', [orgId]);
console.log(`Done. ${count.n} sample records in ${profile.name}.`);
await pool.end();
