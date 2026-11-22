import React, { useEffect, useMemo, useState } from 'react';
import { Letterhead, LetterFooter, PrintHeader, PrintFooter, logoSrc } from './Letterhead.jsx';
import { CalendarDays, Printer, Save, Users, UserCheck, ClipboardList, Send, Wallet, BookOpenCheck, MessageSquare, ChevronLeft, ChevronRight, Plus, CircleAlert, ArrowRight, Receipt, Landmark, IdCard, LayoutGrid } from 'lucide-react';
import { can, invoiceBalance } from '../shared/schema.mjs';
import { sortClasses, classLabel, classStudents, rollSort, MONTHS_BS } from '../shared/school.mjs';
import { SCHOOL_DAYS, weekday, isWeeklyHoliday, periodsToCover, freeTeachers, teachersAway, STAFF_STATUS, staffAttendanceSummary, unpaidDays, payMonthRange, seatPlan, CAS_AREAS, CONDUCT, casInternal, advanceBalance, ledgerEntries, chartOfAccounts, trialBalance, ledgerFor, financialStatements } from '../shared/school-ops.mjs';
import { adToBs, bsToAd, bsMonthDays, formatBs, BS_MONTHS, isProjected, BS_FIRST, BS_LAST, academicYearLabel } from '../shared/bs.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const npr = (v) => 'NPR ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v || 0);
const by = (list, id) => (list || []).find((x) => x.id === id);
const Header = ({ eyebrow, title, text, children }) => <div className="sp-head"><div><span className="sp-eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <div className="sp-head-actions">{children}</div>}</div>;
const Field = ({ label, children }) => <label className="sp-field"><span>{label}</span>{children}</label>;
const Err = ({ error }) => error ? <p className="sp-error" role="alert"><CircleAlert size={16} /> {error}</p> : null;
const Tile = ({ tone, value, label }) => <div className={'sp-tile tone-' + tone}><strong>{value}</strong><span>{label}</span></div>;
function Empty({ ctx, title, text, go, action }) {
  return <div className="sp-empty"><span><CircleAlert size={22} /></span><strong>{title}</strong><p>{text}</p>{go && can(ctx.user.role, go, 'write') && <button className="sp-btn sp-go" onClick={() => ctx.go(go)}>{action} <ArrowRight size={16} /></button>}</div>;
}
function useBusy() { const [busy, setBusy] = useState(false), [error, setError] = useState(''); const run = async (fn) => { setBusy(true); setError(''); try { return await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } }; return { busy, error, run }; }
const Tabs = ({ tabs, value, onChange }) => <div className="sp-tabs no-print" role="tablist">{tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}</div>;
const family = (ctx) => ['Student', 'Parent'].includes(ctx.user.role);
const bsShort = (iso) => { const b = adToBs(iso); return b ? `${b.day} ${BS_MONTHS[b.month - 1].slice(0, 3)}` : ''; };
const nextNo = (rows, key, prefix) => { const n = Math.max(0, ...rows.map((r) => Number(String(r[key] || '').replace(prefix, '')) || 0)); return prefix + String(n + 1).padStart(4, '0'); };
function useClassPick(ctx) {
  const list = family(ctx) ? sortClasses((ctx.rows('classes') || [])) : sortClasses(ctx.rows('classes').filter((c) => c.status !== 'Closed'));
  const [picked, set] = useState(''); const id = list.some((c) => c.id === picked) ? picked : list[0]?.id || '';
  return [list, id, set];
}
const ClassSelect = ({ list, value, onChange }) => <select value={value} onChange={(e) => onChange(e.target.value)}>{list.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select>;
const personName = (ctx, id) => by([...(ctx.records.faculty || []), ...(ctx.records.staff || [])], id)?.name || '—';

/** Holidays and events on a date (shared with the attendance page). */
export function eventsOn(records, date) {
  return (records.events || []).filter((e) => e.date <= date && (e.endDate || e.date) >= date);
}
export function holidayOn(records, date) {
  return eventsOn(records, date).find((e) => ['Public holiday', 'School holiday'].includes(e.type)) || (isWeeklyHoliday(date) ? { name: weekday(date), type: 'Weekly holiday' } : null);
}

/* ------------------------------------------------------------ Class routine and substitutions */
export function ClassRoutine({ ctx, api }) {
  const fam = family(ctx), write = can(ctx.user.role, 'routine', 'write'), cover = can(ctx.user.role, 'substitutions', 'write');
  const [view, setView] = useState(ctx.user.role === 'Faculty' ? 'teacher' : 'class');
  const [classes, classId, setClassId] = useClassPick(ctx);
  const teachers = (ctx.records.faculty || []).filter((f) => f.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const [teacherId, setTeacher] = useState(ctx.user.facultyId || ''), tId = teachers.some((t) => t.id === teacherId) ? teacherId : teachers[0]?.id || '';
  const [date, setDate] = useState(today()), { busy, error, run } = useBusy();
  const routine = ctx.rows('routine'), subject = (id) => by(ctx.rows('subjects'), id)?.name || '—';
  const kids = fam ? ctx.rows('students') : [], [childId, setChild] = useState(''), child = by(kids, childId) || kids[0];
  const shownClass = fam ? child?.classId : classId;
  const mine = view === 'teacher' ? routine.filter((r) => r.facultyId === tId) : routine.filter((r) => r.classId === shownClass);
  const periods = [...new Map(mine.map((r) => [Number(r.period), r])).values()].sort((a, b) => a.period - b.period);
  const cell = (day, p) => mine.filter((r) => r.day === day && Number(r.period) === Number(p.period));
  const open = (r, defaults) => write && ctx.setDrawer(r ? { entity: 'routine', record: r } : { entity: 'routine', defaults });
  if (!classes.length && !fam) return <><Header eyebrow="Timetable" title="Class routine" /><Empty ctx={ctx} title="Add your classes first" text="The routine is made per class and section." go="classes" action="Add classes" /></>;
  const toCover = view === 'cover' ? periodsToCover(ctx.records, date, ctx.year) : [];
  const away = view === 'cover' ? [...teachersAway(ctx.records, date)] : [];
  const myCover = ctx.user.facultyId ? (ctx.rows('substitutions') || []).filter((s) => s.substituteId === ctx.user.facultyId && s.date >= today() && s.status !== 'Cancelled') : [];
  async function assign(period, substituteId) {
    await run(async () => { await api('/records/substitutions', 'POST', { year: ctx.year, date, routineId: period.id, absentFacultyId: period.facultyId, substituteId, reason: 'Teacher away', status: 'Planned' }); await ctx.changed(`${personName(ctx, substituteId)} will cover ${classLabel(by(ctx.rows('classes'), period.classId))}, period ${period.period}.`); });
  }
  return <div className="sp-page">
    {<PrintHeader ctx={ctx} title={'Class routine'} subtitle={`${academicYearLabel(ctx.year)}`} />}
    <Header eyebrow="Timetable" title="Class routine" text={fam ? 'The weekly period routine for your child’s class.' : 'The weekly routine for each class and teacher. Click a period to change it.'}>
      {!fam && <Tabs value={view} onChange={setView} tabs={[['class', 'By class'], ['teacher', 'By teacher'], ...(cover ? [['cover', 'Substitutions']] : [])]} />}
      {view === 'class' && !fam && <Field label="Class"><ClassSelect list={classes} value={classId} onChange={setClassId} /></Field>}
      {fam && kids.length > 1 && <Field label="Child"><select value={child?.id} onChange={(e) => setChild(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>}
      {view === 'teacher' && <Field label="Teacher"><select value={tId} onChange={(e) => setTeacher(e.target.value)}>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      {view === 'cover' && <Field label="Date (AD)"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
      {view !== 'cover' && <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>}
      {write && view === 'class' && <button className="sp-btn sp-go" onClick={() => open(null, { classId, day: 'Sunday', period: (periods.at(-1)?.period || 0) + 1 })}><Plus size={16} /> Add period</button>}
    </Header>
    {myCover.length > 0 && view !== 'cover' && <section className="sp-card sp-callout"><b>Your cover duties</b><ul className="sp-list">{myCover.map((s) => { const p = by(routine, s.routineId); return <li key={s.id}><div><b>{s.date} · {bsShort(s.date)}</b><small>{p ? `${classLabel(by(ctx.rows('classes'), p.classId))} · period ${p.period} (${p.startTime}–${p.endTime}) · ${subject(p.subjectId)}` : 'Period'}</small></div><span className="sp-pill amber">Cover for {personName(ctx, s.absentFacultyId)}</span></li>; })}</ul></section>}
    {view === 'cover' ? <section className="sp-card">
      <div className="sp-card-head"><h2>Periods to cover <small>{weekday(date)} · {formatBs(date)} · {away.length} teacher{away.length === 1 ? '' : 's'} away</small></h2></div>
      <p className="sp-muted">Teachers count as away when staff attendance marks them absent or on leave, or approved leave covers the day.</p>
      {toCover.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Time</th><th>Class</th><th>Subject</th><th>Teacher away</th><th>Substitute</th></tr></thead><tbody>{toCover.map((p) => <tr key={p.id}>
        <td>P{p.period} · {p.startTime}–{p.endTime}</td><td className="sp-strong">{classLabel(by(ctx.rows('classes'), p.classId))}</td><td>{subject(p.subjectId)}</td><td>{personName(ctx, p.facultyId)}</td>
        <td>{p.substitution ? <span className="sp-pill green">{personName(ctx, p.substitution.substituteId)}</span> : <select disabled={busy} defaultValue="" onChange={(e) => e.target.value && assign(p, e.target.value)}><option value="">Choose a free teacher…</option>{freeTeachers(ctx.records, p, date, ctx.year).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</td></tr>)}</tbody></table></div>
        : <p className="sp-muted">{away.length ? 'The teachers away have no periods on this day.' : 'No teacher is away on this day.'}</p>}
      <Err error={error} />
    </section> : <section className="sp-card">
      <div className="sp-card-head"><h2>{view === 'teacher' ? personName(ctx, tId) : classLabel(by(ctx.records.classes, shownClass))} <small>{mine.length} periods a week</small></h2></div>
      {periods.length ? <div className="sp-table-wrap"><table className="sp-table sp-routine"><thead><tr><th>Period</th>{SCHOOL_DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead><tbody>{periods.map((p) => <tr key={p.period}>
        <td><b>{p.period}</b><small>{p.startTime}–{p.endTime}</small></td>
        {SCHOOL_DAYS.map((d) => { const list = cell(d, p); return <td key={d} className={list.length ? 'filled' : ''} onClick={() => !list.length && view === 'class' && open(null, { classId, day: d, period: p.period, startTime: p.startTime, endTime: p.endTime })}>
          {list.map((r) => <button key={r.id} className="sp-period" disabled={!write} onClick={(e) => { e.stopPropagation(); open(r); }}><b>{subject(r.subjectId)}</b><small>{view === 'teacher' ? classLabel(by(ctx.rows('classes'), r.classId)) : personName(ctx, r.facultyId)}{r.room ? ' · ' + r.room : ''}</small></button>)}
          {!list.length && write && view === 'class' && <span className="sp-add">+</span>}</td>; })}</tr>)}</tbody></table></div>
        : <Empty ctx={ctx} title="No routine yet" text={write ? 'Add the first period: choose the day, period number, times, subject and teacher.' : 'The school has not published a routine yet.'} />}
    </section>}
    {<PrintFooter ctx={ctx} signs={[]} />}
  </div>;
}

/* ------------------------------------------------------------ Staff attendance */
const STAFF_SHORT = { Present: 'P', Absent: 'A', Late: 'L', 'Half day': '½', 'On leave': 'Lv' };
export function StaffAttendance({ ctx, api }) {
  const [tab, setTab] = useState('register'), [date, setDate] = useState(today()), [edits, setEdits] = useState({}), { busy, error, run } = useBusy();
  const [month, setMonth] = useState(() => BS_MONTHS[(adToBs(today())?.month || 1) - 1]);
  const people = [...(ctx.records.faculty || []).filter((f) => f.status !== 'Resigned').map((f) => ({ ...f, kind: 'facultyId', group: 'Teachers' })), ...(ctx.records.staff || []).filter((s) => s.status !== 'Resigned').map((s) => ({ ...s, kind: 'staffId', group: 'Staff' }))].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const saved = useMemo(() => Object.fromEntries(ctx.rows('staffAttendance').filter((a) => a.date === date).map((a) => [a.facultyId || a.staffId, a])), [ctx.records, date]);
  useEffect(() => setEdits({}), [date]);
  const onLeave = (id) => (ctx.records.leaves || []).some((l) => (l.facultyId || l.staffId) === id && l.status === 'Approved' && l.fromDate <= date && l.toDate >= date);
  const get = (id, k) => edits[id]?.[k] ?? saved[id]?.[k] ?? (k === 'status' ? (onLeave(id) ? 'On leave' : 'Present') : '');
  const set = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  if (!people.length) return <><Header eyebrow="Staff" title="Staff attendance" /><Empty ctx={ctx} title="Add teachers and staff first" text="Attendance is taken for everyone in the faculty and staff registers." go="faculty" action="Add teachers" /></>;
  const counts = Object.fromEntries(STAFF_STATUS.map((s) => [s, people.filter((p) => get(p.id, 'status') === s).length]));
  const save = () => run(async () => { const r = await api('/school/staff-attendance', 'POST', { year: ctx.year, date, rows: people.map((p) => ({ [p.kind]: p.id, status: get(p.id, 'status'), checkIn: get(p.id, 'checkIn'), checkOut: get(p.id, 'checkOut') })) }); await ctx.changed(r.saved ? `Staff attendance saved for ${r.saved} ${r.saved === 1 ? 'person' : 'people'}.` : 'No changes to save.'); setEdits({}); });
  const range = payMonthRange(ctx.year, month);
  return <div className="sp-page">
    {<PrintHeader ctx={ctx} title={'Staff attendance'} />}
    <Header eyebrow="Staff" title="Staff attendance" text="Mark teachers and staff each day. Approved leave is filled in for you. Absence without approved leave is deducted in payroll.">
      <Tabs value={tab} onChange={setTab} tabs={[['register', 'Daily register'], ['month', 'Monthly summary']]} />
      {tab === 'register' ? <Field label={`Date · ${formatBs(date)}`}><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        : <Field label="Month (BS)"><select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS_BS.map((m) => <option key={m}>{m}</option>)}</select></Field>}
    </Header>
    {tab === 'register' ? <>
      <div className="sp-tiles">{[['Present', 'teal'], ['Absent', 'rose'], ['Late', 'orange'], ['On leave', 'purple']].map(([s, t]) => <Tile key={s} tone={t} value={counts[s]} label={s} />)}</div>
      {holidayOn(ctx.records, date) && <p className="sp-note">{holidayOn(ctx.records, date).name} — {holidayOn(ctx.records, date).type}. You can still record attendance if staff came in.</p>}
      <section className="sp-card">
        <ul className="sp-register sp-staff">{people.map((p) => <li key={p.id} className={'st-' + get(p.id, 'status').toLowerCase().replace(' ', '-')}>
          <span className="sp-roll">{p.group === 'Teachers' ? 'T' : 'S'}</span><span className="sp-name">{p.name}<small>{p.designation || p.group}</small></span>
          <span className="sp-seg" role="radiogroup" aria-label={'Attendance for ' + p.name}>{STAFF_STATUS.map((v) => <button key={v} type="button" role="radio" aria-checked={get(p.id, 'status') === v} title={v} aria-label={v} className={'seg-' + v.toLowerCase().replace(' ', '-')} onClick={() => set(p.id, 'status', v)}>{STAFF_SHORT[v]}</button>)}</span>
          <input type="time" aria-label={'Check-in for ' + p.name} value={get(p.id, 'checkIn')} onChange={(e) => set(p.id, 'checkIn', e.target.value)} />
        </li>)}</ul>
        <Err error={error} />
        <div className="sp-foot"><span>{counts.Absent} absent · {counts['Half day']} half day · {counts['On leave']} on leave</span><button className="sp-btn sp-go" disabled={busy} onClick={save}><Save size={16} /> {busy ? 'Saving…' : 'Save attendance'}</button></div>
      </section></>
      : <section className="sp-card"><div className="sp-card-head"><h2>{month} {adToBs(range.from)?.year} <small>{range.from} to {range.to} · {range.days} days</small></h2><button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button></div>
        <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Name</th><th>Days marked</th><th>Present</th><th>Late</th><th>Half day</th><th>On leave</th><th>Absent</th><th>Unpaid days</th></tr></thead><tbody>{people.map((p) => { const s = staffAttendanceSummary(ctx.records, p.id, range.from, range.to), u = unpaidDays(ctx.records, p.id, range.from, range.to); return <tr key={p.id}><td className="sp-strong">{p.name}</td><td>{s.days}</td><td>{s.present}</td><td>{s.late}</td><td>{s.half}</td><td>{s.leave}</td><td>{s.absent}</td><td>{u ? <span className="sp-pill red">{u}</span> : '—'}</td></tr>; })}</tbody></table></div></section>}
    {<PrintFooter ctx={ctx} signs={['principal']} />}
  </div>;
}

/* ------------------------------------------------------------ Exam routine, admit cards and seat plan */
export function ExamRoutine({ ctx }) {
  const fam = family(ctx), write = can(ctx.user.role, 'examSchedule', 'write');
  const terms = ctx.rows('terms'), [pickedTerm, setTerm] = useState(''), termId = terms.some((t) => t.id === pickedTerm) ? pickedTerm : terms.find((t) => t.status !== 'Published')?.id || terms.at(-1)?.id || '';
  const [tab, setTab] = useState(fam ? 'admit' : 'routine'), [classes, classId, setClassId] = useClassPick(ctx);
  const kids = fam ? ctx.rows('students') : [], [childId, setChild] = useState(''), child = by(kids, childId) || kids[0];
  const term = by(terms, termId), papers = ctx.rows('examSchedule').filter((p) => p.termId === termId).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const subject = (id) => by(ctx.rows('subjects'), id)?.name || '—', cls = (id) => classLabel(by(ctx.records.classes, id));
  const [chosen, setChosen] = useState([]), [roomsText, setRooms] = useState('Room 101, 5, 6\nRoom 102, 5, 6'), [plan, setPlan] = useState(null);
  if (!terms.length) return <><Header eyebrow="Examinations" title="Exam routine" /><Empty ctx={ctx} title={fam ? 'No examinations yet' : 'Add an examination first'} text={fam ? 'The exam routine appears here when the school publishes it.' : 'Create the examination (for example Second Terminal), then add each paper.'} go="terms" action="Add examination" /></>;
  const admitStudents = fam ? (child ? [child] : []) : classStudents(ctx.records, classId, ctx.year);
  const admitClass = fam ? child?.classId : classId;
  function generate() {
    const rooms = roomsText.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0]).map(([name, rows, cols]) => ({ name, rows: Math.max(1, Math.min(30, Number(rows) || 5)), cols: Math.max(1, Math.min(12, Number(cols) || 6)) }));
    const ids = chosen.length ? chosen : classes.map((c) => c.id);
    setPlan(seatPlan(ids.map((id) => ({ classId: id, label: cls(id), students: classStudents(ctx.records, id, ctx.year) })), rooms));
  }
  return <div className="sp-page">
    {(tab === 'admit' ? '' : tab === 'seats' ? 'Seat plan' : 'Exam routine') && <PrintHeader ctx={ctx} title={tab === 'admit' ? '' : tab === 'seats' ? 'Seat plan' : 'Exam routine'} />}
    <Header eyebrow="Examinations" title={tab === 'admit' ? 'Admit cards' : tab === 'seats' ? 'Seat plan' : 'Exam routine'} text={tab === 'routine' ? 'Each paper with its date, time and room. Dates are shown in BS and AD.' : tab === 'admit' ? 'One admit card per student with the class’s exam routine. Print and cut.' : 'Seat students of different classes side by side, room by room.'}>
      {!fam && <Tabs value={tab} onChange={setTab} tabs={[['routine', 'Exam routine'], ['admit', 'Admit cards'], ['seats', 'Seat plan']]} />}
      <Field label="Examination"><select value={termId} onChange={(e) => setTerm(e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      {tab === 'admit' && !fam && <Field label="Class"><ClassSelect list={classes} value={classId} onChange={setClassId} /></Field>}
      {fam && kids.length > 1 && <Field label="Child"><select value={child?.id} onChange={(e) => setChild(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>}
      <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>
      {write && tab === 'routine' && <button className="sp-btn sp-go" onClick={() => ctx.setDrawer({ entity: 'examSchedule', defaults: { termId, startTime: '10:00', endTime: '13:00' } })}><Plus size={16} /> Add paper</button>}
    </Header>
    {tab === 'routine' && <section className="sp-card">
      <div className="sp-card-head"><h2>{term?.name} <small>{papers.length} papers</small></h2></div>
      {papers.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Date (BS)</th><th>Date (AD)</th><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Room</th></tr></thead><tbody>{papers.filter((p) => !fam || p.classId === child?.classId).map((p) => <tr key={p.id} className={write ? 'sp-click' : ''} onClick={() => write && ctx.setDrawer({ entity: 'examSchedule', record: p })}><td className="sp-strong">{formatBs(p.date)}</td><td>{p.date}</td><td>{weekday(p.date)}</td><td>{p.startTime}–{p.endTime}</td><td>{cls(p.classId)}</td><td>{subject(p.subjectId)}</td><td>{p.room || '—'}</td></tr>)}</tbody></table></div>
        : <Empty ctx={ctx} title="No papers yet" text={write ? 'Add each paper: class, subject, date and time. Clashes for a class are stopped automatically.' : 'The exam routine is not published yet.'} />}
    </section>}
    {tab === 'admit' && (admitStudents.length ? <div className="sp-admits">{admitStudents.map((s) => <article key={s.id} className="sp-admit">
      <Letterhead ctx={ctx} title="ADMIT CARD" compact />
      <p className="sp-admit-term">{term?.name} · Academic year {academicYearLabel(ctx.year)}</p>
      <dl><div><dt>Name</dt><dd>{s.name}</dd></div><div><dt>Class</dt><dd>{cls(s.classId)}</dd></div><div><dt>Roll no.</dt><dd>{s.rollNo || '—'}</dd></div><div><dt>Student ID</dt><dd>{s.studentNo}</dd></div></dl>
      <table><thead><tr><th>Date (BS)</th><th>Subject</th><th>Time</th></tr></thead><tbody>{papers.filter((p) => p.classId === (s.classId || admitClass)).map((p) => <tr key={p.id}><td>{formatBs(p.date)}</td><td>{subject(p.subjectId)}</td><td>{p.startTime}–{p.endTime}</td></tr>)}</tbody></table>
      <LetterFooter ctx={ctx} signs={['examCoordinator', 'principal']} /></article>)}</div> : <Empty ctx={ctx} title="No students" text="Add students to this class first." />)}
    {tab === 'seats' && <>
      <section className="sp-card no-print">
        <fieldset className="sp-chips"><legend>Classes sitting together (none chosen = all)</legend>{classes.map((c) => <label key={c.id} className={chosen.includes(c.id) ? 'on' : ''}><input type="checkbox" checked={chosen.includes(c.id)} onChange={() => setChosen(chosen.includes(c.id) ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])} />{classLabel(c)}</label>)}</fieldset>
        <Field label="Rooms: one per line as name, rows, seats per row"><textarea rows={4} value={roomsText} onChange={(e) => setRooms(e.target.value)} /></Field>
        <div className="sp-foot"><span>Students of different classes alternate along each row.</span><button className="sp-btn sp-go" onClick={generate}><LayoutGrid size={16} /> Make seat plan</button></div>
      </section>
      {plan && <>{plan.unseated.length > 0 && <p className="sp-error">{plan.unseated.length} students have no seat. Add a room or more seats.</p>}
        <div className="sp-rooms">{plan.plan.map((r) => <article key={r.name} className="sp-room"><h3>{r.name} <small>{term?.name} · {r.used} of {r.rows * r.cols} seats</small></h3><p className="sp-board">Front · invigilator</p>
          <div className="sp-seats" style={{ gridTemplateColumns: `repeat(${r.cols}, minmax(0, 1fr))` }}>{r.seats.map((s) => <div key={s.row + '-' + s.col} className={s.student ? 'seat' : 'seat empty'}>{s.student ? <><b>{s.student.name}</b><small>{s.student.classLabel} · Roll {s.student.rollNo || '—'}</small></> : <small>Empty</small>}</div>)}</div></article>)}</div></>}
    </>}
    {(tab === 'admit' ? '' : tab === 'seats' ? 'Seat plan' : 'Exam routine') && <PrintFooter ctx={ctx} signs={['examCoordinator', 'principal']} />}
  </div>;
}

/* ------------------------------------------------------------ Continuous assessment and remarks */
export function CasEntry({ ctx, api }) {
  const [tab, setTab] = useState('cas'), [classes, classId, setClassId] = useClassPick(ctx), { busy, error, run } = useBusy();
  const terms = ctx.rows('terms'), [pickedTerm, setTerm] = useState(''), termId = terms.some((t) => t.id === pickedTerm) ? pickedTerm : terms.find((t) => t.status === 'Marks entry')?.id || terms[0]?.id || '';
  const subjects = ctx.rows('subjects').filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name));
  const [pickedSub, setSub] = useState(''), subjectId = subjects.some((s) => s.id === pickedSub) ? pickedSub : subjects[0]?.id || '', subject = by(subjects, subjectId);
  const students = classStudents(ctx.records, classId, ctx.year);
  const saved = useMemo(() => ctx.rows('cas').filter((x) => x.termId === termId && x.subjectId === subjectId), [ctx.records, termId, subjectId]);
  const [outOf, setOutOf] = useState({}), [scores, setScores] = useState({}), [remarks, setRemarks] = useState({});
  useEffect(() => { setScores({}); setOutOf({}); setRemarks({}); }, [termId, subjectId, classId, tab]);
  const full = (area) => outOf[area] ?? saved.find((x) => x.area === area)?.outOf ?? CAS_AREAS.find(([a]) => a === area)[1];
  const score = (sid, area) => scores[sid]?.[area] ?? saved.find((x) => x.studentId === sid && x.area === area)?.score ?? '';
  const savedRemark = (sid) => ctx.rows('reportRemarks').find((r) => r.studentId === sid && r.termId === termId);
  const remark = (sid, k) => remarks[sid]?.[k] ?? savedRemark(sid)?.[k] ?? '';
  if (!classes.length || !terms.length) return <><Header eyebrow="Examinations" title="Continuous assessment" /><Empty ctx={ctx} title="Add classes and an examination first" text="Scores are entered per class, subject and examination." go={!classes.length ? 'classes' : 'terms'} action={!classes.length ? 'Add classes' : 'Add examination'} /></>;
  const setScore = (sid, area, v) => setScores((s) => ({ ...s, [sid]: { ...s[sid], [area]: v.replace(/[^\d.]/g, '') } }));
  const preview = (sid) => casInternal(CAS_AREAS.map(([a]) => ({ score: score(sid, a), outOf: score(sid, a) === '' ? 0 : full(a) })), Number(subject?.practicalFull) || 0);
  const saveCas = () => run(async () => { const r = await api('/school/cas', 'POST', { year: ctx.year, termId, subjectId, outOf: Object.fromEntries(CAS_AREAS.map(([a]) => [a, full(a)])), rows: students.map((s) => ({ studentId: s.id, scores: Object.fromEntries(CAS_AREAS.map(([a]) => [a, score(s.id, a)])) })) }); await ctx.changed(r.saved ? `${r.saved} score${r.saved === 1 ? '' : 's'} saved.` : 'No changes to save.'); setScores({}); });
  const fill = () => run(async () => { const r = await api('/school/cas/fill', 'POST', { year: ctx.year, termId, subjectId }); await ctx.changed(`Internal marks filled for ${r.filled} student${r.filled === 1 ? '' : 's'} as drafts.${r.skipped ? ` ${r.skipped} already published, left unchanged.` : ''}`); });
  const saveRemarks = () => run(async () => { const r = await api('/school/remarks', 'POST', { year: ctx.year, termId, rows: students.map((s) => ({ studentId: s.id, remark: remark(s.id, 'remark'), conduct: remark(s.id, 'conduct') })) }); await ctx.changed(r.saved ? `${r.saved} remark${r.saved === 1 ? '' : 's'} saved.` : 'No changes to save.'); setRemarks({}); });
  const suggestions = ['Works hard and shows steady progress.', 'Participates actively in class.', 'Needs to complete homework regularly.', 'Should practise reading at home every day.', 'Helpful and respectful to classmates.'];
  return <div className="sp-page">
    <Header eyebrow="Examinations" title={tab === 'cas' ? 'Continuous assessment' : 'Report card remarks'} text={tab === 'cas' ? 'Score each area through the term. The total becomes the internal marks for the subject.' : 'The class teacher’s remark and conduct grade, printed on each grade sheet.'}>
      <Tabs value={tab} onChange={setTab} tabs={[['cas', 'CAS scores'], ...(can(ctx.user.role, 'reportRemarks', 'write') ? [['remarks', 'Remarks']] : [])]} />
      <Field label="Examination"><select value={termId} onChange={(e) => setTerm(e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Class"><ClassSelect list={classes} value={classId} onChange={setClassId} /></Field>
      {tab === 'cas' && <Field label="Subject"><select value={subjectId} onChange={(e) => setSub(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
    </Header>
    {tab === 'cas' ? (subject ? <section className="sp-card">
      <div className="sp-card-head"><h2>{subject.name} <small>Internal full marks {subject.practicalFull || 0}</small></h2></div>
      <div className="sp-table-wrap"><table className="sp-table sp-cas"><thead><tr><th>Roll</th><th>Student</th>{CAS_AREAS.map(([a]) => <th key={a}>{a}<input className="sp-mark small" aria-label={'Full marks for ' + a} value={full(a)} onChange={(e) => setOutOf((o) => ({ ...o, [a]: e.target.value.replace(/\D/g, '') }))} /></th>)}<th>Internal / {subject.practicalFull || 0}</th></tr></thead>
        <tbody>{students.map((s) => <tr key={s.id}><td>{s.rollNo || '–'}</td><td className="sp-strong">{s.name}</td>{CAS_AREAS.map(([a]) => <td key={a}><input className="sp-mark" inputMode="decimal" aria-label={`${a} for ${s.name}`} value={score(s.id, a)} onChange={(e) => setScore(s.id, a, e.target.value)} /></td>)}<td className="sp-strong">{preview(s.id) ?? '—'}</td></tr>)}</tbody></table></div>
      <Err error={error} />
      <div className="sp-foot"><span>{subject.practicalFull ? 'Fill internal marks copies these totals into Enter marks as drafts.' : 'This subject has no internal marks; scores are kept for the record.'}</span><span className="sp-row-actions"><button className="sp-btn" disabled={busy} onClick={saveCas}><Save size={16} /> Save scores</button>{subject.practicalFull > 0 && can(ctx.user.role, 'marks', 'write') && <button className="sp-btn sp-go" disabled={busy} onClick={fill}><BookOpenCheck size={16} /> Fill internal marks</button>}</span></div>
    </section> : <Empty ctx={ctx} title="This class has no subjects yet" text="Add the subjects taught in this class." go="subjects" action="Add subjects" />)
      : <section className="sp-card">
        <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Roll</th><th>Student</th><th>Conduct</th><th>Remark</th></tr></thead><tbody>{students.map((s) => <tr key={s.id}><td>{s.rollNo || '–'}</td><td className="sp-strong">{s.name}</td>
          <td><select value={remark(s.id, 'conduct')} onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: { ...r[s.id], conduct: e.target.value } }))}><option value="">—</option>{CONDUCT.map((c) => <option key={c}>{c}</option>)}</select></td>
          <td><input className="sp-remark" list="sp-remark-ideas" value={remark(s.id, 'remark')} placeholder="Write a short remark" onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: { ...r[s.id], remark: e.target.value } }))} /></td></tr>)}</tbody></table></div>
        <datalist id="sp-remark-ideas">{suggestions.map((x) => <option key={x} value={x} />)}</datalist>
        <Err error={error} />
        <div className="sp-foot"><span>Remarks show on grade sheets once results are published.</span><button className="sp-btn sp-go" disabled={busy} onClick={saveRemarks}><Save size={16} /> Save remarks</button></div>
      </section>}
  </div>;
}

/* ------------------------------------------------------------ Fee desk: daily collection, dues and advances */
export function FeeDesk({ ctx, api }) {
  const [tab, setTab] = useState('day'), [date, setDate] = useState(today()), [dues, setDues] = useState(null), [confirm, setConfirm] = useState(false), { busy, error, run } = useBusy();
  const students = ctx.rows('students').filter((s) => s.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)), name = (id) => by(ctx.records.students, id)?.name || '—';
  const invoices = ctx.records.fees || [], payments = ctx.rows('payments').filter((p) => p.date === date), advances = ctx.rows('advances');
  const dayAdvances = advances.filter((a) => a.date === date);
  const receipts = [...payments.filter((p) => p.method !== 'Advance').map((p) => ({ ...p, kind: 'Fee payment', student: name(by(invoices, p.invoiceId)?.studentId), ref: by(invoices, p.invoiceId)?.invoiceNo })), ...dayAdvances.map((a) => ({ ...a, kind: 'Advance', student: name(a.studentId), ref: '—' }))].sort((a, b) => String(a.receiptNo).localeCompare(String(b.receiptNo)));
  const byMethod = receipts.reduce((m, r) => ({ ...m, [r.method]: (m[r.method] || 0) + Number(r.amount) }), {});
  const total = receipts.reduce((s, r) => s + Number(r.amount), 0);
  const [adv, setAdv] = useState({ studentId: '', amount: '', method: 'Cash', reference: '' });
  const loadDues = () => run(async () => setDues(await api('/school/fees/reminders/preview', 'POST', { year: ctx.year })));
  useEffect(() => { if (tab === 'dues' && !dues) loadDues(); }, [tab]);
  const send = () => run(async () => { const r = await api('/school/fees/reminders/send', 'POST', { year: ctx.year }); setConfirm(false); await ctx.changed(r.configured ? `${r.queued} reminder SMS queued, ${r.sent} sent.` : `${r.queued} reminders prepared. The SMS gateway is not set up on the server, so nothing was sent.`); });
  const saveAdvance = () => run(async () => { await api('/records/advances', 'POST', { year: ctx.year, receiptNo: nextNo(advances, 'receiptNo', 'ADV-'), studentId: adv.studentId, amount: Number(adv.amount), date: today(), method: adv.method, reference: adv.reference, used: 0, status: 'Available' }); await ctx.changed(`Advance of ${npr(adv.amount)} received from ${name(adv.studentId)}. It will settle the next bill automatically.`); setAdv({ studentId: '', amount: '', method: 'Cash', reference: '' }); });
  const p = ctx.profile;
  return <div className="sp-page">
    {<PrintHeader ctx={ctx} title={'Fee collection'} />}
    <Header eyebrow="Fees" title={tab === 'day' ? 'Daily collection' : tab === 'dues' ? 'Dues & reminders' : 'Advance payments'} text={tab === 'day' ? 'Every receipt taken on a day, by payment method. Print it to close the cash book.' : tab === 'dues' ? 'Students with bills past their due date. Send a polite SMS reminder to their parents.' : 'Money paid before a bill is made. Monthly billing uses it to settle the next bill.'}>
      <Tabs value={tab} onChange={setTab} tabs={[['day', 'Daily collection'], ['dues', 'Dues & reminders'], ['advance', 'Advances']]} />
      {tab === 'day' && <Field label={`Date · ${formatBs(date)}`}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
      {tab === 'day' && <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>}
    </Header>
    {tab === 'day' && <>
      <div className="sp-tiles"><Tile tone="teal" value={npr(total)} label={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} /><Tile tone="blue" value={npr(byMethod.Cash || 0)} label="Cash" /><Tile tone="purple" value={npr((byMethod['Bank transfer'] || 0) + (byMethod.Cheque || 0))} label="Bank and cheque" /><Tile tone="orange" value={npr(['Online', 'eSewa', 'Khalti', 'Fonepay'].reduce((s, m) => s + (byMethod[m] || 0), 0))} label="Online and wallets" /></div>
      <section className="sp-card"><div className="sp-card-head"><h2>Receipts on {date} <small>{formatBs(date)}</small></h2></div>
        {receipts.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Receipt</th><th>Student</th><th>Type</th><th>Invoice</th><th>Method</th><th>Amount</th></tr></thead><tbody>{receipts.map((r) => <tr key={r.id}><td className="sp-strong">{r.receiptNo}</td><td>{r.student}</td><td>{r.kind}</td><td>{r.ref}</td><td>{r.method}</td><td className="sp-strong">{npr(r.amount)}</td></tr>)}<tr className="sp-total"><td colSpan={5}>Total</td><td>{npr(total)}</td></tr></tbody></table></div> : <p className="sp-muted">No receipts on this day.</p>}
        <p className="sp-note">Adjustments from advances are not new cash and are left out. Signature of cashier: ____________</p>
      </section></>}
    {tab === 'dues' && <section className="sp-card">
      <div className="sp-card-head"><h2>Overdue fees <small>{dues ? `${dues.students.length} students · ${npr(dues.total)}` : 'Loading…'}</small></h2>
        {dues?.students.length > 0 && can(ctx.user.role, 'notices', 'write') && (confirm ? <span className="sp-row-actions"><span>Text {dues.students.length} families?</span><button className="sp-btn sp-go" disabled={busy} onClick={send}><Send size={16} /> Yes, send</button><button className="sp-btn" onClick={() => setConfirm(false)}>Cancel</button></span> : <button className="sp-btn sp-go" onClick={() => setConfirm(true)}><Send size={16} /> Send SMS reminders</button>)}</div>
      {dues?.students.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Student</th><th>Class</th><th>Bills overdue</th><th>Oldest due date</th><th>Amount due</th><th>Phones</th></tr></thead><tbody>{dues.students.map((d) => <tr key={d.studentId}><td className="sp-strong">{d.name}</td><td>{classLabel(by(ctx.records.classes, d.classId))}</td><td>{d.bills}</td><td>{d.oldest} · {bsShort(d.oldest)}</td><td className="sp-strong">{npr(d.amount)}</td><td>{d.phones || <span className="sp-pill red">None</span>}</td></tr>)}</tbody></table></div> : dues && <p className="sp-muted">Nothing is overdue. Well done.</p>}
      <Err error={error} />
      <p className="sp-note">Fee rules in Settings: late fine {p.lateFineFlat ? npr(p.lateFineFlat) + ` per overdue bill after ${p.lateFineGraceDays || 0} days` : 'off'} · sibling discount {p.siblingDiscount || 0}% · staff child discount {p.staffChildDiscount || 0}% of tuition.</p>
    </section>}
    {tab === 'advance' && <>
      {can(ctx.user.role, 'advances', 'write') && <section className="sp-card"><div className="sp-card-head"><h2>Receive an advance</h2></div>
        <div className="sp-form-row">
          <Field label="Student"><select value={adv.studentId} onChange={(e) => setAdv({ ...adv, studentId: e.target.value })}><option value="">Choose a student…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} · {classLabel(by(ctx.records.classes, s.classId))}</option>)}</select></Field>
          <Field label="Amount (NPR)"><input inputMode="decimal" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
          <Field label="Method"><select value={adv.method} onChange={(e) => setAdv({ ...adv, method: e.target.value })}>{['Cash', 'Bank transfer', 'Cheque', 'Online', 'eSewa', 'Khalti', 'Fonepay'].map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Reference"><input value={adv.reference} onChange={(e) => setAdv({ ...adv, reference: e.target.value })} /></Field>
          <button className="sp-btn sp-go" disabled={busy || !adv.studentId || !(Number(adv.amount) > 0)} onClick={saveAdvance}><Wallet size={16} /> Save advance</button>
        </div><Err error={error} /></section>}
      <section className="sp-card"><div className="sp-card-head"><h2>Advances this year</h2></div>
        {advances.length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Receipt</th><th>Student</th><th>Date</th><th>Amount</th><th>Adjusted</th><th>Balance</th><th>Status</th></tr></thead><tbody>{[...advances].sort((a, b) => b.date.localeCompare(a.date)).map((a) => <tr key={a.id}><td className="sp-strong">{a.receiptNo}</td><td>{name(a.studentId)}</td><td>{a.date}</td><td>{npr(a.amount)}</td><td>{npr(a.used || 0)}</td><td className="sp-strong">{npr(Number(a.amount) - (Number(a.used) || 0))}</td><td><span className={'sp-pill ' + (a.status === 'Used' ? '' : 'green')}>{a.status}</span></td></tr>)}</tbody></table></div> : <p className="sp-muted">No advance payments yet.</p>}</section>
    </>}
    {<PrintFooter ctx={ctx} signs={['accountant']} />}
  </div>;
}

/* ------------------------------------------------------------ Books of account */
export function Accounts({ ctx, api }) {
  const [tab, setTab] = useState('daybook'), { busy, error, run } = useBusy();
  const start = ctx.year.slice(0, 4) + '-04-14', end = String(Number(ctx.year.slice(0, 4)) + 1) + '-04-13';
  const [from, setFrom] = useState(start), [to, setTo] = useState(today() < end ? today() : end);
  const accounts = useMemo(() => chartOfAccounts(ctx.rows('ledgerAccounts')), [ctx.records]);
  const entries = useMemo(() => ledgerEntries(ctx.records, ctx.year), [ctx.records, ctx.year]);
  const [code, setCode] = useState('1000'), account = accounts.find((a) => a.code === code) || accounts[0];
  const [v, setV] = useState({ date: today(), debitAccount: '', creditAccount: '', amount: '', narration: '' });
  const nm = (c) => accounts.find((a) => a.code === c)?.name || c;
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  const tb = trialBalance(entries, accounts, to), fs = financialStatements(entries, accounts, from, to), led = ledgerFor(entries, account.code, from, to, account.type);
  const saveVoucher = () => run(async () => { await api('/records/journals', 'POST', { year: ctx.year, voucherNo: nextNo(ctx.rows('journals'), 'voucherNo', 'JV-'), ...v, amount: Number(v.amount) }); await ctx.changed('Journal voucher saved.'); setV({ date: today(), debitAccount: '', creditAccount: '', amount: '', narration: '' }); });
  const AccountSelect = ({ value, onChange, label }) => <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Choose…</option>{['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((t) => <optgroup key={t} label={t}>{accounts.filter((a) => a.type === t).map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</optgroup>)}</select></Field>;
  const Money = ({ v }) => <>{v ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</>;
  return <div className="sp-page">
    {<PrintHeader ctx={ctx} title={'Books of account'} />}
    <Header eyebrow="Finance" title="Books of account" text="Double-entry books made automatically from bills, receipts, advances, income and expenditure, paid payslips and journal vouchers.">
      <Tabs value={tab} onChange={setTab} tabs={[['daybook', 'Day book'], ['ledger', 'Ledger'], ['trial', 'Trial balance'], ['income', 'Income & expenditure'], ['balance', 'Balance sheet'], ['vouchers', 'Journal vouchers']]} />
      {tab !== 'vouchers' && <><Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field><button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print</button></>}
    </Header>
    <p className="sp-note no-print">{formatBs(from)} to {formatBs(to)}. Payslips enter the books when they are marked Paid.</p>
    {tab === 'daybook' && <section className="sp-card"><div className="sp-card-head"><h2>Day book <small>{inRange.length} vouchers</small></h2></div>
      <div className="sp-table-wrap"><table className="sp-table sp-books"><thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{inRange.slice(-400).map((e, i) => <React.Fragment key={i}>{e.lines.map((l, j) => <tr key={j} className={j ? 'cont' : ''}><td>{j ? '' : e.date}</td><td>{j ? '' : e.voucher}</td><td>{l.cr ? <span className="indent">To {nm(l.account)}</span> : nm(l.account)}{j === e.lines.length - 1 && <small className="sp-narr">({e.narration})</small>}</td><td><Money v={l.dr} /></td><td><Money v={l.cr} /></td></tr>)}</React.Fragment>)}</tbody></table></div>
      {!inRange.length && <p className="sp-muted">No entries in this period.</p>}</section>}
    {tab === 'ledger' && <section className="sp-card"><div className="sp-card-head"><h2>{account.code} · {account.name} <small>{account.type}</small></h2><AccountSelect value={account.code} onChange={(c) => c && setCode(c)} label="Account" /></div>
      <div className="sp-table-wrap"><table className="sp-table sp-books"><thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody><tr className="cont"><td>{from}</td><td></td><td>Opening balance</td><td></td><td></td><td><Money v={led.opening} /></td></tr>{led.lines.map((l, i) => <tr key={i}><td>{l.date}</td><td>{l.voucher}</td><td>{l.narration}</td><td><Money v={l.dr} /></td><td><Money v={l.cr} /></td><td><Money v={l.balance} /></td></tr>)}<tr className="sp-total"><td colSpan={5}>Closing balance</td><td><Money v={led.closing} /></td></tr></tbody></table></div></section>}
    {tab === 'trial' && <section className="sp-card"><div className="sp-card-head"><h2>Trial balance as on {to} <small>{tb.dr === tb.cr ? 'Balanced' : 'Not balanced: check vouchers'}</small></h2></div>
      <div className="sp-table-wrap"><table className="sp-table sp-books"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{tb.rows.filter((r) => r.dr || r.cr).map((r) => { const net = r.dr - r.cr; return <tr key={r.code}><td>{r.code}</td><td className="sp-strong">{r.name}</td><td>{r.type}</td><td><Money v={net > 0 ? net : 0} /></td><td><Money v={net < 0 ? -net : 0} /></td></tr>; })}
        <tr className="sp-total"><td colSpan={3}>Total</td><td><Money v={tb.rows.reduce((s, r) => s + Math.max(0, r.dr - r.cr), 0)} /></td><td><Money v={tb.rows.reduce((s, r) => s + Math.max(0, r.cr - r.dr), 0)} /></td></tr></tbody></table></div></section>}
    {tab === 'income' && <section className="sp-card"><div className="sp-card-head"><h2>Income and expenditure <small>{from} to {to}</small></h2></div>
      <div className="sp-statement"><div><h3>Income</h3>{fs.income.map((a) => <p key={a.code}><span>{a.name}</span><b><Money v={a.balance} /></b></p>)}<p className="sum"><span>Total income</span><b><Money v={fs.income.reduce((s, a) => s + a.balance, 0)} /></b></p></div>
        <div><h3>Expenditure</h3>{fs.expense.map((a) => <p key={a.code}><span>{a.name}</span><b><Money v={a.balance} /></b></p>)}<p className="sum"><span>Total expenditure</span><b><Money v={fs.expense.reduce((s, a) => s + a.balance, 0)} /></b></p></div></div>
      <p className={'sp-result ' + (fs.surplus >= 0 ? 'good' : 'bad')}>{fs.surplus >= 0 ? 'Surplus' : 'Deficit'} for the period: <b>{npr(Math.abs(fs.surplus))}</b></p></section>}
    {tab === 'balance' && <section className="sp-card"><div className="sp-card-head"><h2>Balance sheet as on {to} <small>{Math.abs(fs.totalAssets - fs.totalClaims) < 0.01 ? 'Balanced' : 'Not balanced'}</small></h2></div>
      <div className="sp-statement"><div><h3>Capital and liabilities</h3>{fs.equity.map((a) => <p key={a.code}><span>{a.name}</span><b><Money v={a.balance} /></b></p>)}<p><span>Accumulated surplus</span><b><Money v={fs.retained} /></b></p>{fs.liabilities.map((a) => <p key={a.code}><span>{a.name}</span><b><Money v={a.balance} /></b></p>)}<p className="sum"><span>Total</span><b><Money v={fs.totalClaims} /></b></p></div>
        <div><h3>Assets</h3>{fs.assets.map((a) => <p key={a.code}><span>{a.name}</span><b><Money v={a.balance} /></b></p>)}<p className="sum"><span>Total</span><b><Money v={fs.totalAssets} /></b></p></div></div></section>}
    {tab === 'vouchers' && <>
      {can(ctx.user.role, 'journals', 'write') && <section className="sp-card"><div className="sp-card-head"><h2>New journal voucher</h2>{can(ctx.user.role, 'ledgerAccounts', 'write') && <button className="sp-btn" onClick={() => ctx.setDrawer({ entity: 'ledgerAccounts' })}><Plus size={16} /> Add an account</button>}</div>
        <div className="sp-form-row"><Field label="Date"><input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field><AccountSelect label="Debit" value={v.debitAccount} onChange={(c) => setV({ ...v, debitAccount: c })} /><AccountSelect label="Credit" value={v.creditAccount} onChange={(c) => setV({ ...v, creditAccount: c })} /><Field label="Amount (NPR)"><input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field></div>
        <Field label="Narration"><input value={v.narration} placeholder="For example: Opening cash balance, or Bank charges for Kartik" onChange={(e) => setV({ ...v, narration: e.target.value })} /></Field>
        <Err error={error} />
        <div className="sp-foot"><span>Use vouchers for opening balances, bank charges, depreciation and corrections.</span><button className="sp-btn sp-go" disabled={busy || !v.debitAccount || !v.creditAccount || !(Number(v.amount) > 0) || !v.narration.trim()} onClick={saveVoucher}><Receipt size={16} /> Save voucher</button></div></section>}
      <section className="sp-card"><div className="sp-card-head"><h2>Vouchers this year</h2></div>{ctx.rows('journals').length ? <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Voucher</th><th>Date</th><th>Debit</th><th>Credit</th><th>Amount</th><th>Narration</th></tr></thead><tbody>{[...ctx.rows('journals')].sort((a, b) => b.date.localeCompare(a.date)).map((j) => <tr key={j.id}><td className="sp-strong">{j.voucherNo}</td><td>{j.date}</td><td>{nm(j.debitAccount)}</td><td>{nm(j.creditAccount)}</td><td>{npr(j.amount)}</td><td>{j.narration}</td></tr>)}</tbody></table></div> : <p className="sp-muted">No journal vouchers yet.</p>}</section>
    </>}
    {<PrintFooter ctx={ctx} signs={['accountant', 'principal']} />}
  </div>;
}

/* ------------------------------------------------------------ School calendar (BS) */
const EVENT_TONE = { 'Public holiday': 'red', 'School holiday': 'red', Event: 'blue', Examination: 'purple', 'Parent–teacher meeting': 'amber', Other: '' };
export function SchoolCalendar({ ctx }) {
  const now = adToBs(today()) || { year: BS_FIRST + 3, month: 1 };
  const [ym, setYm] = useState({ y: now.year, m: now.month }), write = can(ctx.user.role, 'events', 'write');
  const days = bsMonthDays(ym.y, ym.m), first = bsToAd(ym.y, ym.m, 1), lead = new Date(first + 'T00:00:00Z').getUTCDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ({ d: i + 1, ad: bsToAd(ym.y, ym.m, i + 1) }))];
  const events = ctx.rows('events'), exams = ctx.rows('examSchedule');
  const step = (n) => setYm(({ y, m }) => { let mm = m + n, yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } return yy < BS_FIRST || yy > BS_LAST ? { y, m } : { y: yy, m: mm }; });
  const upcoming = events.filter((e) => (e.endDate || e.date) >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  return <div className="sp-page">
    <Header eyebrow="Calendar" title="School calendar" text="Holidays, events, examinations and meetings, in Bikram Sambat with the AD date below each day. Saturday and Sunday are weekly holidays.">
      <div className="sp-month-nav"><button className="sp-btn" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeft size={16} /></button><b>{BS_MONTHS[ym.m - 1]} {ym.y}</b><button className="sp-btn" aria-label="Next month" onClick={() => step(1)}><ChevronRight size={16} /></button></div>
      <button className="sp-btn" onClick={() => setYm({ y: now.year, m: now.month })}>Today</button>
      {write && <button className="sp-btn sp-go" onClick={() => ctx.setDrawer({ entity: 'events', defaults: { date: today(), type: 'Event', audience: 'Everyone' } })}><Plus size={16} /> Add event</button>}
    </Header>
    {isProjected(ym.y) && <p className="sp-note">Month lengths for {ym.y} BS are projected until the official calendar is published. Check holidays against the published calendar.</p>}
    <section className="sp-card"><div className="sp-cal">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <b key={d} className="sp-cal-head">{d}</b>)}
      {cells.map((c, i) => c ? <div key={i} className={'sp-cal-day' + (c.ad === today() ? ' today' : '') + (isWeeklyHoliday(c.ad) || events.some((e) => ['Public holiday', 'School holiday'].includes(e.type) && e.date <= c.ad && (e.endDate || e.date) >= c.ad) ? ' holiday' : '')} onClick={() => write && ctx.setDrawer({ entity: 'events', defaults: { date: c.ad, type: 'Event', audience: 'Everyone' } })}>
        <span className="n">{c.d}</span><small className="ad">{c.ad.slice(5).replace('-', '/')}</small>
        {eventsOn({ events }, c.ad).map((e) => <button key={e.id} className={'sp-ev ' + (EVENT_TONE[e.type] || '')} onClick={(ev) => { ev.stopPropagation(); ctx.setDrawer({ entity: 'events', record: e }); }}>{e.name}</button>)}
        {exams.some((x) => x.date === c.ad) && <span className="sp-ev purple">Exam papers</span>}</div> : <div key={i} className="sp-cal-day blank" />)}</div></section>
    <section className="sp-card"><div className="sp-card-head"><h2><CalendarDays size={18} /> Coming up</h2></div>
      {upcoming.length ? <ul className="sp-list">{upcoming.map((e) => <li key={e.id}><div><b>{e.name}</b><small>{formatBs(e.date)}{e.endDate && e.endDate !== e.date ? ' – ' + formatBs(e.endDate) : ''} · {e.date}</small></div><span className={'sp-pill ' + (EVENT_TONE[e.type] || '')}>{e.type}</span></li>)}</ul> : <p className="sp-muted">Nothing scheduled yet.</p>}</section>
  </div>;
}

/* ------------------------------------------------------------ Messages */
export function Messages({ ctx, api }) {
  const fam = family(ctx), { busy, error, run } = useBusy(), [text, setText] = useState(''), [query, setQuery] = useState('');
  const msgs = ctx.rows('messages'), students = ctx.rows('students').filter((s) => s.status === 'Active');
  const unread = (sid) => msgs.filter((m) => m.studentId === sid && (fam ? m.fromSide === 'School' && m.readByFamily !== 'Yes' : m.fromSide === 'Family' && m.readBySchool !== 'Yes')).length;
  const last = (sid) => msgs.filter((m) => m.studentId === sid).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const threads = (fam ? students : students.filter((s) => msgs.some((m) => m.studentId === s.id))).sort((a, b) => String(last(b.id)?.createdAt || '').localeCompare(String(last(a.id)?.createdAt || '')));
  const [openId, setOpen] = useState(''), current = by(students, openId) || threads[0];
  const thread = current ? msgs.filter((m) => m.studentId === current.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))) : [];
  useEffect(() => { if (current && unread(current.id)) api('/school/messages/read', 'POST', { year: ctx.year, studentId: current.id }).then(() => ctx.changed('')).catch(() => {}); }, [current?.id]);
  const send = () => run(async () => { await api('/school/messages/send', 'POST', { year: ctx.year, studentId: current.id, body: text }); setText(''); await ctx.changed('Message sent.'); });
  const found = query.trim() ? students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const cls = (s) => classLabel(by(ctx.records.classes, s.classId));
  return <div className="sp-page">
    <Header eyebrow="Messages" title="Messages" text={fam ? 'Write to your child’s class teacher and the school office. Replies appear here.' : 'Conversations with families. The class teacher is notified when a parent writes.'} />
    <section className="sp-card sp-chat">
      <aside>
        {!fam && <div className="sp-chat-new"><input placeholder="Start a conversation: search a student…" value={query} onChange={(e) => setQuery(e.target.value)} />{found.length > 0 && <ul>{found.map((s) => <li key={s.id}><button onClick={() => { setOpen(s.id); setQuery(''); }}>{s.name}<small>{cls(s)}</small></button></li>)}</ul>}</div>}
        <ul className="sp-threads">{threads.map((s) => <li key={s.id}><button className={current?.id === s.id ? 'on' : ''} onClick={() => setOpen(s.id)}><b>{s.name}</b><small>{cls(s)}{last(s.id) ? ' · ' + last(s.id).body.slice(0, 40) : ''}</small>{unread(s.id) > 0 && <i>{unread(s.id)}</i>}</button></li>)}
          {!threads.length && <li className="sp-muted">No conversations yet.</li>}</ul>
      </aside>
      <div className="sp-thread">
        {current ? <><header><b>{current.name}</b><small>{cls(current)}</small></header>
          <div className="sp-bubbles">{thread.map((m) => <div key={m.id} className={'sp-bubble ' + ((m.fromSide === 'Family') === fam ? 'mine' : 'theirs')}><p>{m.body}</p><small>{m.author} · {String(m.createdAt || '').slice(0, 16).replace('T', ' ')}{(m.fromSide === 'Family') === fam && ((fam ? m.readBySchool : m.readByFamily) === 'Yes' ? ' · Read' : '')}</small></div>)}
            {!thread.length && <p className="sp-muted">No messages yet. Write the first one below.</p>}</div>
          {can(ctx.user.role, 'messages', 'write') && <div className="sp-composer"><textarea rows={2} maxLength={2000} value={text} placeholder={fam ? 'Write to the school…' : `Write to ${current.name}’s family…`} onChange={(e) => setText(e.target.value)} /><button className="sp-btn sp-go" disabled={busy || !text.trim()} onClick={send}><Send size={16} /> Send</button></div>}
          <Err error={error} /></> : <p className="sp-muted">Choose a conversation.</p>}
      </div>
    </section>
  </div>;
}

