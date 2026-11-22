import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, CalendarDays, CheckCircle2, Download, RefreshCw, Search, ShieldCheck, AlertCircle, BookOpen } from 'lucide-react';
import { asCSV } from '../shared/schema.mjs';
import { academicYearLabel, bsYearOf, normalizeAcademicYear } from '../shared/bs.mjs';

const nextYear = year => `${Number(year.slice(0, 4)) + 1}/${String((Number(year.slice(0, 4)) + 2) % 100).padStart(2, '0')}`;
const maxTerm = program => Math.min(12, Math.floor(Number(program?.duration || 0) * (program?.system === 'Annual' ? 1 : 2)));
const proposedTerm = (student, program) => Number(student.semester) + (program?.system === 'Annual' ? 1 : 2);
function CSVButton({ records, filename, keys }) {
    return <button className="btn" onClick={() => {
        const url = URL.createObjectURL(new Blob([asCSV(records, keys)], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}><Download size={16}/>Export student list</button>;
}

export default function ProgressionPage({ ctx, api }) {
    const [targetYear, setTargetYear] = useState(nextYear(ctx.year)), [targetInput, setTargetInput] = useState(() => String(bsYearOf(nextYear(ctx.year))));
    const [programId, setProgramId] = useState(''), [query, setQuery] = useState(''), [selected, setSelected] = useState({});
    const [copyCourses, setCopyCourses] = useState(true), [setDefaultYear, setDefaultYearChoice] = useState(false);
    const [preview, setPreview] = useState(null), [reviewed, setReviewed] = useState(false), [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [history, setHistory] = useState([]);
    async function loadHistory() { try { setHistory(await api('/academic-years/history')); } catch (e) { setError(e.message); } }
    useEffect(() => { loadHistory(); }, []);
    useEffect(() => { setTargetYear(nextYear(ctx.year)); setTargetInput(String(bsYearOf(nextYear(ctx.year)))); setSelected({}); setPreview(null); setResult(null); setError(''); }, [ctx.year]);
    const roster = (ctx.records.students || []).filter(s => s.year === ctx.year && ['Active', 'On leave'].includes(s.status) && (!programId || s.programId === programId) && `${s.name} ${s.studentNo} ${s.batch}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.studentNo.localeCompare(b.studentNo));
    const programFor = student => ctx.records.programs?.find(p => p.id === student.programId);
    const blocked = student => programFor(student)?.status !== 'Active' || ctx.records.students.some(s => s.previousEnrollmentId === student.id || (s.year === targetYear && ((s.personId || s.id) === (student.personId || student.id) || s.studentNo === student.studentNo)));
    const regular = roster.filter(s => !blocked(s) && s.status === 'Active' && proposedTerm(s, programFor(s)) <= maxTerm(programFor(s)));
    const count = Object.keys(selected).length;
    function toggle(student) {
        setSelected(prev => {
            const next = { ...prev };
            if (next[student.id] !== undefined) delete next[student.id];
            else if (Object.keys(next).length < 300) next[student.id] = Math.min(maxTerm(programFor(student)), proposedTerm(student, programFor(student)));
            return next;
        });
    }
    async function review() {
        setBusy(true); setError('');
        try {
            const selection = { sourceYear: ctx.year, targetYear, copyCourses, setDefaultYear, students: Object.entries(selected).map(([id, semester]) => ({ id, semester, version: ctx.records.students.find(s => s.id === id)?.version })) };
            const data = await api('/academic-years/preview', 'POST', selection);
            setPreview({ data, selection, requestId: crypto.randomUUID() }); setReviewed(false);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    }
    async function apply() {
        setBusy(true); setError('');
        let saved = false;
        try {
            const response = await api('/academic-years/rollover', 'POST', { ...preview.selection, previewToken: preview.data.previewToken, requestId: preview.requestId });
            setResult(response); setPreview(null); setSelected({}); saved = true;
            await ctx.changed(`Created ${response.enrollments.length} enrollments for ${response.targetYear}.`);
            await loadHistory();
        } catch (e) { setError(saved ? `The rollover was saved. Refresh the workspace to load it. ${e.message}` : e.message); }
        finally { setBusy(false); }
    }
    const summary = preview?.data.summary;
    return <>
        <div className="page-title"><div><span className="eyebrow">STUDENT LIFECYCLE</span><h1>Prepare the next academic year.</h1><p>Continue student enrollments with a clear record of every year.</p></div><button className="btn" disabled={busy} onClick={async () => { setError(''); try { await ctx.changed('Student list refreshed.'); setPreview(null); setSelected({}); await loadHistory(); } catch (e) { setError(e.message); } }}><RefreshCw size={16}/>Refresh records</button></div>
        <div className="rollover-steps" aria-label="Rollover progress">{['Choose students', 'Review changes', 'Save & continue'].map((label, i) => <div key={label} className={(result ? 2 : preview ? 1 : 0) === i ? 'current' : ''}><span>{i + 1}</span><b>{label}</b>{i < 2 && <ArrowRight size={15}/>}</div>)}</div>
        {error && <div className="error-box" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}
        {result ? <section className="card rollover-success"><span className="success-mark"><CheckCircle2 size={34}/></span><span className="eyebrow">ROLLOVER SAVED</span><h2>{result.targetYear} is ready for the next steps.</h2><p>{result.enrollments.length} linked enrollments created. {result.copiedCourses.length} course definitions copied as Planned.</p><p>Previous attendance, results, fees and documents remain in {result.sourceYear}. Review course allocations and add the new timetable when ready.</p><div className="row-actions"><button className="btn primary" onClick={() => { ctx.setYear(result.targetYear); ctx.go('students'); }}>Open {result.targetYear} students<ArrowRight size={16}/></button><CSVButton records={result.enrollments} filename={`EMIS-rollover-${result.targetYear.replace('/', '-')}.csv`} keys={['studentNo', 'name', 'fromSemester', 'semester', 'sourceId', 'id']}/><button className="btn" onClick={() => setResult(null)}>Prepare another group</button></div></section> : preview ? <>
            <div className="rollover-review-top"><div><span className="eyebrow">REVIEW BEFORE SAVING</span><h2>{preview.data.sourceYear} <ArrowRight size={20}/> {preview.data.targetYear}</h2></div><button className="btn" disabled={busy} onClick={() => setPreview(null)}><ArrowLeft size={16}/>Back to selection</button></div>
            <div className="rollover-summary"><div><b>{summary.enrollments}</b><span>New enrollments</span></div><div><b>{summary.coursesToCopy}</b><span>Courses to copy</span></div><div><b>{summary.coursesToKeep}</b><span>Existing courses kept</span></div><div><b>{preview.data.setDefaultYear ? 'Yes' : 'No'}</b><span>Change default year</span></div></div>
            {preview.data.conflicts.length > 0 && <div className="rollover-notice blocked" role="alert"><b>Resolve these items before saving</b><ul>{preview.data.conflicts.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
            {preview.data.warnings.length > 0 && <div className="rollover-notice"><b>Items to review</b><ul>{preview.data.warnings.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
            {summary.sampleEnrollments > 0 && <div className="info-strip">{summary.sampleEnrollments} selected enrollments contain fictional sample data. Their new enrollments will remain labeled as samples.</div>}
            <section className="card"><div className="section-head"><div><h2>Student progression</h2><p>Student IDs and intake batches are retained. Each new year receives a separate linked enrollment.</p></div><CSVButton records={preview.data.students} filename="EMIS-rollover-review.csv" keys={['studentNo', 'name', 'program', 'fromSemester', 'semester', 'status']}/></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Program</th><th>Semester / year</th><th>New status</th></tr></thead><tbody>{preview.data.students.map(s => <tr key={s.id}><td><b>{s.name}</b><small>{s.studentNo}</small></td><td>{s.program}</td><td>{s.fromSemester} → <b>{s.semester}</b></td><td>{s.status}</td></tr>)}</tbody></table></div></section>
            {preview.data.courses.length > 0 && <details className="card rollover-courses"><summary><BookOpen size={18}/>Course definitions · {preview.data.courses.length}</summary><div className="table-wrap"><table><thead><tr><th>Course</th><th>Semester / year</th><th>Action</th></tr></thead><tbody>{preview.data.courses.map(c => <tr key={c.id}><td><b>{c.code}</b><small>{c.name}</small></td><td>{c.semester}</td><td>{c.action}</td></tr>)}</tbody></table></div></details>}
            <section className="card rollover-confirm"><div><ShieldCheck size={23}/><p>This creates new enrollments and optional course definitions. Existing year records stay intact. Timetables, attendance, marks and invoices are not carried forward.</p></div><label className="checkbox-label"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={busy}/><span>I have reviewed these students and their target semesters.</span></label><button className="btn primary" disabled={busy || !reviewed || !preview.data.canApply} onClick={apply}>{busy ? 'Saving rollover…' : `Create ${summary.enrollments} enrollments`}<ArrowRight size={16}/></button></section>
        </> : <>
            <section className="card rollover-config"><fieldset disabled={busy}><div className="rollover-config-title"><span className="mini-icon"><CalendarDays size={23}/></span><div><h2>Academic-year settings</h2><p>The source year follows the workspace selector above.</p></div></div><div className="form-grid"><label>From academic year<input value={academicYearLabel(ctx.year)} readOnly/></label><label>To academic year (BS){normalizeAcademicYear(targetInput) ? ' · ' + academicYearLabel(targetYear) : ''}<input value={targetInput} placeholder={String(bsYearOf(nextYear(ctx.year)))} onChange={e => { setTargetInput(e.target.value); setTargetYear(normalizeAcademicYear(e.target.value) || e.target.value); setSelected({}); }}/></label></div><div className="rollover-options"><label className="checkbox-label"><input type="checkbox" checked={copyCourses} onChange={e => setCopyCourses(e.target.checked)}/><span>Copy course definitions for selected programs<small>Courses become Planned. Existing matching course codes are kept.</small></span></label><label className="checkbox-label"><input type="checkbox" checked={setDefaultYear} onChange={e => setDefaultYearChoice(e.target.checked)}/><span>Set the target as the default academic year<small>New sign-ins open in this year.</small></span></label></div></fieldset></section>
            <section className="card"><div className="section-head"><div><h2>Select students to continue</h2><p>Semester programs suggest +2; annual programs suggest +1. Adjust each selected student as needed.</p></div><span className="badge neutral">{count} selected / 300</span></div><div className="records-toolbar"><div className="table-search"><Search size={17}/><input aria-label="Find students for rollover" placeholder="Search name, ID or intake batch…" disabled={busy} value={query} onChange={e => { setQuery(e.target.value); setSelected({}); }}/></div><select aria-label="Filter rollover program" value={programId} disabled={busy} onChange={e => { setProgramId(e.target.value); setSelected({}); }}><option value="">All programs</option>{ctx.records.programs?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="rollover-selection-actions"><button className="text-btn" disabled={busy || !regular.length} onClick={() => setSelected(Object.fromEntries(regular.slice(0, 300).map(s => [s.id, proposedTerm(s, programFor(s))])))}>Select eligible students ({Math.min(regular.length, 300)})</button><button className="text-btn" disabled={busy || !count} onClick={() => setSelected({})}>Clear selection</button><small>Final-stage and on-leave students need individual review.</small></div>
            <div className="table-wrap"><table className="rollover-table"><thead><tr><th>Select</th><th>Student</th><th>Program / batch</th><th>Current</th><th>Next semester / year</th><th>Review</th></tr></thead><tbody>{roster.map(s => {
                const p = programFor(s), limit = maxTerm(p), finalStage = proposedTerm(s, p) > limit, checked = selected[s.id] !== undefined, isBlocked = blocked(s);
                return <tr key={s.id} className={checked ? 'selected-row' : ''}><td><input aria-label={`Select ${s.name}`} type="checkbox" checked={checked} disabled={busy || isBlocked || (!checked && count >= 300)} onChange={() => toggle(s)}/></td><td><b>{s.name}</b><small>{s.studentNo}{s.sample ? ' · Sample' : ''}</small></td><td>{p?.name}<small>Intake {s.batch}</small></td><td>{s.semester}<small>{s.status}</small></td><td><select aria-label={`Next semester for ${s.name}`} disabled={busy || !checked} value={checked ? selected[s.id] : Math.min(limit, proposedTerm(s, p))} onChange={e => setSelected(v => ({ ...v, [s.id]: Number(e.target.value) }))}>{Array.from({ length: Math.max(0, limit - Number(s.semester) + 1) }, (_, i) => Number(s.semester) + i).map(n => <option key={n} value={n}>{n}{n === Number(s.semester) ? ' · Repeat' : ''}</option>)}</select></td><td><span className={`rollover-row-note ${isBlocked || finalStage ? 'attention' : ''}`}>{isBlocked ? 'Already continued / program inactive' : finalStage ? 'Final stage: review before repeating' : s.status === 'On leave' ? 'Will remain on leave' : 'Ready to continue'}</span></td></tr>;
            })}</tbody></table>{!roster.length && <div className="empty"><h3>No matching students</h3><p>Choose an academic year with Active or On leave students, or adjust the filters.</p></div>}</div><div className="rollover-table-footer"><span>{roster.length} matching students · {count} selected</span><button className="btn primary" disabled={busy || !count} onClick={review}>{busy ? 'Checking records…' : 'Review rollover'}<ArrowRight size={16}/></button></div></section>
            <div className="info-strip"><ShieldCheck size={18}/>Previous years are preserved. Student accounts follow only the enrollments linked by this workflow; matching names or IDs alone never grants access.</div>
        </>}
        {history.length > 0 && <section className="card mt"><div className="section-head"><div><h2>Rollover history</h2><p>Latest 30 completed operations</p></div></div><div className="table-wrap"><table><thead><tr><th>Academic years</th><th>Students</th><th>Courses copied</th><th>Completed by</th><th>Date</th></tr></thead><tbody>{history.map(h => <tr key={h.id}><td><b>{h.sourceYear} → {h.targetYear}</b></td><td>{h.enrollments.length}</td><td>{h.copiedCourses.length}</td><td>{h.actor}</td><td>{new Date(h.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}</td></tr>)}</tbody></table></div></section>}
    </>;
}
