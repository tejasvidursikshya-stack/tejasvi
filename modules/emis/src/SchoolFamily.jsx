import React, { useEffect, useMemo, useState } from 'react';
import { Letterhead, LetterFooter, PrintHeader, PrintFooter, logoSrc } from './Letterhead.jsx';
import { academicYearLabel, bsYearOf, normalizeAcademicYear } from '../shared/bs.mjs';
import QRCode from 'qrcode';
import { CheckCheck, ClipboardList, Award, Wallet, Printer, Save, Bus, BookOpen, Megaphone, CalendarDays, CircleAlert, Users, LibraryBig, Download, Send, IdCard, Receipt, MessageSquare, ArrowRight, UserPlus, Trash2, CreditCard, GraduationCap } from 'lucide-react';
import { can, invoiceBalance } from '../shared/schema.mjs';
import { ComingUp } from './SchoolOps.jsx';
import { canManageUsers } from '../shared/access.mjs';
import { sortClasses, classLabel, classStudents, gradeSheets, attendanceSummary, MONTHS_BS, loanFine, flashCounts, rollSort } from '../shared/school.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const npr = (v) => 'NPR ' + new Intl.NumberFormat('en-IN').format(Math.round(v || 0));
const by = (list, id) => list.find((x) => x.id === id);
function Header({ eyebrow, title, text, children }) {
  return <div className="sp-head"><div><span className="sp-eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <div className="sp-head-actions">{children}</div>}</div>;
}
function Empty({ ctx, title, text, go, action }) {
  return <div className="sp-empty"><span><CircleAlert size={22} /></span><strong>{title}</strong><p>{text}</p>{go && can(ctx.user.role, go, 'write') && <button className="sp-btn sp-go" onClick={() => ctx.go(go)}>{action} <ArrowRight size={16} /></button>}</div>;
}
const Field = ({ label, children }) => <label className="sp-field"><span>{label}</span>{children}</label>;
const Err = ({ error }) => error ? <p className="sp-error" role="alert"><CircleAlert size={16} /> {error}</p> : null;
const Tile = ({ tone, value, label, onClick }) => onClick ? <button className={'sp-tile tone-' + tone} onClick={onClick}><strong>{value}</strong><span>{label}</span></button> : <div className={'sp-tile tone-' + tone}><strong>{value}</strong><span>{label}</span></div>;
const isFamily = (ctx) => ['Student', 'Parent'].includes(ctx.user.role);
function useBusy() { const [busy, setBusy] = useState(false), [error, setError] = useState(''); const run = async (fn) => { setBusy(true); setError(''); try { return await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } }; return { busy, error, run, setError }; }

/* ------------------------------------------------------------ Notices */
function activeNotices(ctx) {
  const t = today();
  return ctx.rows('notices').filter((n) => n.status === 'Published' && (!n.publishDate || n.publishDate <= t) && (!n.expiresDate || n.expiresDate >= t))
    .sort((a, b) => ['Urgent', 'Important', 'Normal'].indexOf(a.priority) - ['Urgent', 'Important', 'Normal'].indexOf(b.priority) || b.publishDate.localeCompare(a.publishDate));
}
export function NoticeBoard({ ctx, limit = 5 }) {
  const list = activeNotices(ctx).slice(0, limit);
  return <section className="sp-card"><div className="sp-card-head"><h2><Megaphone size={18} /> Notices</h2>{can(ctx.user.role, 'notices') && <button className="sp-link" onClick={() => ctx.go('notices')}>All notices</button>}</div>
    {list.length ? <ul className="sp-notices">{list.map((n) => <li key={n.id} className={'pr-' + n.priority.toLowerCase()}><div><b>{n.name}</b>{n.priority !== 'Normal' && <span className={'sp-pill ' + (n.priority === 'Urgent' ? 'red' : 'amber')}>{n.priority}</span>}</div><p>{n.body}</p><small>{n.publishDate}{n.audience === 'One class' ? ' · ' + classLabel(by(ctx.rows('classes'), n.classId)) : ' · ' + n.audience}</small></li>)}</ul> : <p className="sp-muted">No notices right now.</p>}
  </section>;
}

