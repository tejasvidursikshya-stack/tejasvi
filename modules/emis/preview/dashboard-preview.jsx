// Offline preview of the EMIS role dashboards with generated sample data.
// Uses the real RoleHome components and the real record-scoping rules, so each
// role sees what the server would give it. Nothing here touches a database.
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RoleHome from '../src/RoleHome.jsx';
import { modules, scopeRecord, titleOf, globalModules } from '../shared/schema.mjs';
import { canViewInstitution } from '../shared/access.mjs';
import { campusNow } from '../src/dashboard-model.mjs';

const YEAR = '2026/27';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRecords() {
  const r = rng(42), today = campusNow().date, todayName = campusNow().day;
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const y = (o) => ({ year: YEAR, ...o });
  const departments = [{ id: 'd1', name: 'Management', code: 'MGT' }, { id: 'd2', name: 'Computing', code: 'CMP' }];
  const programs = [
    { id: 'p1', name: 'Bachelor of Business Administration', code: 'BBA', departmentId: 'd1', status: 'Active' },
    { id: 'p2', name: 'Bachelor of Computer Applications', code: 'BCA', departmentId: 'd2', status: 'Active' },
    { id: 'p3', name: 'BSc Computer Science & IT', code: 'BSc CSIT', departmentId: 'd2', status: 'Active' },
    { id: 'p4', name: 'Bachelor of Business Studies', code: 'BBS', departmentId: 'd1', status: 'Active' },
  ];
  const facultyNames = ['Sita Rai', 'Ramesh Adhikari', 'Gita Thapa', 'Hari Shrestha', 'Maya Gurung', 'Bijay Karki'];
  const faculty = facultyNames.map((name, i) => ({ id: `f${i + 1}`, name, employeeNo: `EMP-${101 + i}`, departmentId: i < 3 ? 'd1' : 'd2', designation: 'Lecturer', employment: i < 4 ? 'Full-time' : 'Part-time', status: 'Active', gender: i % 2 ? 'Male' : 'Female' }));
  const courses = [
    y({ id: 'c1', name: 'Accounting I', code: 'ACC101', programId: 'p1', semester: 3, credits: 3, facultyId: 'f1', status: 'Active' }),
    y({ id: 'c2', name: 'Business Statistics', code: 'STA201', programId: 'p1', semester: 3, credits: 3, facultyId: 'f1', status: 'Active' }),
    y({ id: 'c3', name: 'Principles of Marketing', code: 'MKT201', programId: 'p1', semester: 3, credits: 3, facultyId: 'f2', status: 'Active' }),
    y({ id: 'c4', name: 'Business Communication', code: 'COM201', programId: 'p1', semester: 3, credits: 3, facultyId: 'f3', status: 'Active' }),
    y({ id: 'c5', name: 'Programming in C', code: 'CSC101', programId: 'p2', semester: 1, credits: 4, facultyId: 'f4', status: 'Active' }),
    y({ id: 'c6', name: 'Data Structures', code: 'CSC201', programId: 'p3', semester: 3, credits: 4, facultyId: 'f5', status: 'Active' }),
    y({ id: 'c7', name: 'Cost Accounting', code: 'ACC202', programId: 'p4', semester: 2, credits: 3, facultyId: 'f1', status: 'Active' }),
  ];
  const first = ['Anisha', 'Rohan', 'Sneha', 'Kiran', 'Manisha', 'Aarav', 'Priya', 'Nabin', 'Suman', 'Asmita', 'Bibek', 'Pooja', 'Sanjay', 'Rita', 'Dipesh', 'Kabita', 'Prakash', 'Sunita', 'Roshan', 'Anjali'];
  const last = ['Gurung', 'Bhandari', 'Maharjan', 'Tamang', 'Poudel', 'Karki', 'Shrestha', 'Thapa', 'KC', 'Rai'];
  const plan = [['p1', 3, 24], ['p2', 1, 14], ['p3', 3, 12], ['p4', 2, 10]];
  const students = [];
  let n = 0;
  for (const [programId, semester, count] of plan) for (let i = 0; i < count; i++) {
    n++;
    students.push(y({ id: `s${n}`, studentNo: `UC-2025-${String(n).padStart(4, '0')}`, name: n === 1 ? 'Anisha Gurung' : `${first[n % first.length]} ${last[(n * 7) % last.length]}`, programId, semester, batch: '2025', gender: n % 2 ? 'Female' : 'Male', status: n % 23 === 0 ? 'On leave' : 'Active' }));
  }
  const inCourse = (c) => students.filter((s) => s.programId === c.programId && s.semester === c.semester);
  const slots = [['08:00', '09:00', 'c2', 'Room 105'], ['10:00', '11:00', 'c1', 'Room 204'], ['11:15', '12:15', 'c3', 'Room 301'], ['13:00', '14:00', 'c5', 'Lab 2'], ['14:30', '15:30', 'c4', ''], ['15:30', '16:30', 'c7', 'Room 210']];
  const timetable = slots.map(([startTime, endTime, courseId, room], i) => y({ id: `t${i + 1}`, courseId, day: todayName, startTime, endTime, room: room || 'Online', mode: room ? 'In-person' : 'Online', link: room ? '' : 'https://meet.example.edu.np/com201' }));
  DAYS.filter((d) => d !== todayName && d !== 'Saturday').forEach((d, i) => courses.forEach((c, j) => { if ((i + j) % 2 === 0) timetable.push(y({ id: `t-${d}-${c.id}`, courseId: c.id, day: d, startTime: ['09:00', '11:00', '13:00'][j % 3], endTime: ['10:00', '12:00', '14:00'][j % 3], room: `Room ${200 + j}`, mode: 'In-person' })); }));
  const attendance = [];
  for (const c of courses) for (let d = 14; d >= 1; d--) {
    const date = day(-d);
    if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
    for (const s of inCourse(c)) {
      const weak = s.id === 's7' || s.id === 's12';
      const roll = r();
      const status = s.id === 's9' && d <= 3 ? 'Absent' : roll < (weak ? 0.45 : 0.05) ? 'Absent' : roll < (weak ? 0.5 : 0.09) ? 'Late' : roll < 0.11 ? 'Excused' : 'Present';
      attendance.push(y({ id: `a-${c.id}-${s.id}-${date}`, studentId: s.id, courseId: c.id, date, status }));
    }
  }
  for (const s of inCourse(courses[1])) attendance.push(y({ id: `a-today-${s.id}`, studentId: s.id, courseId: 'c2', date: today, status: r() < 0.9 ? 'Present' : 'Absent' }));
  const exams = [
    y({ id: 'e1', name: 'Internal 1', courseId: 'c1', type: 'Internal', date: day(-24), maxMarks: 50, passMarks: 20, status: 'Published' }),
    y({ id: 'e2', name: 'Practical', courseId: 'c2', type: 'Practical', date: day(-18), maxMarks: 25, passMarks: 10, status: 'Published' }),
    y({ id: 'e3', name: 'Term test', courseId: 'c3', type: 'Internal', date: day(-12), maxMarks: 50, passMarks: 20, status: 'Published' }),
    y({ id: 'e4', name: 'Internal 2', courseId: 'c1', type: 'Internal', date: day(-4), maxMarks: 50, passMarks: 20, status: 'Completed' }),
    y({ id: 'e5', name: 'Quiz', courseId: 'c2', type: 'Internal', date: day(-2), maxMarks: 20, passMarks: 8, status: 'Completed' }),
    y({ id: 'e6', name: 'Internal 2', courseId: 'c3', type: 'Internal', date: day(4), time: '10:00', room: 'Hall A', maxMarks: 50, passMarks: 20, status: 'Scheduled' }),
    y({ id: 'e7', name: 'Pre-board', courseId: 'c2', type: 'Pre-board', date: day(11), time: '13:00', room: 'Hall B', maxMarks: 100, passMarks: 40, status: 'Scheduled' }),
    y({ id: 'e8', name: 'Midterm', courseId: 'c5', type: 'Internal', date: day(6), time: '09:00', room: 'Lab 2', maxMarks: 50, passMarks: 20, status: 'Scheduled' }),
  ];
  const results = [];
  for (const e of exams.filter((x) => x.date < today)) {
    const c = courses.find((x) => x.id === e.courseId), list = inCourse(c);
    const entered = e.status === 'Published' ? list : list.slice(0, Math.ceil(list.length * (e.id === 'e4' ? 0.45 : 0.7)));
    for (const s of entered) {
      const base = s.id === 's12' ? 0.3 : s.id === 's1' ? 0.84 : 0.45 + r() * 0.5;
      const marks = Math.round(e.maxMarks * base);
      results.push(y({ id: `r-${e.id}-${s.id}`, studentId: s.id, examId: e.id, marks, gradePoint: Math.min(4, Math.round(base * 40) / 10), status: e.status === 'Published' ? 'Published' : 'Draft' }));
    }
  }
  const fees = [], payments = [];
  students.forEach((s, i) => {
    const amount = s.programId === 'p3' ? 42000 : 37000;
    const inv1 = y({ id: `inv-${s.id}-1`, invoiceNo: `INV-2026-${String(100 + i).padStart(4, '0')}`, studentId: s.id, category: 'Tuition', amount, dueDate: day(-60) });
    const inv2 = y({ id: `inv-${s.id}-2`, invoiceNo: `INV-2026-${String(400 + i).padStart(4, '0')}`, studentId: s.id, category: 'Tuition', amount: Math.round(amount / 2), dueDate: i % 3 === 0 ? day(-(5 + i)) : day(4 + (i % 10)) });
    fees.push(inv1, inv2);
    const paidFirst = i % 9 !== 0;
    if (paidFirst) payments.push(y({ id: `pay-${s.id}-1`, receiptNo: `R-2026-${String(100 + i).padStart(4, '0')}`, invoiceId: inv1.id, amount, date: day(-(55 + (i % 30))), method: pick(['Cash', 'Bank transfer', 'Online']) }));
    else if (i % 2) payments.push(y({ id: `pay-${s.id}-1p`, receiptNo: `R-2026-${String(300 + i).padStart(4, '0')}`, invoiceId: inv1.id, amount: Math.round(amount * 0.4), date: day(-40), method: 'Cash' }));
    if (i % 3 !== 0 && i % 4 === 1) payments.push(y({ id: `pay-${s.id}-2`, receiptNo: `R-2026-${String(500 + i).padStart(4, '0')}`, invoiceId: inv2.id, amount: inv2.amount, date: i % 8 === 1 ? today : day(-(i % 20)), method: pick(['Bank transfer', 'Online', 'Cash']) }));
  });
  const transactions = [];
  for (let m = 0; m < 6; m++) {
    transactions.push(y({ id: `tx-in-${m}`, reference: `V-IN-${m}`, name: 'Grant and other income', type: 'Income', category: 'Grant', amount: 60000 + m * 5000, date: day(-m * 30 - 5) }));
    transactions.push(y({ id: `tx-ex-${m}`, reference: `V-EX-${m}`, name: 'Salaries and operations', type: 'Expenditure', category: 'Salary', amount: 210000 + m * 8000, date: day(-m * 30 - 3) }));
  }
  const admissions = ['Applied', 'Applied', 'Under review', 'Under review', 'Applied', 'Accepted', 'Enrolled', 'Waitlisted', 'Rejected', 'Applied'].map((status, i) => y({ id: `ad${i}`, applicationNo: `APP-${300 + i}`, name: `${first[(i * 3) % first.length]} ${last[i % last.length]}`, programId: programs[i % 4].id, status, applicationDate: day(-i * 3) }));
  const evidence = ['Missing', 'Missing', 'In progress', 'Verified', 'Verified', 'Verified', 'Ready for review', 'Missing'].map((status, i) => y({ id: `ev${i}`, name: `Criterion ${1 + (i % 7)} evidence`, criterion: `C${1 + (i % 7)}`, indicator: 'Documented', unit: 'IQAC', source: 'Institution', status }));
  const grievances = [y({ id: 'g1', studentId: 's3', name: 'Library card not issued', category: 'Facilities', date: day(-12), description: 'Waiting since admission.', status: 'Open' }), y({ id: 'g2', studentId: 's5', name: 'Fee receipt correction', category: 'Fees', date: day(-9), description: 'Wrong amount on receipt.', status: 'Under review' }), y({ id: 'g3', studentId: 's1', name: 'Timetable clash', category: 'Academic', date: day(-2), description: 'Two classes at 11:00 on Monday.', status: 'Open' })];
  const scholarships = [y({ id: 'sc1', studentId: 's2', category: 'Merit', amount: 18500, status: 'Disbursed' }), y({ id: 'sc2', studentId: 's8', category: 'Need-based', amount: 12000, status: 'Renewal due' }), y({ id: 'sc3', studentId: 's15', category: 'Dalit', amount: 15000, status: 'Approved' })];
  const actions = [y({ id: 'ac1', name: 'Update library e-resources', gap: 'Low usage', action: 'Subscribe', owner: 'Library', deadline: day(-3), priority: 'High', status: 'In progress' })];
  const records = Object.fromEntries(Object.keys(modules).map((k) => [k, []]));
  return Object.assign(records, { departments, programs, faculty, courses, students, timetable, attendance, exams, results, fees, payments, transactions, admissions, evidence, grievances, scholarships, actions });
}

