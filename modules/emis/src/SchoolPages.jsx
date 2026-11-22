import React, { useEffect, useMemo, useState } from 'react';
import { Letterhead, LetterFooter, PrintHeader, PrintFooter, logoSrc } from './Letterhead.jsx';
import { CheckCheck, ClipboardList, Award, Wallet, Printer, Save, Send, Users, CalendarDays, ArrowRight, Info, CircleAlert } from 'lucide-react';
import { can } from '../shared/schema.mjs';
import { holidayOn, remarkFor } from './SchoolOps.jsx';
import { formatBs, academicYearLabel } from '../shared/bs.mjs';
import { sortClasses, classLabel, classStudents, subjectResult, gradeSheets, GRADING, GPA_BANDS, MONTHS_BS, attendanceSummary } from '../shared/school.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const npr = (v) => 'NPR ' + new Intl.NumberFormat('en-IN').format(Math.round(v || 0));
const ATTENDANCE = [['Present', 'P'], ['Absent', 'A'], ['Late', 'L'], ['Leave', 'Lv']];

function Header({ eyebrow, title, text, children }) {
  return <div className="sp-head"><div><span className="sp-eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <div className="sp-head-actions">{children}</div>}</div>;
}
function Setup({ ctx, title, text, go, action }) {
  return <div className="sp-empty"><span><Info size={22} /></span><strong>{title}</strong><p>{text}</p>{go && can(ctx.user.role, go, 'write') && <button className="sp-btn sp-go" onClick={() => ctx.go(go)}>{action} <ArrowRight size={16} /></button>}</div>;
}
function Field({ label, children }) { return <label className="sp-field"><span>{label}</span>{children}</label>; }
function useClasses(ctx) {
  const list = sortClasses(ctx.rows('classes').filter((c) => c.status !== 'Closed'));
  const [picked, setClassId] = useState('');
  const classId = list.some((c) => c.id === picked) ? picked : list[0]?.id || '';
  return [list, classId, setClassId];
}
const ClassSelect = ({ list, value, onChange }) => <select value={value} onChange={(e) => onChange(e.target.value)}>{list.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</select>;

/* ------------------------------------------------------------------ Daily attendance */
export function SchoolAttendance({ ctx, api }) {
  const [classes, classId, setClassId] = useClasses(ctx);
  const [date, setDate] = useState(today()), [marks, setMarks] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const students = classStudents(ctx.records, classId, ctx.year);
  const existing = useMemo(() => Object.fromEntries(ctx.rows('schoolAttendance').filter((a) => a.date === date && a.classId === classId).map((a) => [a.studentId, a.status])), [ctx.records, date, classId]);
  useEffect(() => { setMarks({}); setError(''); }, [classId, date]);
  if (!classes.length) return <><Header eyebrow="Daily attendance" title="Take attendance" /><Setup ctx={ctx} title="Add your classes first" text="Attendance is taken per class and section. Add classes such as Grade 5 · A, then add students to them." go="classes" action="Add classes" /></>;
  const status = (id) => marks[id] || existing[id] || 'Present';
  const counts = Object.fromEntries(ATTENDANCE.map(([s]) => [s, students.filter((x) => status(x.id) === s).length]));
  const taken = students.length > 0 && students.every((s) => existing[s.id]);
  async function save() {
    setBusy(true); setError('');
    try { const r = await api('/school/attendance', 'POST', { year: ctx.year, classId, date, rows: students.map((s) => ({ studentId: s.id, status: status(s.id) })) }); await ctx.changed(r.saved ? `Attendance saved for ${r.saved} student${r.saved === 1 ? '' : 's'}.` : 'No changes to save.'); setMarks({}); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="sp-page">
    <Header eyebrow="Daily attendance" title="Take attendance" text="Everyone starts as present. Tap the students who are absent, late or on leave, then save.">
      <Field label="Class"><ClassSelect list={classes} value={classId} onChange={setClassId} /></Field>
      <Field label={'Date · ' + formatBs(date)}><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
    </Header>
    {holidayOn(ctx.records, date) && <p className="sp-note">{formatBs(date)} is a holiday: {holidayOn(ctx.records, date).name} ({holidayOn(ctx.records, date).type}). Attendance is not normally taken today.</p>}
    <div className="sp-tiles">
      {ATTENDANCE.map(([s], i) => <div key={s} className={'sp-tile tone-' + ['teal', 'rose', 'orange', 'purple'][i]}><strong>{counts[s]}</strong><span>{s}</span></div>)}
    </div>
    <section className="sp-card">
      <div className="sp-card-head"><h2>{classLabel(classes.find((c) => c.id === classId))} <small>{students.length} students</small></h2>
        <div className="sp-row-actions">{taken && <span className="sp-pill green">Taken for this date</span>}<button className="sp-btn" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'Present'])))}><CheckCheck size={16} /> Mark all present</button></div></div>
      {students.length ? <ul className="sp-register">{students.map((s) => <li key={s.id} className={'st-' + status(s.id).toLowerCase()}>
        <span className="sp-roll">{s.rollNo || '–'}</span><span className="sp-name">{s.name}</span>
        <span className="sp-seg" role="radiogroup" aria-label={'Attendance for ' + s.name}>{ATTENDANCE.map(([v, short]) => <button key={v} type="button" role="radio" aria-checked={status(s.id) === v} aria-label={v} title={v} className={'seg-' + v.toLowerCase()} onClick={() => setMarks((m) => ({ ...m, [s.id]: v }))}>{short}</button>)}</span>
      </li>)}</ul> : <Setup ctx={ctx} title="No students in this class" text="Add students and choose this class on their record." go="students" action="Add students" />}
      {error && <p className="sp-error" role="alert"><CircleAlert size={16} /> {error}</p>}
      {students.length > 0 && <div className="sp-foot"><span>{counts.Absent} absent · {counts.Late} late · {counts.Leave} on leave</span><button className="sp-btn sp-go" disabled={busy} onClick={save}><Save size={16} /> {busy ? 'Saving…' : 'Save attendance'}</button></div>}
    </section>
  </div>;
}