/* ------------------------------------------------------------ Family home: what is coming up */
export function ComingUp({ ctx, child }) {
  const t = today(), soon = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
  const events = ctx.rows('events').filter((e) => (e.endDate || e.date) >= t && e.date <= soon);
  const papers = ctx.rows('examSchedule').filter((p) => p.classId === child?.classId && p.date >= t && p.date <= soon);
  const items = [...events.map((e) => ({ id: e.id, date: e.date, title: e.name, tag: e.type })), ...papers.map((p) => ({ id: p.id, date: p.date, title: (by(ctx.rows('subjects'), p.subjectId)?.name || 'Exam') + ' exam', tag: `${p.startTime}–${p.endTime}` }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const day = weekday(t), todayRoutine = ctx.rows('routine').filter((r) => r.classId === child?.classId && r.day === day).sort((a, b) => a.period - b.period);
  return <div className="sp-two">
    <section className="sp-card"><div className="sp-card-head"><h2><CalendarDays size={18} /> Coming up</h2><button className="sp-link" onClick={() => ctx.go('school-calendar')}>Calendar</button></div>
      {items.length ? <ul className="sp-list">{items.map((x) => <li key={x.id}><div><b>{x.title}</b><small>{formatBs(x.date)} · {weekday(x.date)}</small></div><span className="sp-pill">{x.tag}</span></li>)}</ul> : <p className="sp-muted">Nothing in the next three weeks.</p>}</section>
    <section className="sp-card"><div className="sp-card-head"><h2><ClipboardList size={18} /> Today’s routine</h2><button className="sp-link" onClick={() => ctx.go('school-routine')}>Full routine</button></div>
      {todayRoutine.length ? <ul className="sp-list">{todayRoutine.map((r) => <li key={r.id}><div><b>{by(ctx.rows('subjects'), r.subjectId)?.name || 'Period ' + r.period}</b><small>Period {r.period} · {r.startTime}–{r.endTime}</small></div></li>)}</ul> : <p className="sp-muted">{day === 'Saturday' ? 'Saturday: no school.' : 'No routine published for today.'}</p>}
      <button className="sp-btn" onClick={() => ctx.go('school-messages')}><MessageSquare size={16} /> Message the school</button></section>
  </div>;
}

/* ------------------------------------------------------------ Grade sheet remark (used by SchoolPages) */
export function remarkFor(records, studentId, termId) { return (records.reportRemarks || []).find((r) => r.studentId === studentId && r.termId === termId) || null; }
export const opsPageIcons = { 'school-routine': CalendarDays, 'school-staff-attendance': UserCheck, 'school-exams': IdCard, 'school-cas': BookOpenCheck, 'school-collection': Wallet, 'school-accounts': Landmark, 'school-calendar': CalendarDays, 'school-messages': MessageSquare, people: Users };
