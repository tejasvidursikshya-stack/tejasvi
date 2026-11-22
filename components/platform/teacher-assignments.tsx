'use client';
import { useState } from 'react';

type Row = Record<string, any>;
type Assignment = { batchId: string; subjectId: string; userId: string };

export function TeacherAssignments({data, busy, onAssign, onRemove, onEnrolments}: {
  data: Row; busy: boolean; onAssign: (body: Assignment) => Promise<void>;
  onRemove: (body: Assignment) => void; onEnrolments: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [query, setQuery] = useState('');
  const teachers: Row[] = data.members.filter((m: Row) => m.role === 'teacher');
  const batches: Row[] = data.batches;
  const subjects: Row[] = data.subjects;
  const offered = subjects.filter(s => data.batchSubjects.some((b: Row) => b.batch_id === batchId && b.subject_id === s.id));
  const batchLabel = (b?: Row) => b ? [b.name, b.program_name, b.grade_name, b.section_name, b.academic_year].filter(Boolean).join(' · ') : 'Unavailable batch';
  const duplicate = data.teachers.some((t: Row) => t.user_id === userId && t.batch_id === batchId && t.subject_id === subjectId);
  const rows = data.teachers.map((t: Row) => ({...t,
    teacher: teachers.find(u => u.id === t.user_id),
    batch: batchLabel(batches.find(b => b.id === t.batch_id)),
    subject: subjects.find(s => s.id === t.subject_id)?.name || 'Unavailable subject',
  })).filter((t: Row) => [t.name, t.teacher?.email, t.batch, t.subject].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <p className="data-note">Choose who teaches each batch and subject. A teacher can teach multiple batches, and a batch can have different teachers for different subjects.</p>
    <section className="editor-section">
      <h2>Assign a teacher</h2>
      {!teachers.length && <p role="status">No teacher accounts yet. Open People and create an account with the Teacher role.</p>}
      {!batches.length && <p role="status">No batches yet. Open the Batches tab to create a batch and select its subjects.</p>}
      <form onSubmit={e => {e.preventDefault(); if (!busy && userId && batchId && subjectId && !duplicate) void onAssign({userId, batchId, subjectId});}}>
        <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
          <div className="form-grid">
            <label className="field">Teacher<select aria-label="Teacher" required value={userId} onChange={e => setUserId(e.target.value)}><option value="">Choose a teacher…</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}</select></label>
            <label className="field">Batch<select aria-label="Batch" required value={batchId} onChange={e => {setBatchId(e.target.value);setSubjectId('');}}><option value="">Choose a batch…</option>{batches.map(b => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}</select></label>
            <label className="field">Subject<select aria-label="Subject" required disabled={!batchId || !offered.length} value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">{batchId?'Choose a subject…':'Choose a batch first'}</option>{offered.map(s => <option key={s.id} value={s.id}>{s.name}{s.code?` · ${s.code}`:''}</option>)}</select></label>
          </div>
          {batchId && !offered.length && <p role="status">This batch has no subjects. <button type="button" className="quiet-link" onClick={onEnrolments}>Add a subject to the batch</button> first.</p>}
          {duplicate && <p role="status">This teacher is already assigned to this batch and subject.</p>}
          <button className="button button-orange" disabled={!userId || !batchId || !subjectId || duplicate}>{busy?'Saving…':'Assign teacher'}</button>
        </fieldset>
      </form>
    </section>
    <section className="editor-section" style={{marginTop:24}}>
      <h2>Current teacher assignments ({data.teachers.length})</h2>
      <label className="field">Find an assignment<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search teacher, batch or subject"/></label>
      {!rows.length && <p>{data.teachers.length?'No assignments match your search.':'No teachers assigned yet. Use the form above to assign your first teacher.'}</p>}
      {rows.map((t: Row) => <div className="assignment-row" key={[t.batch_id,t.subject_id,t.user_id].join(':')}>
        <div><strong>{t.name}</strong><small>{t.teacher?.email}</small><small>{t.batch}</small><small>{t.subject}</small></div>
        <button className="quiet-link" disabled={busy} aria-label={`Remove ${t.name} from ${t.subject} in ${t.batch}`} onClick={() => onRemove({batchId:t.batch_id,subjectId:t.subject_id,userId:t.user_id})}>Remove assignment</button>
      </div>)}
      <p className="data-note">To give teachers access to course materials, use Course access to link the course to their batch and subject. Removing an assignment does not delete the teacher account.</p>
    </section>
  </>;
}