const PEOPLE = {
  'Super Admin': { name: 'Krishna Pandey' },
  Faculty: { name: 'Sita Rai', facultyId: 'f1' },
  Student: { name: 'Anisha Gurung', studentId: 's1' },
  'Finance Head': { name: 'Bikash Sharma' },
  'Exam Coordinator': { name: 'Gopal Joshi' },
  'Student Affairs': { name: 'Laxmi Bista' },
  'Campus Chief': { name: 'Dr. Ram Prasad' },
};

function Preview() {
  const all = useMemo(sampleRecords, []);
  const [role, setRole] = useState('Super Admin');
  const [note, setNote] = useState('');
  const user = { id: 'u1', role, ...PEOPLE[role] };
  const records = useMemo(() => Object.fromEntries(Object.entries(all).map(([k, rows]) => [k, rows.filter((row) => scopeRecord(user, k, row, all))])), [all, role]);
  const say = (text) => { setNote(text); clearTimeout(window.__t); window.__t = setTimeout(() => setNote(''), 2600); };
  const ctx = {
    data: { learning: true, suite: true },
    records,
    rows: (k) => (records[k] || []).filter((row) => globalModules.includes(k) || row.year === YEAR),
    year: YEAR,
    user,
    profile: { year: YEAR, name: 'United College', kind: 'college' },
    allAccess: canViewInstitution(role),
    label: (entity, id) => titleOf(all[entity]?.find((x) => x.id === id)),
    go: (page) => say(`Would open ${modules[page]?.title || page}`),
    setDrawer: ({ entity, record }) => say(`Would open ${record ? 'a' : 'a new'} ${modules[entity]?.singular?.toLowerCase() || entity} form`),
    setDialog: ({ type, courseId }) => say(type === 'attendance' ? `Would open Take attendance${courseId ? ` for ${titleOf(all.courses.find((c) => c.id === courseId))}` : ''}` : `Would open ${type}`),
    openLearning: () => say('Would open Tejasvi Learning'),
  };
  return (
    <>
      <header className="pv-bar">
        <strong>EMIS dashboards · sample data</strong>
        <label>View as<select value={role} onChange={(e) => setRole(e.target.value)}>{Object.keys(PEOPLE).map((r) => <option key={r}>{r}</option>)}</select></label>
      </header>
      <main className="pv-main"><RoleHome key={role} ctx={ctx} details={() => say('Would open Reports & details')} /></main>
      {note && <div className="pv-note" role="status">{note}</div>}
    </>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