/* ------------------------------------------------------------ Parent / student home */
export function FamilyHome({ ctx, api }) {
  const kids = ctx.rows('students').sort(rollSort), [childId, setChild] = useState(''), child = by(kids, childId) || kids[0];
  const parent = ctx.user.role === 'Parent', { busy, error, run } = useBusy();
  if (!child) return <Empty ctx={ctx} title="No student record for this year" text="Ask the school office to check the academic year on the student record." />;
  const cls = by(ctx.rows('classes'), child.classId);
  const att = attendanceSummary(ctx.rows('schoolAttendance'), child.id);
  const todayMark = ctx.rows('schoolAttendance').find((a) => a.studentId === child.id && a.date === today());
  const invoices = ctx.rows('fees').filter((f) => f.studentId === child.id).map((f) => ({ ...f, ...invoiceBalance(f, ctx.records.payments || []) }));
  const due = invoices.filter((f) => f.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const owed = due.reduce((a, f) => a + f.balance, 0);
  const checks = ctx.rows('homeworkChecks').filter((x) => x.studentId === child.id);
  const homework = ctx.rows('homework').filter((h) => h.classId === child.classId && h.status === 'Assigned' && (!h.dueDate || h.dueDate >= today())).sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const terms = ctx.rows('terms').filter((t) => t.status === 'Published'), lastTerm = terms[terms.length - 1];
  const sheet = lastTerm && cls ? gradeSheets(ctx.records, { classId: cls.id, termId: lastTerm.id, year: ctx.year, publishedOnly: true }).sheets.find((s) => s.student.id === child.id) : null;
  const leaves = ctx.rows('leaveRequests').filter((l) => l.studentId === child.id).sort((a, b) => b.fromDate.localeCompare(a.fromDate)).slice(0, 4);
  const subjectName = (id) => by(ctx.rows('subjects'), id)?.name || 'Subject';
  async function pay(inv) {
    await run(async () => {
      const r = await api('/school/pay/esewa/start', 'POST', { invoiceId: inv.id });
      const form = document.createElement('form'); form.method = 'POST'; form.action = r.action;
      for (const [k, v] of Object.entries(r.fields)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); }
      document.body.appendChild(form); form.submit();
    });
  }
  return <div className="sp-page">
    <section className="sp-hero">
      <div className="sp-hero-copy"><span className="sp-eyebrow light">{ctx.profile.name}</span><h1>{parent ? `${child.name.split(' ')[0]}’s school day` : `Hello, ${child.name.split(' ')[0]}`}</h1>
        <p>{classLabel(cls)} · Roll {child.rollNo || '—'} · {todayMark ? <b>Today: {todayMark.status}</b> : 'Today’s attendance is not taken yet'}</p></div>
      {kids.length > 1 && <div className="sp-kids" role="group" aria-label="Choose child">{kids.map((k) => <button key={k.id} aria-pressed={k.id === child.id} onClick={() => setChild(k.id)}>{k.name.split(' ')[0]}</button>)}</div>}
    </section>
    <div className="sp-tiles">
      <Tile tone="teal" value={att.rate === null ? '—' : att.rate + '%'} label={`Attendance · ${att.absent} absent`} onClick={() => ctx.go('my-attendance')} />
      <Tile tone="blue" value={homework.length} label="Homework due" onClick={() => ctx.go('homework')} />
      <Tile tone="purple" value={sheet?.summary.gpa != null ? sheet.summary.gpa.toFixed(2) : '—'} label={lastTerm ? `GPA · ${lastTerm.name}` : 'No published results yet'} onClick={() => ctx.go('school-results')} />
      <Tile tone={owed ? 'rose' : 'teal'} value={owed ? npr(owed) : 'Paid'} label={owed ? `${due.length} fee bill${due.length === 1 ? '' : 's'} due` : 'No fees due'} onClick={() => ctx.go('fees')} />
    </div>
    <div className="sp-two">
      <section className="sp-card"><div className="sp-card-head"><h2><BookOpen size={18} /> Homework</h2></div>
        {homework.length ? <ul className="sp-list">{homework.slice(0, 6).map((h) => { const c = checks.find((x) => x.homeworkId === h.id); return <li key={h.id}><div><b>{h.name}</b><small>{subjectName(h.subjectId)} · {h.type}{h.dueDate ? ' · due ' + h.dueDate : ''}</small>{h.details && <p>{h.details}</p>}</div>{c && <span className={'sp-pill ' + (c.status === 'Done' ? 'green' : 'amber')}>{c.status}</span>}</li>; })}</ul> : <p className="sp-muted">No homework due.</p>}
      </section>
      <section className="sp-card"><div className="sp-card-head"><h2><Wallet size={18} /> Fees</h2><button className="sp-link" onClick={() => ctx.go('fees')}>All bills</button></div>
        {due.length ? <ul className="sp-list">{due.slice(0, 4).map((f) => <li key={f.id}><div><b>{f.billingPeriod || f.category}</b><small>{f.invoiceNo} · due {f.dueDate}</small></div><div className="sp-right"><b>{npr(f.balance)}</b>{ctx.data.onlinePayment && <button className="sp-btn sp-esewa" disabled={busy} onClick={() => pay(f)}><CreditCard size={15} /> Pay with eSewa</button>}</div></li>)}</ul> : <p className="sp-muted">Everything is paid. Thank you.</p>}
        {ctx.data.onlinePayment?.test && <p className="sp-note">eSewa is in test mode: no real money moves.</p>}
        <Err error={error} />
      </section>
    </div>
    <ComingUp ctx={ctx} child={child} />
    <div className="sp-two">
      <NoticeBoard ctx={ctx} />
      <section className="sp-card"><div className="sp-card-head"><h2><CalendarDays size={18} /> Leave notes</h2>{parent && <button className="sp-btn sp-go" onClick={() => ctx.setDrawer({ entity: 'leaveRequests', defaults: { studentId: child.id, status: 'Pending', fromDate: today(), toDate: today() } })}>Send a leave note</button>}</div>
        {leaves.length ? <ul className="sp-list">{leaves.map((l) => <li key={l.id}><div><b>{l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`}</b><small>{l.reason}</small>{l.response && <p>School: {l.response}</p>}</div><span className={'sp-pill ' + (l.status === 'Approved' ? 'green' : l.status === 'Rejected' ? 'red' : 'amber')}>{l.status}</span></li>)}</ul> : <p className="sp-muted">{parent ? 'If your child will miss school, send a leave note to the class teacher.' : 'No leave notes.'}</p>}
      </section>
    </div>
  </div>;
}

/* ------------------------------------------------------------ Staff school home */
export function SchoolHome({ ctx }) {
  const role = ctx.user.role, classes = ctx.rows('classes'), students = ctx.rows('students').filter((s) => s.status === 'Active');
  const marked = ctx.rows('schoolAttendance').filter((a) => a.date === today());
  const present = marked.filter((a) => ['Present', 'Late'].includes(a.status)).length;
  const fees = ctx.rows('fees').map((f) => ({ ...f, ...invoiceBalance(f, ctx.records.payments || []) }));
  const owed = fees.reduce((a, f) => a + Math.max(0, f.balance), 0);
  const pendingLeave = ctx.rows('leaveRequests').filter((l) => l.status === 'Pending').length;
  const takenClasses = new Set(marked.map((a) => a.classId)), notTaken = classes.filter((c) => c.status !== 'Closed' && !takenClasses.has(c.id) && students.some((s) => s.classId === c.id));
  const actions = [['school-attendance', 'Take attendance', CheckCheck, 'schoolAttendance'], ['school-homework', 'Check homework', BookOpen, 'homeworkChecks'], ['school-marks', 'Enter marks', ClipboardList, 'marks'], ['school-billing', 'Monthly billing', Wallet, 'fees'], ['school-library', 'Library desk', LibraryBig, 'loans'], ['school-bus', 'Bus attendance', Bus, 'busAttendance'], ['school-payroll', 'Payroll', Receipt, 'payslips'], ['school-certificates', 'Certificates', Award, 'certificates'], ['school-staff-attendance', 'Staff attendance', Users, 'staffAttendance'], ['school-routine', 'Class routine', CalendarDays, 'routine'], ['school-collection', 'Fee desk & dues', Wallet, 'advances'], ['school-messages', 'Messages', MessageSquare, 'messages']].filter(([, , , e]) => can(role, e, 'write'));
  const hour = new Date().getHours();
  return <div className="sp-page">
    <section className="sp-hero"><div className="sp-hero-copy"><span className="sp-eyebrow light">{ctx.profile.name} · {academicYearLabel(ctx.year)}</span><h1>{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, {ctx.user.name.split(' ')[0]}</h1>
      <p>{notTaken.length ? `${notTaken.length} class${notTaken.length === 1 ? ' has' : 'es have'} not taken attendance today.` : marked.length ? 'Attendance is taken for every class today.' : 'Here is your school at a glance.'}</p></div>
      {actions.length > 0 && <div className="sp-hero-actions">{actions.slice(0, 4).map(([k, label, Icon], i) => <button key={k} className={i ? 'sp-qa' : 'sp-qa primary'} onClick={() => ctx.go(k)}><Icon size={17} /> {label}</button>)}</div>}
    </section>
    <div className="sp-tiles">
      <Tile tone="blue" value={students.length} label={`Students · ${classes.length} classes`} onClick={can(role, 'students') ? () => ctx.go('students') : undefined} />
      <Tile tone="teal" value={marked.length ? Math.round((present / marked.length) * 100) + '%' : '—'} label="Present today" onClick={can(role, 'schoolAttendance', 'write') ? () => ctx.go('school-attendance') : undefined} />
      <Tile tone="rose" value={can(role, 'fees') ? npr(owed) : '—'} label="Fees outstanding" onClick={can(role, 'fees') ? () => ctx.go('fees') : undefined} />
      <Tile tone="purple" value={pendingLeave} label="Leave notes to review" onClick={can(role, 'leaveRequests') ? () => ctx.go('leaveRequests') : undefined} />
    </div>
    <div className="sp-two">
      {notTaken.length > 0 && can(role, 'schoolAttendance', 'write') ? <section className="sp-card"><div className="sp-card-head"><h2><CheckCheck size={18} /> Attendance not taken today</h2></div><ul className="sp-list">{sortClasses(notTaken).slice(0, 8).map((c) => <li key={c.id}><div><b>{classLabel(c)}</b><small>{students.filter((s) => s.classId === c.id).length} students</small></div><button className="sp-btn" onClick={() => ctx.go('school-attendance')}>Take it</button></li>)}</ul></section>
        : <section className="sp-card"><div className="sp-card-head"><h2>More tools</h2></div><div className="sp-actions">{actions.slice(4).map(([k, label, Icon]) => <button key={k} className="sp-btn" onClick={() => ctx.go(k)}><Icon size={16} /> {label}</button>)}{!actions.length && <p className="sp-muted">Open a register from the menu.</p>}</div></section>}
      <NoticeBoard ctx={ctx} />
    </div>
  </div>;
}

/* ------------------------------------------------------------ Homework checking */
export function HomeworkCheck({ ctx, api }) {
  const list = ctx.rows('homework').sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));
  const [hwId, setHw] = useState(''), hw = by(list, hwId) || list[0];
  const students = hw ? classStudents(ctx.records, hw.classId, ctx.year) : [];
  const saved = useMemo(() => Object.fromEntries(ctx.rows('homeworkChecks').filter((x) => x.homeworkId === hw?.id).map((x) => [x.studentId, x.status])), [ctx.records, hw?.id]);
  const [edits, setEdits] = useState({}), { busy, error, run } = useBusy();
  useEffect(() => setEdits({}), [hw?.id]);
  if (!list.length) return <><Header eyebrow="Homework" title="Check homework" /><Empty ctx={ctx} title="No assignments yet" text="Add homework or classwork for a class and subject, then check who completed it here." go="homework" action="Add homework" /></>;
  const status = (id) => edits[id] || saved[id] || 'Done';
  const save = () => run(async () => { const r = await api('/school/homework-checks', 'POST', { year: ctx.year, homeworkId: hw.id, rows: students.map((s) => ({ studentId: s.id, status: status(s.id) })) }); await ctx.changed(`Homework checked for ${r.saved} student${r.saved === 1 ? '' : 's'}.`); setEdits({}); });
  const opts = [['Done', 'Done'], ['Incomplete', 'Part'], ['Not submitted', 'None']];
  return <div className="sp-page">
    <Header eyebrow="Homework" title="Check homework" text="Everyone starts as done. Mark who submitted part of it or nothing, then save.">
      <Field label="Assignment"><select value={hw.id} onChange={(e) => setHw(e.target.value)}>{list.map((h) => <option key={h.id} value={h.id}>{h.name} · {classLabel(by(ctx.rows('classes'), h.classId))}</option>)}</select></Field>
      <button className="sp-btn" onClick={() => ctx.setDrawer({ entity: 'homework' })}>New assignment</button>
    </Header>
    <section className="sp-card">
      <div className="sp-card-head"><h2>{hw.name} <small>{by(ctx.rows('subjects'), hw.subjectId)?.name} · {hw.type}{hw.dueDate ? ' · due ' + hw.dueDate : ''}</small></h2></div>
      {hw.details && <p className="sp-muted" style={{ margin: 0 }}>{hw.details}</p>}
      <ul className="sp-register">{students.map((s) => <li key={s.id} className={status(s.id) === 'Done' ? '' : status(s.id) === 'Incomplete' ? 'st-late' : 'st-absent'}><span className="sp-roll">{s.rollNo || '–'}</span><span className="sp-name">{s.name}</span>
        <span className="sp-seg wide" role="radiogroup" aria-label={'Homework for ' + s.name}>{opts.map(([v, short]) => <button key={v} type="button" role="radio" aria-checked={status(s.id) === v} className={'seg-' + (v === 'Done' ? 'present' : v === 'Incomplete' ? 'late' : 'absent')} onClick={() => setEdits((e) => ({ ...e, [s.id]: v }))}>{short}</button>)}</span></li>)}</ul>
      <Err error={error} />
      <div className="sp-foot"><span>{students.filter((s) => status(s.id) !== 'Done').length} not complete</span><button className="sp-btn sp-go" disabled={busy || !students.length} onClick={save}><Save size={16} /> Save</button></div>
    </section>
  </div>;
}

/* ------------------------------------------------------------ Bus attendance */
export function BusAttendance({ ctx, api }) {
  const routes = ctx.rows('routes').filter((r) => r.status !== 'Suspended');
  const [routeId, setRoute] = useState(''), route = by(routes, routeId) || routes[0];
  const [date, setDate] = useState(today()), [trip, setTrip] = useState(new Date().getHours() < 12 ? 'Morning pickup' : 'Afternoon drop');
  const riders = route ? ctx.rows('students').filter((s) => s.routeId === route.id && s.status === 'Active').sort(rollSort) : [];
  const saved = Object.fromEntries(ctx.rows('busAttendance').filter((a) => a.routeId === route?.id && a.date === date && a.trip === trip).map((a) => [a.studentId, a.status]));
  const [edits, setEdits] = useState({}), { busy, error, run } = useBusy();
  useEffect(() => setEdits({}), [route?.id, date, trip]);
  if (!routes.length) return <><Header eyebrow="Transport" title="Bus attendance" /><Empty ctx={ctx} title="Add your bus routes first" text="Create routes with their stops and vehicle, then choose the route on each bus student’s record." go="routes" action="Add routes" /></>;
  const status = (id) => edits[id] || saved[id] || 'Boarded';
  const save = () => run(async () => { const r = await api('/school/bus-attendance', 'POST', { year: ctx.year, routeId: route.id, date, trip, rows: riders.map((s) => ({ studentId: s.id, status: status(s.id) })) }); await ctx.changed(`Bus attendance saved (${r.saved} change${r.saved === 1 ? '' : 's'}).`); setEdits({}); });
  return <div className="sp-page">
    <Header eyebrow="Transport" title="Bus attendance" text="Mark who boarded on each trip.">
      <Field label="Route"><select value={route.id} onChange={(e) => setRoute(e.target.value)}>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      <Field label="Trip"><select value={trip} onChange={(e) => setTrip(e.target.value)}><option>Morning pickup</option><option>Afternoon drop</option></select></Field>
      <Field label="Date (AD)"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
    </Header>
    <section className="sp-card"><div className="sp-card-head"><h2>{route.name} <small>{riders.length} students · {trip === 'Morning pickup' ? route.pickupTime : route.dropTime || ''}</small></h2></div>
      {route.stops && <p className="sp-stops">{route.stops.split('\n').filter(Boolean).join(' → ')}</p>}
      {riders.length ? <ul className="sp-register">{riders.map((s) => <li key={s.id} className={status(s.id) === 'Absent' ? 'st-absent' : ''}><span className="sp-name">{s.name}<small> · {classLabel(by(ctx.records.classes || [], s.classId))}{s.busRoute ? ' · ' + s.busRoute : ''}</small></span>
        <span className="sp-seg wide">{['Boarded', 'Absent'].map((v) => <button key={v} type="button" role="radio" aria-checked={status(s.id) === v} className={v === 'Boarded' ? 'seg-present' : 'seg-absent'} onClick={() => setEdits((e) => ({ ...e, [s.id]: v }))}>{v}</button>)}</span></li>)}</ul>
        : <Empty ctx={ctx} title="No students on this route" text="Choose this route on the record of each student who uses the bus." go="students" action="Open students" />}
      <Err error={error} />
      {riders.length > 0 && <div className="sp-foot"><span>{riders.filter((s) => status(s.id) === 'Absent').length} not on the bus</span><button className="sp-btn sp-go" disabled={busy} onClick={save}><Save size={16} /> Save</button></div>}
    </section>
  </div>;
}

/* ------------------------------------------------------------ Certificates */
function CertificatePrint({ ctx, cert }) {
  const st = by(ctx.records.students || [], cert.studentId), cls = by(ctx.records.classes || [], st?.classId), p = ctx.profile;
  const tc = cert.type === 'Transfer certificate', bona = cert.type === 'Bonafide certificate';
  return <article className="sp-cert">
    <Letterhead ctx={ctx} />
    <div className="sp-cert-meta"><span>No. {cert.certificateNo}</span><span>Date: {cert.issueDate}</span></div>
    <h2>{cert.type.toUpperCase()}</h2>
    <p>This is to certify that <b>{st?.name}</b>{st?.fatherName ? <>, son/daughter of <b>{st.fatherName}</b>{st.motherName ? <> and <b>{st.motherName}</b></> : null}</> : null}{st?.address ? <>, resident of {st.address}</> : null}, {bona ? <>is a regular student of this school, studying in <b>{classLabel(cls)}</b> (roll no. {st?.rollNo || '—'}) in the academic year {ctx.year}.</> : <>was a student of this school{cert.lastClass || cls ? <>, last studying in <b>{cert.lastClass || classLabel(cls)}</b></> : null}{st?.admissionDate ? <>, admitted on {st.admissionDate}</> : null}.</>}</p>
    {st?.dobBs || st?.dob ? <p>According to the school records, the date of birth is <b>{st.dobBs ? st.dobBs + ' BS' : ''}{st.dobBs && st.dob ? ' (' : ''}{st.dob ? st.dob + ' AD' : ''}{st.dobBs && st.dob ? ')' : ''}</b>.</p> : null}
    {!bona && <p>{cert.conduct ? <>During the stay in this school, the student’s conduct and character were <b>{cert.conduct.toLowerCase()}</b>.</> : null} {tc && cert.reason ? <>The student is leaving because: {cert.reason}.</> : null}</p>}
    {cert.remarks && <p>{cert.remarks}</p>}
    <p>We wish {st?.name?.split(' ')[0] || 'the student'} every success in the future.</p>
    <LetterFooter ctx={ctx} signs={['preparedBy', 'principal']} seal />
  </article>;
}
export function Certificates({ ctx }) {
  const list = ctx.rows('certificates').sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const [openId, setOpen] = useState(''), cert = by(list, openId);
  const nextNo = `CERT-${ctx.year.slice(0, 4)}-${String(list.length + 1).padStart(4, '0')}`;
  return <div className="sp-page">
    <Header eyebrow="Students" title="Certificates" text="Issue and print character, transfer and bonafide certificates. Each one gets its own number.">
      {can(ctx.user.role, 'certificates', 'write') && <button className="sp-btn sp-go" onClick={() => ctx.setDrawer({ entity: 'certificates', defaults: { certificateNo: nextNo, issueDate: today(), status: 'Issued', conduct: 'Good' } })}><Award size={16} /> Issue certificate</button>}
      {cert && <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>}
    </Header>
    {list.length ? <section className="sp-card no-print"><div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Number</th><th>Student</th><th>Certificate</th><th>Issued</th><th>Status</th><th></th></tr></thead>
      <tbody>{list.map((c) => <tr key={c.id}><td>{c.certificateNo}</td><td className="sp-strong">{by(ctx.records.students || [], c.studentId)?.name}</td><td>{c.type}</td><td>{c.issueDate}</td><td><span className={'sp-pill ' + (c.status === 'Issued' ? 'green' : '')}>{c.status}</span></td><td><button className="sp-link" onClick={() => setOpen(openId === c.id ? '' : c.id)}>{openId === c.id ? 'Close' : 'View & print'}</button></td></tr>)}</tbody></table></div></section>
      : <Empty ctx={ctx} title="No certificates yet" text="Issue a certificate to see it here, ready to print on school letterhead." />}
    {cert && <CertificatePrint ctx={ctx} cert={cert} />}
  </div>;
}

/* ------------------------------------------------------------ ID cards */
function QR({ value }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; QRCode.toDataURL(value, { margin: 0, width: 160, errorCorrectionLevel: 'M' }).then((d) => live && setSrc(d)).catch(() => {}); return () => { live = false; }; }, [value]);
  return src ? <img src={src} alt="" width={64} height={64} /> : <span className="sp-qr-wait" />;
}
export function IdCards({ ctx }) {
  const classes = sortClasses(ctx.rows('classes')), [classId, setClass] = useState(''), cls = by(classes, classId) || classes[0];
  const students = cls ? classStudents(ctx.records, cls.id, ctx.year) : [];
  if (!classes.length) return <><Header eyebrow="Students" title="ID cards" /><Empty ctx={ctx} title="Add classes and students first" text="ID cards are printed per class." go="classes" action="Add classes" /></>;
  return <div className="sp-page">
    <Header eyebrow="Students" title="ID cards" text="Print-ready cards with a QR code of the student ID for the library desk and attendance. Cut along the borders.">
      <Field label="Class"><select value={cls.id} onChange={(e) => setClass(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select></Field>
      <button className="sp-btn sp-go" onClick={() => window.print()}><Printer size={16} /> Print {students.length} cards</button>
    </Header>
    <div className="sp-cards">{students.map((s) => <article key={s.id} className="sp-idcard">
      <header>{logoSrc(ctx.data?.branding) ? <img className="sp-id-logo" src={logoSrc(ctx.data.branding)} alt="" /> : <span className="sp-id-mark">{ctx.profile.name.split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('')}</span>}<div><b>{ctx.profile.name}</b><small>{ctx.profile.address || ''}</small></div></header>
      <div className="sp-id-body"><div className="sp-id-photo" aria-hidden="true">{s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
        <dl><dt>Name</dt><dd>{s.name}</dd><dt>Class</dt><dd>{classLabel(cls)}</dd><dt>Roll no.</dt><dd>{s.rollNo || '—'}</dd><dt>Student ID</dt><dd>{s.studentNo}</dd>{s.bloodGroup && s.bloodGroup !== 'Not known' && <><dt>Blood group</dt><dd>{s.bloodGroup}</dd></>}<dt>Guardian</dt><dd>{s.guardianPhone || s.fatherPhone || s.motherPhone || '—'}</dd></dl>
        <QR value={s.studentNo} /></div>
      <footer>Valid for academic year {academicYearLabel(ctx.year)}</footer>
    </article>)}</div>
  </div>;
}

/* ------------------------------------------------------------ Library desk */
export function LibraryDesk({ ctx, api }) {
  const [accessionNo, setAcc] = useState(''), [borrowerNo, setBorrower] = useState(''), [days, setDays] = useState('14'), { busy, error, run } = useBusy();
  const loans = ctx.rows('loans').filter((l) => l.status === 'Issued').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const perDay = Number(ctx.profile.libraryFinePerDay) || 5, t = today();
  const who = (l) => by(ctx.records.students || [], l.studentId)?.name || by(ctx.records.faculty || [], l.facultyId)?.name || '—';
  const issue = (e) => { e.preventDefault(); run(async () => { await api('/school/library/issue', 'POST', { year: ctx.year, accessionNo, borrowerNo, days }); await ctx.changed('Book issued.'); setAcc(''); setBorrower(''); }); };
  const back = (l, lost) => run(async () => { const r = await api('/school/library/return', 'POST', { loanId: l.id, lost }); await ctx.changed(lost ? 'Marked as lost.' : r.fine ? `Returned. Fine: ${npr(r.fine)}.` : 'Returned on time.'); });
  return <div className="sp-page">
    <Header eyebrow="Library" title="Library desk" text={`Scan or type the book’s accession number and the borrower’s ID. Late returns are fined ${npr(perDay)} a day.`} />
    <section className="sp-card"><form className="sp-bill-form" onSubmit={issue}>
      <Field label="Accession number"><input value={accessionNo} onChange={(e) => setAcc(e.target.value)} required autoFocus placeholder="Scan or type" /></Field>
      <Field label="Student or teacher ID"><input value={borrowerNo} onChange={(e) => setBorrower(e.target.value)} required placeholder="e.g. S-101" /></Field>
      <Field label="Days"><select value={days} onChange={(e) => setDays(e.target.value)}>{['7', '14', '21', '30'].map((d) => <option key={d}>{d}</option>)}</select></Field>
      <button className="sp-btn sp-go sp-self-end" disabled={busy}><LibraryBig size={16} /> Issue</button>
    </form><Err error={error} /></section>
    <section className="sp-card"><div className="sp-card-head"><h2>On loan <small>{loans.length} item{loans.length === 1 ? '' : 's'} · {loans.filter((l) => l.dueDate < t).length} overdue</small></h2></div>
      {loans.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Book</th><th>Borrower</th><th>Issued</th><th>Due</th><th>Fine so far</th><th></th></tr></thead>
        <tbody>{loans.map((l) => { const fine = loanFine(l, t, perDay); return <tr key={l.id}><td className="sp-strong">{by(ctx.records.library || [], l.resourceId)?.name}</td><td>{who(l)}</td><td>{l.issueDate}</td><td>{l.dueDate < t ? <span className="sp-pill red">{l.dueDate}</span> : l.dueDate}</td><td>{fine ? npr(fine) : '—'}</td><td className="sp-actions"><button className="sp-btn" disabled={busy} onClick={() => back(l, false)}>Return</button><button className="sp-link" disabled={busy} onClick={() => back(l, true)}>Lost</button></td></tr>; })}</tbody></table></div>
        : <p className="sp-muted">Nothing is on loan.</p>}
    </section>
  </div>;
}

/* ------------------------------------------------------------ Payroll */
function Payslip({ ctx, slip }) {
  const person = by([...(ctx.records.faculty || []), ...(ctx.records.staff || [])], slip.facultyId || slip.staffId);
  const ded = (slip.ssfEmployee || 0) + (slip.cit || 0) + (slip.tds || 0) + (slip.otherDeductions || 0) + (slip.absenceDeduction || 0);
  return <article className="sp-sheet sp-payslip"><Letterhead ctx={ctx} title="PAYSLIP" subtitle={slip.month} />
    <dl className="sp-sheet-meta"><div><dt>Name</dt><dd>{person?.name}</dd></div><div><dt>Employee no.</dt><dd>{person?.employeeNo || '—'}</dd></div><div><dt>Designation</dt><dd>{person?.designation || '—'}</dd></div><div><dt>Status</dt><dd>{slip.status}</dd></div></dl>
    <table><thead><tr><th>Earnings</th><th>NPR</th><th>Deductions</th><th>NPR</th></tr></thead><tbody>
      <tr><td>Basic salary</td><td>{slip.basic.toLocaleString('en-IN')}</td><td>SSF (11%)</td><td>{slip.ssfEmployee.toLocaleString('en-IN')}</td></tr>
      <tr><td>Allowances</td><td>{(slip.allowances || 0).toLocaleString('en-IN')}</td><td>CIT</td><td>{(slip.cit || 0).toLocaleString('en-IN')}</td></tr>
      <tr><td></td><td></td><td>Income tax</td><td>{(slip.tds || 0).toLocaleString('en-IN')}</td></tr>
      <tr><td></td><td></td><td>Other</td><td>{(slip.otherDeductions || 0).toLocaleString('en-IN')}</td></tr>
      {slip.absenceDeduction > 0 && <tr><td></td><td></td><td>Unpaid absence ({slip.unpaidDays} day{slip.unpaidDays === 1 ? '' : 's'})</td><td>{slip.absenceDeduction.toLocaleString('en-IN')}</td></tr>}
      <tr><td><b>Gross</b></td><td><b>{(slip.basic + (slip.allowances || 0)).toLocaleString('en-IN')}</b></td><td><b>Total deductions</b></td><td><b>{ded.toLocaleString('en-IN')}</b></td></tr></tbody></table>
    <div className="sp-sheet-sum"><div><span>Net pay</span><strong>{npr(slip.net)}</strong></div><div><span>Employer SSF (20%)</span><strong>{npr(slip.ssfEmployer)}</strong></div></div>
    <LetterFooter ctx={ctx} signs={['accountant', 'principal', 'receivedBy']} /></article>;
}
export function Payroll({ ctx, api }) {
  const [month, setMonth] = useState(MONTHS_BS[0]), [preview, setPreview] = useState(null), [openId, setOpen] = useState(''), { busy, error, run } = useBusy();
  const key = `${month} ${ctx.year}`, slips = ctx.rows('payslips').filter((p) => p.month === key);
  const name = (p) => by([...(ctx.records.faculty || []), ...(ctx.records.staff || [])], p.facultyId || p.staffId)?.name || '—';
  useEffect(() => setPreview(null), [month]);
  const structures = ctx.rows('salaryStructures').filter((x) => x.status === 'Active');
  if (!structures.length && !slips.length) return <><Header eyebrow="Staff" title="Payroll" /><Empty ctx={ctx} title="Add salary structures first" text="Set each teacher’s and staff member’s basic salary, allowances, SSF and deductions. Payroll then makes a payslip for everyone in one step." go="salaryStructures" action="Add salary structures" /></>;
  const open = by(slips, openId);
  return <div className="sp-page">
    <Header eyebrow="Staff" title="Payroll" text="Makes a payslip for each active salary structure. SSF is 11% from the employee and 20% from the school, on basic salary. Days absent without approved leave, and unpaid leave, are deducted from basic salary using staff attendance.">
      <Field label="Month (BS)"><select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS_BS.map((m) => <option key={m}>{m}</option>)}</select></Field>
      <button className="sp-btn sp-go" disabled={busy} onClick={() => run(async () => setPreview(await api('/school/payroll/preview', 'POST', { year: ctx.year, month })))}><ClipboardList size={16} /> Preview</button>
      {open && <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print payslip</button>}
    </Header>
    <Err error={error} />
    {preview && <section className="sp-card no-print"><div className="sp-card-head"><h2>{key} <small>{preview.slips.filter((s) => !s.already).length} new · {npr(preview.slips.filter((s) => !s.already).reduce((a, s) => a + s.net, 0))} net</small></h2>
      <button className="sp-btn sp-go" disabled={busy || !preview.slips.some((s) => !s.already)} onClick={() => run(async () => { const r = await api('/school/payroll/apply', 'POST', { year: ctx.year, month }); await ctx.changed(`${r.created} payslip${r.created === 1 ? '' : 's'} created for ${key}.`); setPreview(null); })}><Receipt size={16} /> Create payslips</button></div>
      <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Name</th><th>Basic</th><th>Allowances</th><th>SSF 11%</th><th>CIT</th><th>Tax</th><th>Unpaid days</th><th>Net</th><th></th></tr></thead><tbody>{preview.slips.map((s, i) => <tr key={i} className={s.already ? 'sp-dim' : ''}><td className="sp-strong">{s.name}</td><td>{npr(s.basic)}</td><td>{npr(s.allowances)}</td><td>{npr(s.ssfEmployee)}</td><td>{npr(s.cit)}</td><td>{npr(s.tds)}</td><td>{s.unpaidDays ? `${s.unpaidDays} · −${npr(s.absenceDeduction)}` : '—'}</td><td className="sp-strong">{npr(s.net)}</td><td>{s.already ? <span className="sp-pill">Done</span> : <span className="sp-pill green">New</span>}</td></tr>)}</tbody></table></div></section>}
    <section className="sp-card no-print"><div className="sp-card-head"><h2>Payslips for {key}</h2></div>
      {slips.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Name</th><th>Net pay</th><th>Status</th><th></th></tr></thead><tbody>{slips.map((p) => <tr key={p.id}><td className="sp-strong">{name(p)}</td><td>{npr(p.net)}</td><td><span className={'sp-pill ' + (p.status === 'Paid' ? 'green' : '')}>{p.status}</span></td><td><button className="sp-link" onClick={() => setOpen(openId === p.id ? '' : p.id)}>{openId === p.id ? 'Close' : 'View payslip'}</button></td></tr>)}</tbody></table></div> : <p className="sp-muted">No payslips for this month yet.</p>}
    </section>
    {open && <div className="sp-sheets"><Payslip ctx={ctx} slip={open} /></div>}
  </div>;
}

/* ------------------------------------------------------------ IEMIS / Flash report */
export function IemisExport({ ctx }) {
  const data = flashCounts(ctx.records, ctx.year);
  const totals = data.rows.reduce((a, r) => ({ girls: a.girls + r.girls, boys: a.boys + r.boys, other: a.other + r.other, total: a.total + r.total, dalit: a.dalit + r.dalit, janajati: a.janajati + r.janajati, disability: a.disability + r.disability }), { girls: 0, boys: 0, other: 0, total: 0, dalit: 0, janajati: 0, disability: 0 });
  function csv() {
    const head = ['Class', 'Girls', 'Boys', 'Other', 'Total', 'Dalit', 'Janajati', 'With disability'];
    const lines = [head, ...data.rows.map((r) => [r.className, r.girls, r.boys, r.other, r.total, r.dalit, r.janajati, r.disability]), ['Total', totals.girls, totals.boys, totals.other, totals.total, totals.dalit, totals.janajati, totals.disability], [], ['Teachers', 'Female', 'Male', 'Total'], ['', data.teachers.female, data.teachers.male, data.teachers.total]];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.map((l) => l.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `flash-report-${ctx.year.replace('/', '-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="sp-page">
    {<PrintHeader ctx={ctx} title={'IEMIS / Flash report'} subtitle={`Academic year ${academicYearLabel(ctx.year)}`} />}
    <Header eyebrow="Government reporting" title="IEMIS / Flash report data" text="Enrolment by class, sex, caste/ethnicity and disability, plus teachers, ready to copy into the IEMIS Flash I form. Check the figures against the current official template before submitting.">
      <button className="sp-btn sp-go" onClick={csv}><Download size={16} /> Download CSV</button><button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>
    </Header>
    <div className="sp-tiles"><Tile tone="blue" value={totals.total} label="Students enrolled" /><Tile tone="rose" value={totals.girls} label="Girls" /><Tile tone="teal" value={totals.boys} label="Boys" /><Tile tone="purple" value={data.teachers.total} label={`Teachers · ${data.teachers.female} female`} /></div>
    <section className="sp-card"><div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Class</th><th>Girls</th><th>Boys</th><th>Other</th><th>Total</th><th>Dalit</th><th>Janajati</th><th>With disability</th></tr></thead>
      <tbody>{data.rows.map((r) => <tr key={r.className}><td className="sp-strong">{r.className}</td><td>{r.girls}</td><td>{r.boys}</td><td>{r.other}</td><td className="sp-strong">{r.total}</td><td>{r.dalit}</td><td>{r.janajati}</td><td>{r.disability}</td></tr>)}
        <tr className="sp-total"><td>Total</td><td>{totals.girls}</td><td>{totals.boys}</td><td>{totals.other}</td><td>{totals.total}</td><td>{totals.dalit}</td><td>{totals.janajati}</td><td>{totals.disability}</td></tr></tbody></table></div></section>
    {<PrintFooter ctx={ctx} signs={['principal']} />}
  </div>;
}

/* ------------------------------------------------------------ SMS log */
export function SmsLog({ ctx, api }) {
  const [data, setData] = useState(null), { busy, error, run } = useBusy();
  const load = () => run(async () => setData(await api('/school/sms/log', 'POST', {})));
  useEffect(() => { load(); }, []);
  const notices = ctx.rows('notices').filter((n) => n.status === 'Published' && n.sms === 'Yes');
  return <div className="sp-page">
    <Header eyebrow="Communication" title="SMS messages" text="Absence alerts and notices sent to parents’ phones. Absence SMS is switched on in Settings; each message is sent once." />
    {data && !data.configured && <p className="sp-note">No SMS gateway is connected yet, so messages are logged here but not sent. Add a Sparrow SMS token (SPARROW_SMS_TOKEN and SPARROW_SMS_FROM) to the server settings to send them.</p>}
    {notices.length > 0 && <section className="sp-card"><div className="sp-card-head"><h2>Notices marked for SMS</h2></div><ul className="sp-list">{notices.map((n) => <li key={n.id}><div><b>{n.name}</b><small>{n.audience}{n.audience === 'One class' ? ' · ' + classLabel(by(ctx.rows('classes'), n.classId)) : ''}</small></div><button className="sp-btn" disabled={busy} onClick={() => run(async () => { const r = await api('/school/notices/sms', 'POST', { noticeId: n.id }); ctx.setToast(`${r.queued} parent number${r.queued === 1 ? '' : 's'} queued${r.configured ? `, ${r.sent} sent` : ''}.`); await load(); })}><Send size={15} /> Send to parents</button></li>)}</ul></section>}
    <Err error={error} />
    <section className="sp-card"><div className="sp-card-head"><h2><MessageSquare size={18} /> Message log</h2></div>
      {data?.messages.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>When</th><th>Phone</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>{data.messages.map((m) => <tr key={m.id}><td>{String(m.createdAt).slice(0, 16).replace('T', ' ')}</td><td>{m.phone}</td><td>{m.kind}</td><td>{m.message}</td><td><span className={'sp-pill ' + (m.status === 'Sent' ? 'green' : m.status === 'Failed' ? 'red' : '')}>{m.status}</span></td></tr>)}</tbody></table></div> : <p className="sp-muted">{data ? 'No messages yet.' : 'Loading…'}</p>}
    </section>
  </div>;
}

/* ------------------------------------------------------------ Parent access (student record) */
export function GuardiansModal({ ctx, api, record, Modal, onClose }) {
  const [list, setList] = useState(null), [form, setForm] = useState({ name: record.fatherName || record.motherName || record.guardian || '', email: '', relation: record.fatherName ? 'Father' : record.motherName ? 'Mother' : 'Guardian', password: '' }), { busy, error, run } = useBusy();
  const load = () => run(async () => setList(await api('/school/guardians/list', 'POST', { studentId: record.id })));
  useEffect(() => { load(); }, []);
  const add = (e) => { e.preventDefault(); run(async () => { const r = await api('/school/guardians/add', 'POST', { studentId: record.id, ...form }); ctx.setToast(r.created ? `Parent login created for ${form.email}. Share the email and temporary password privately.` : `${form.email} can now see ${record.name}.`); setForm((f) => ({ ...f, email: '', password: '' })); await load(); }); };
  return <Modal title="Parent access" subtitle={record.name} onClose={onClose}><div className="modal-body sp-guardians">
    <p>Parents sign in with their own email and see only their children: attendance, homework, published results, fees and notices. They can send leave notes. One login can be linked to several children.</p>
    {list?.length ? <ul className="sp-list">{list.map((g) => <li key={g.id}><div><b>{g.name}</b><small>{g.relation} · {g.email}{!g.active ? ' · inactive' : ''}</small></div><button className="sp-link" disabled={busy} onClick={() => run(async () => { await api('/school/guardians/remove', 'POST', { studentId: record.id, userId: g.id }); await load(); })}><Trash2 size={14} /> Remove</button></li>)}</ul> : list && <p className="sp-muted">No parent has access yet.</p>}
    <form onSubmit={add} className="sp-guardian-form"><h3><UserPlus size={17} /> Give a parent access</h3>
      <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Relation<select value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>{['Father', 'Mother', 'Guardian', 'Grandparent', 'Relative'].map((r) => <option key={r}>{r}</option>)}</select></label>
      <label>Email (their login)<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Temporary password<input type="password" minLength={12} value={form.password} placeholder="Only for a new login · 12+ characters" onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></label>
      <Err error={error} />
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Give access'}</button></form>
  </div></Modal>;
}
export const FamilyIcons = { GraduationCap, IdCard, Users };

/* ------------------------------------------------------------ Year-end promotion */
const nextYear = (y) => { const a = Number(y.slice(0, 4)) + 1; return `${a}/${String((a + 1) % 100).padStart(2, '0')}`; };
export function Promotion({ ctx, api }) {
  const [targetInput, setTarget] = useState(() => String(bsYearOf(nextYear(ctx.year)))), target = normalizeAcademicYear(targetInput) || targetInput, [repeat, setRepeat] = useState([]), [setDefault, setSetDefault] = useState(true);
  const [preview, setPreview] = useState(null), [done, setDone] = useState(null), { busy, error, run } = useBusy();
  const classes = sortClasses(ctx.rows('classes')), [pick, setPick] = useState('');
  useEffect(() => setPreview(null), [target, repeat.join()]);
  const body = { sourceYear: ctx.year, targetYear: target, repeat, setDefaultYear: setDefault };
  const kids = pick ? classStudents(ctx.records, pick, ctx.year) : [];
  return <div className="sp-page">
    <Header eyebrow="Year end" title="Promote students" text={`Moves every active student of ${ctx.year} up one class in the new year, creates next year’s classes with the same subjects and class fees, and marks Grade 12 as graduated. This year’s records stay exactly as they are.`} />
    <section className="sp-card">
      <div className="sp-bill-form"><Field label="From"><input value={academicYearLabel(ctx.year)} disabled /></Field><Field label={'Into academic year (BS)' + (normalizeAcademicYear(targetInput) ? ' · ' + academicYearLabel(target) : '')}><input value={targetInput} onChange={(e) => setTarget(e.target.value)} placeholder={String(bsYearOf(nextYear(ctx.year)))} /></Field>
        <label className="sp-check"><input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} /> Make it the current year afterwards</label></div>
      <fieldset className="sp-chips"><legend>Students who repeat their class</legend>
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Choose a class to pick repeaters"><option value="">Choose a class…</option>{classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select>
        {kids.map((s) => <label key={s.id} className={repeat.includes(s.id) ? 'on' : ''}><input type="checkbox" checked={repeat.includes(s.id)} onChange={() => setRepeat((r) => r.includes(s.id) ? r.filter((x) => x !== s.id) : [...r, s.id])} />{s.name}</label>)}
        {repeat.length > 0 && <span className="sp-pill amber">{repeat.length} repeating</span>}</fieldset>
      <Err error={error} />
      <div className="sp-foot"><span>Mark students who have left as Withdrawn or Transferred first; only active students move.</span><button className="sp-btn sp-go" disabled={busy} onClick={() => run(async () => { setDone(null); setPreview(await api('/school/promotion/preview', 'POST', body)); })}><ClipboardList size={16} /> Preview</button></div>
    </section>
    {preview && <section className="sp-card"><div className="sp-card-head"><h2>{preview.sourceYear} → {preview.targetYear} <small>{preview.moves.filter((m) => !m.repeat).length} promoted · {preview.moves.filter((m) => m.repeat).length} repeating · {preview.graduates.length} graduating</small></h2>
      <button className="sp-btn sp-go" disabled={busy || !(preview.moves.length || preview.graduates.length)} onClick={() => run(async () => { const r = await api('/school/promotion/apply', 'POST', body); setDone(r); setPreview(null); await ctx.changed(`${r.promoted} promoted, ${r.repeated} repeating, ${r.graduated} graduated into ${r.targetYear}.`); })}><GraduationCap size={16} /> Promote now</button></div>
      {preview.classesToCreate.length > 0 && <p className="sp-note">New classes for {preview.targetYear}: {preview.classesToCreate.map((c) => `${c.name} ${c.section}${c.subjects ? ` (${c.subjects} subjects copied)` : ' (add subjects)'}`).join(', ')}. {preview.feeHeadsToCopy} fee heads copied.</p>}
      {preview.skipped.length > 0 && <p className="sp-muted">{preview.skipped.length} already enrolled in {preview.targetYear} and left alone.</p>}
      <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Student</th><th>From</th><th>To</th></tr></thead><tbody>
        {preview.moves.map((m) => <tr key={m.id}><td className="sp-strong">{m.name}</td><td>{m.from}</td><td>{m.to}{m.repeat && <span className="sp-pill amber"> repeats</span>}</td></tr>)}
        {preview.graduates.map((g) => <tr key={g.id}><td className="sp-strong">{g.name}</td><td>{g.from}</td><td><span className="sp-pill green">Graduates</span></td></tr>)}</tbody></table></div>
    </section>}
    {done && <p className="sp-note">Done. Switch the year at the top to {done.targetYear} to see the new classes. Then set subjects for any new class, create the first examination, and run the first monthly bill.</p>}
  </div>;
}