/* ------------------------------------------------------------------ Marks entry */
export function SchoolMarks({ ctx, api }) {
  const [classes, classId, setClassId] = useClasses(ctx);
  const terms = ctx.rows('terms'), [pickedTerm, setTermId] = useState(''), termId = terms.some((t) => t.id === pickedTerm) ? pickedTerm : terms.find((t) => t.status === 'Marks entry')?.id || terms[0]?.id || '';
  const subjects = ctx.rows('subjects').filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name));
  const [picked, setSubjectId] = useState('');
  const subjectId = subjects.some((s) => s.id === picked) ? picked : subjects[0]?.id || '';
  const subject = subjects.find((s) => s.id === subjectId), term = terms.find((t) => t.id === termId);
  const students = classStudents(ctx.records, classId, ctx.year);
  const saved = useMemo(() => Object.fromEntries(ctx.rows('marks').filter((m) => m.termId === termId && m.subjectId === subjectId).map((m) => [m.studentId, m])), [ctx.records, termId, subjectId]);
  const [edits, setEdits] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setEdits({}); setError(''); }, [termId, subjectId]);
  const publisher = ctx.user.role !== 'Faculty';
  if (!classes.length || !terms.length) return <><Header eyebrow="Examinations" title="Enter marks" /><Setup ctx={ctx} title={!classes.length ? 'Add your classes first' : 'Add an examination first'} text={!classes.length ? 'Marks are entered per class and subject.' : 'Create the examination (for example First Terminal) for this academic year.'} go={!classes.length ? 'classes' : 'terms'} action={!classes.length ? 'Add classes' : 'Add examination'} /></>;
  const value = (id, k) => edits[id]?.[k] ?? (saved[id]?.[k] ?? '');
  const set = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const preview = (s) => subject && subjectResult(subject, { theory: value(s.id, 'theory') === '' ? undefined : Number(value(s.id, 'theory')), practical: value(s.id, 'practical') === '' ? undefined : Number(value(s.id, 'practical')), absent: value(s.id, 'absent') || 'No' });
  const entered = students.filter((s) => value(s.id, 'theory') !== '' || value(s.id, 'absent') === 'Yes').length;
  async function save(publish) {
    setBusy(true); setError('');
    try {
      const rows = students.map((s) => ({ studentId: s.id, theory: value(s.id, 'theory'), practical: value(s.id, 'practical'), absent: value(s.id, 'absent') || 'No' }));
      const r = await api('/school/marks', 'POST', { year: ctx.year, termId, subjectId, publish, rows });
      await ctx.changed(r.saved ? `${r.saved} mark${r.saved === 1 ? '' : 's'} ${publish ? 'published' : 'saved as draft'}.` : 'No changes to save.'); setEdits({});
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="sp-page">
    <Header eyebrow="Examinations" title="Enter marks" text={`Grades follow Nepal's letter grading: a subject is NG below ${GRADING.theoryMin}% in theory or ${GRADING.internalMin}% in practical.`}>
      <Field label="Examination"><select value={termId} onChange={(e) => setTermId(e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Class"><ClassSelect list={classes} value={classId} onChange={setClassId} /></Field>
      <Field label="Subject"><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!subjects.length}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    </Header>
    {!subject ? <Setup ctx={ctx} title="This class has no subjects yet" text="Add the subjects taught in this class, with credit hours and full marks." go="subjects" action="Add subjects" /> :
      <section className="sp-card">
        <div className="sp-card-head"><h2>{subject.name} <small>Theory {subject.theoryFull}{subject.practicalFull ? ` · Practical ${subject.practicalFull}` : ''} · {subject.creditHours} credit hours</small></h2>
          <div className="sp-row-actions"><span className="sp-pill">{entered} of {students.length} entered</span>{term?.status === 'Published' && <span className="sp-pill green">Published</span>}</div></div>
        <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Roll</th><th>Student</th><th>Theory / {subject.theoryFull}</th>{subject.practicalFull > 0 && <th>Practical / {subject.practicalFull}</th>}<th>Absent</th><th>Grade</th><th>Status</th></tr></thead>
          <tbody>{students.map((s) => { const p = preview(s), st = saved[s.id]?.status; return <tr key={s.id}>
            <td>{s.rollNo || '–'}</td><td className="sp-strong">{s.name}</td>
            <td><input className="sp-mark" inputMode="decimal" aria-label={'Theory marks for ' + s.name} value={value(s.id, 'theory')} disabled={value(s.id, 'absent') === 'Yes'} onChange={(e) => set(s.id, 'theory', e.target.value.replace(/[^\d.]/g, ''))} /></td>
            {subject.practicalFull > 0 && <td><input className="sp-mark" inputMode="decimal" aria-label={'Practical marks for ' + s.name} value={value(s.id, 'practical')} disabled={value(s.id, 'absent') === 'Yes'} onChange={(e) => set(s.id, 'practical', e.target.value.replace(/[^\d.]/g, ''))} /></td>}
            <td><input type="checkbox" aria-label={s.name + ' was absent'} checked={value(s.id, 'absent') === 'Yes'} onChange={(e) => set(s.id, 'absent', e.target.checked ? 'Yes' : 'No')} /></td>
            <td>{p?.entered ? <span className={'sp-grade g-' + p.grade.replace('+', 'p')}>{p.grade}</span> : <span className="sp-muted">—</span>}</td>
            <td>{st ? <span className={'sp-pill ' + (st === 'Published' ? 'green' : '')}>{st}</span> : <span className="sp-muted">Not saved</span>}</td>
          </tr>; })}</tbody></table></div>
        {error && <p className="sp-error" role="alert"><CircleAlert size={16} /> {error}</p>}
        <div className="sp-foot"><span>{publisher ? 'Publishing makes these marks visible to students and parents.' : 'Teachers save drafts. The examination team publishes results.'}</span>
          <span className="sp-row-actions"><button className="sp-btn" disabled={busy} onClick={() => save(false)}><Save size={16} /> Save draft</button>{publisher && can(ctx.user.role, 'marks', 'write') && <button className="sp-btn sp-go" disabled={busy} onClick={() => save(true)}><Send size={16} /> Publish</button>}</span></div>
      </section>}
  </div>;
}

/* ------------------------------------------------------------------ Grade sheets */
function GradeSheet({ ctx, sheet, term, cls, hideRank }) {
  const s = sheet.summary, profile = ctx.profile;
  return <article className="sp-sheet">
    <Letterhead ctx={ctx} title="GRADE SHEET" subtitle={`${term?.name || ''} · Academic year ${academicYearLabel(ctx.year)}`} />
    <dl className="sp-sheet-meta"><div><dt>Student</dt><dd>{sheet.student.name}</dd></div><div><dt>Class</dt><dd>{classLabel(cls)}</dd></div><div><dt>Roll no.</dt><dd>{sheet.student.rollNo || '—'}</dd></div><div><dt>Student ID</dt><dd>{sheet.student.studentNo}</dd></div></dl>
    <table><thead><tr><th>Subject</th><th>Credit hour</th><th>Theory</th><th>Practical</th><th>Final grade</th><th>Grade point</th></tr></thead>
      <tbody>{sheet.results.map((r) => <tr key={r.subjectId}><td>{r.name}{r.additional && <sup title="Additional subject: not counted in GPA"> *</sup>}</td><td>{r.creditHours}</td><td>{r.entered ? r.theoryGrade || '—' : '…'}</td><td>{r.entered ? r.practicalGrade || '—' : '…'}</td><td><b>{r.entered ? r.grade : '…'}</b></td><td>{r.entered ? r.gp.toFixed(1) : '…'}</td></tr>)}</tbody></table>
    <div className="sp-sheet-sum"><div><span>Grade point average</span><strong>{s.gpa !== null ? s.gpa.toFixed(2) : s.anyNg ? 'NG' : 'Pending'}</strong></div><div><span>Overall grade</span><strong>{s.grade || 'Pending'}</strong></div>{!hideRank && <div><span>Rank</span><strong>{sheet.rank || '—'}</strong></div>}<div><span>Attendance</span><strong>{sheet.attendance.days ? `${sheet.attendance.present}/${sheet.attendance.days}` : '—'}</strong></div></div>
    {(() => { const r = remarkFor(ctx.records, sheet.student.id, term?.id); return r ? <div className="sp-sheet-remark"><span>Class teacher’s remark{r.conduct ? ` · Conduct: ${r.conduct}` : ''}</span><p>{r.remark}</p></div> : null; })()}
    <p className="sp-sheet-scale">{sheet.results.some((r) => r.additional) && <>* Additional subject, not counted in GPA. </>}{GPA_BANDS.slice(0, 6).map(([min, g]) => `${g} ${min.toFixed(1)}+`).join(' · ')} · NG: below {GRADING.theoryMin}% in theory or {GRADING.internalMin}% in practical</p>
    <LetterFooter ctx={ctx} signs={['classTeacher', 'examCoordinator', 'principal']} seal />
  </article>;
}
export function SchoolResults({ ctx }) {
  const student = ['Student', 'Parent'].includes(ctx.user.role), kids = ctx.rows('students'), [childId, setChild] = useState(''), child = kids.find((k) => k.id === childId) || kids[0];
  const [classes, classId, setClassId] = useClasses(ctx);
  const terms = ctx.rows('terms'), [pickedTerm, setTermId] = useState(''), termId = terms.some((t) => t.id === pickedTerm) ? pickedTerm : [...terms].reverse().find((t) => t.status === 'Published')?.id || terms[0]?.id || '';
  const [open, setOpen] = useState(null);
  const myClass = student ? child?.classId : classId;
  const data = useMemo(() => myClass && termId ? gradeSheets(ctx.records, { classId: myClass, termId, year: ctx.year, publishedOnly: student }) : null, [ctx.records, myClass, termId, ctx.year]);
  if (!terms.length || (!student && !classes.length)) return <><Header eyebrow="Results" title={student ? 'My grade sheets' : 'Grade sheets'} /><Setup ctx={ctx} title={student ? 'No results yet' : 'Nothing to show yet'} text={student ? 'Your grade sheet appears here when the school publishes results.' : 'Add classes, subjects and an examination, then enter marks.'} go={student ? null : !classes.length ? 'classes' : 'terms'} action={!classes.length ? 'Add classes' : 'Add examination'} /></>;
  const cls = ctx.records.classes?.find((c) => c.id === myClass);
  const sheets = data?.sheets || [], mine = student ? sheets.filter((x) => x.student.id === child?.id) : sheets;
  const shown = open ? mine.filter((x) => x.student.id === open) : mine;
  const graded = sheets.filter((x) => x.summary.gpa !== null);
  return <div className="sp-page">
    <Header eyebrow="Results" title={student ? (ctx.user.role === 'Parent' ? 'Grade sheets' : 'My grade sheets') : 'Grade sheets'} text={student ? 'Published results only.' : 'Class result ledger and printable grade sheets for each student.'}>
      <Field label="Examination"><select value={termId} onChange={(e) => { setTermId(e.target.value); setOpen(null); }}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      {!student && <Field label="Class"><ClassSelect list={classes} value={classId} onChange={(v) => { setClassId(v); setOpen(null); }} /></Field>}
      {student && kids.length > 1 && <Field label="Child"><select value={child?.id} onChange={(e) => setChild(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>}
      <button className="sp-btn" onClick={() => window.print()}><Printer size={16} /> Print {open || student ? 'grade sheet' : 'all grade sheets'}</button>
    </Header>
    {!student && <>
      <div className="sp-tiles">
        <div className="sp-tile tone-blue"><strong>{sheets.length}</strong><span>Students</span></div>
        <div className="sp-tile tone-teal"><strong>{graded.length}</strong><span>Graded</span></div>
        <div className="sp-tile tone-rose"><strong>{sheets.filter((x) => x.summary.anyNg).length}</strong><span>With an NG subject</span></div>
        <div className="sp-tile tone-purple"><strong>{graded.length ? (graded.reduce((a, x) => a + x.summary.gpa, 0) / graded.length).toFixed(2) : '—'}</strong><span>Class average GPA</span></div>
      </div>
      <section className="sp-card no-print"><div className="sp-card-head"><h2>Result ledger <small>{classLabel(cls)} · {data?.term?.name}</small></h2></div>
        <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Rank</th><th>Roll</th><th>Student</th>{data?.subjects.map((s) => <th key={s.id}>{s.name}</th>)}<th>GPA</th><th>Grade</th><th>Attendance</th><th></th></tr></thead>
          <tbody>{sheets.map((x) => <tr key={x.student.id}><td>{x.rank || '—'}</td><td>{x.student.rollNo || '–'}</td><td className="sp-strong">{x.student.name}</td>
            {x.results.map((r) => <td key={r.subjectId}>{r.entered ? <span className={'sp-grade g-' + r.grade.replace('+', 'p')}>{r.grade}</span> : <span className="sp-muted">…</span>}</td>)}
            <td className="sp-strong">{x.summary.gpa !== null ? x.summary.gpa.toFixed(2) : x.summary.anyNg ? 'NG' : '…'}</td><td>{x.summary.grade || '…'}</td><td>{x.attendance.rate !== null ? x.attendance.rate + '%' : '—'}</td>
            <td><button className="sp-link" onClick={() => setOpen(open === x.student.id ? null : x.student.id)}>{open === x.student.id ? 'Show all' : 'Grade sheet'}</button></td></tr>)}</tbody></table></div>
      </section>
    </>}
    {shown.length ? <div className="sp-sheets">{shown.map((x) => <GradeSheet key={x.student.id} ctx={ctx} sheet={x} term={data.term} cls={cls} hideRank={student} />)}</div>
      : student && <Setup ctx={ctx} title="Not published yet" text="Your grade sheet for this examination will appear when the school publishes results." />}
  </div>;
}

/* ------------------------------------------------------------------ Monthly billing */
export function SchoolBilling({ ctx, api }) {
  const classes = sortClasses(ctx.rows('classes').filter((c) => c.status !== 'Closed'));
  const heads = ctx.rows('feeHeads'), occasionalHeads = heads.filter((h) => h.frequency !== 'Monthly');
  const [month, setMonth] = useState(MONTHS_BS[0]), [dueDate, setDueDate] = useState(today()), [chosen, setChosen] = useState(() => classes.map((c) => c.id)), [occasional, setOccasional] = useState([]);
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => setPreview(null), [month, dueDate, chosen.join(), occasional.join()]);
  if (!classes.length || !heads.length) return <><Header eyebrow="Fees" title="Monthly billing" /><Setup ctx={ctx} title={!classes.length ? 'Add your classes first' : 'Set your fee structure first'} text={!classes.length ? 'Bills are made for students in each class.' : 'Add fee heads such as Tuition, Transport and Lunch with their amounts for each class.'} go={!classes.length ? 'classes' : 'feeHeads'} action={!classes.length ? 'Add classes' : 'Add fee heads'} /></>;
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const body = { year: ctx.year, month, dueDate, classIds: chosen, occasional };
  async function run(apply) {
    setBusy(true); setError('');
    try { const r = await api('/school/billing/' + (apply ? 'apply' : 'preview'), 'POST', body); if (apply) { await ctx.changed(`${r.created} invoice${r.created === 1 ? '' : 's'} created for ${month}.${r.adjusted ? ` ${npr(r.adjusted)} settled from advance payments.` : ''}${r.skipped ? ` ${r.skipped} skipped (already billed or nothing due).` : ''}`); setPreview(null); } else setPreview(r); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const bills = preview?.bills || [], fresh = bills.filter((b) => !b.already && b.total > 0), total = fresh.reduce((a, b) => a + b.total, 0);
  const clsName = (id) => classLabel(classes.find((c) => c.id === id));
  return <div className="sp-page">
    <Header eyebrow="Fees" title="Monthly billing" text="Create one invoice per student from your fee structure. Scholarships, sibling and staff-child discounts reduce tuition (the largest one applies), late fines are added for overdue bills, advances settle the new bill, and students already billed for the month are skipped." />
    <section className="sp-card">
      <div className="sp-bill-form">
        <Field label="Month (BS)"><select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS_BS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Due date (AD)"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </div>
      <fieldset className="sp-chips"><legend>Classes</legend><button type="button" className="sp-link" onClick={() => setChosen(chosen.length === classes.length ? [] : classes.map((c) => c.id))}>{chosen.length === classes.length ? 'Clear all' : 'Select all'}</button>
        {classes.map((c) => <label key={c.id} className={chosen.includes(c.id) ? 'on' : ''}><input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(chosen, setChosen, c.id)} />{classLabel(c)}</label>)}</fieldset>
      {occasionalHeads.length > 0 && <fieldset className="sp-chips"><legend>Also charge this month</legend>
        {occasionalHeads.map((h) => <label key={h.id} className={occasional.includes(h.id) ? 'on' : ''}><input type="checkbox" checked={occasional.includes(h.id)} onChange={() => toggle(occasional, setOccasional, h.id)} />{h.head} · {npr(h.amount)} <small>({h.frequency.toLowerCase()}{h.classId ? ', ' + clsName(h.classId) : ''})</small></label>)}</fieldset>}
      {error && <p className="sp-error" role="alert"><CircleAlert size={16} /> {error}</p>}
      <div className="sp-foot"><span>{chosen.length} class{chosen.length === 1 ? '' : 'es'} selected</span><button className="sp-btn sp-go" disabled={busy || !chosen.length} onClick={() => run(false)}><ClipboardList size={16} /> {busy && !preview ? 'Preparing…' : 'Preview bills'}</button></div>
    </section>
    {preview && <section className="sp-card">
      <div className="sp-card-head"><h2>{month} bills <small>{fresh.length} to create · {npr(total)}</small></h2>
        <button className="sp-btn sp-go" disabled={busy || !fresh.length} onClick={() => run(true)}><Wallet size={16} /> {busy ? 'Creating…' : `Create ${fresh.length} invoice${fresh.length === 1 ? '' : 's'}`}</button></div>
      <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Class</th><th>Roll</th><th>Student</th><th>Charges</th><th>Discount</th><th>Total</th><th>From advance</th><th></th></tr></thead>
        <tbody>{bills.map((b) => <tr key={b.studentId} className={b.already ? 'sp-dim' : ''}><td>{clsName(b.classId)}</td><td>{b.rollNo || '–'}</td><td className="sp-strong">{b.name}</td>
          <td>{b.lines.map((l) => `${l.head}${l.note ? ' (' + l.note + ')' : ''} ${npr(l.amount)}`).join(' · ') || <span className="sp-muted">No charges</span>}</td>
          <td>{b.discount ? <span title={b.discountNote}>− {npr(b.discount)}<small className="sp-sub">{b.discountNote}</small></span> : '—'}</td><td className="sp-strong">{npr(b.total)}</td><td>{b.fromAdvance > 0 && !b.already ? npr(b.fromAdvance) : '—'}</td>
          <td>{b.already ? <span className="sp-pill">Billed · {b.already}</span> : b.total <= 0 ? <span className="sp-pill">Nothing due</span> : <span className="sp-pill green">New</span>}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}

/* ------------------------------------------------------------------ Student: my attendance summary (used on the school student home) */
export function MyAttendance({ ctx }) {
  const kids = ctx.rows('students'), [childId, setChild] = useState(''), me = kids.find((k) => k.id === childId) || kids[0], rows = ctx.rows('schoolAttendance').filter((r) => r.studentId === me?.id);
  const s = me ? attendanceSummary(rows, me.id) : null;
  return <div className="sp-page"><Header eyebrow="Attendance" title={ctx.user.role === 'Parent' ? `${me?.name || 'Child'}’s attendance` : 'My attendance'} text="Daily attendance this academic year.">{kids.length > 1 && <Field label="Child"><select value={me?.id} onChange={(e) => setChild(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>}</Header>
    {s && s.days ? <><div className="sp-tiles"><div className="sp-tile tone-teal"><strong>{s.rate}%</strong><span>Attendance rate</span></div><div className="sp-tile tone-blue"><strong>{s.present}</strong><span>Days present</span></div><div className="sp-tile tone-rose"><strong>{s.absent}</strong><span>Days absent</span></div><div className="sp-tile tone-purple"><strong>{s.leave}</strong><span>Days on leave</span></div></div>
      <section className="sp-card"><div className="sp-card-head"><h2>Recent days</h2></div><ul className="sp-days">{[...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((r) => <li key={r.id} className={'st-' + r.status.toLowerCase()}><CalendarDays size={15} /> {r.date}<b>{r.status}</b></li>)}</ul></section></>
      : <Setup ctx={ctx} title="No attendance yet" text="Your attendance appears here once your class teacher starts taking the daily register." />}
  </div>;
}
export const schoolPageIcons = { 'school-attendance': CheckCheck, 'school-marks': ClipboardList, 'school-results': Award, 'school-billing': Wallet, 'my-attendance': Users };
