import { canManageUsers, canManageInstitution, canViewInstitution, isSuperAdmin, normalizeRole } from '../shared/access.mjs';
import React from 'react';
import { Building2, ArrowUpRight, MapPin, Mail, Phone, Globe2, BookOpen } from 'lucide-react';
import { can, calculateIndicators } from '../shared/schema.mjs';
import { academicYearLabel } from '../shared/bs.mjs';
export const collegeFields = [
  ['code', 'College / EMIS code'], ['registrationNumber', 'Registration number'], ['panNumber', 'PAN / tax number'],
  ['established', 'Established'], ['type', 'Institution type'], ['ownership', 'Ownership / legal status'],
  ['university', 'University affiliation'], ['affiliationDate', 'Affiliation date'], ['principal', 'Campus Chief / Principal'],
  ['chairperson', 'Chairperson / Board'], ['province', 'Province'], ['district', 'District'], ['municipality', 'Municipality'],
  ['ward', 'Ward'], ['postalCode', 'Postal code'], ['currentStatus', 'Institutional status']
];
// The same profile keys, worded for a Nepali school.
export const schoolFields = [
  ['code', 'School / IEMIS code'], ['registrationNumber', 'Registration number'], ['panNumber', 'PAN / tax number'],
  ['established', 'Established (BS)'], ['type', 'School type'], ['ownership', 'Ownership / legal status'],
  ['university', 'Levels taught / board'], ['affiliationDate', 'Permission / approval date'], ['principal', 'Principal'],
  ['chairperson', 'School Management Committee chair'], ['province', 'Province'], ['district', 'District'], ['municipality', 'Municipality'],
  ['ward', 'Ward'], ['postalCode', 'Postal code'], ['currentStatus', 'School status']
];
export const profileFields = (kind) => kind === 'school' ? schoolFields : collegeFields;
const collegeSections = [
  ['Academic structure', [['departments', 'Departments'], ['programs', 'Programs'], ['courses', 'Courses'], ['exams', 'Examinations']]],
  ['People & admissions', [['faculty', 'Faculty members'], ['staff', 'Staff members'], ['admissions', 'Applications'], ['governance', 'Governance records']]],
  ['Student support', [['scholarships', 'Scholarships'], ['services', 'Support services'], ['grievances', 'Grievances'], ['feedback', 'Feedback responses']]],
  ['Campus resources', [['facilities', 'Facilities'], ['library', 'Library resources'], ['timetable', 'Timetable entries'], ['development', 'Staff development']]],
  ['Research & careers', [['research', 'Research projects'], ['publications', 'Publications'], ['placements', 'Placements'], ['alumni', 'Alumni records']]],
  ['Quality & partnerships', [['evidence', 'QAA evidence'], ['actions', 'Improvement actions'], ['partnerships', 'Partnerships'], ['outreach', 'Outreach activities']]]
];
const schoolSections = [
  ['Teaching & admissions', [['departments', 'Subject departments'], ['faculty', 'Teachers'], ['staff', 'Staff members'], ['admissions', 'Applications']]],
  ['Student support', [['scholarships', 'Scholarships'], ['services', 'Student support'], ['grievances', 'Grievances'], ['feedback', 'Feedback responses']]],
  ['School resources', [['facilities', 'Facilities'], ['library', 'Library resources'], ['development', 'Teacher training']]],
  ['Community', [['governance', 'SMC / PTA records'], ['alumni', 'Alumni records'], ['outreach', 'Community activities']]]
];
function safeWeb(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function CollegeSummary({ ctx, onOpen }) {
  const p = ctx.profile;
  return <section className="college-summary" aria-label={p.kind === 'school' ? 'School summary' : 'College summary'}>
    <span className="profile-emblem"><Building2 size={25}/></span>
    <div><h2>{p.name}</h2><p>{[p.university, p.address].filter(Boolean).join(' · ') || (p.kind === 'school' ? 'Your school information, people and operations in one place.' : 'Your college information, people and operations in one place.')}</p></div>
    <button className="btn" onClick={onOpen}>{ctx.profile.kind==='school'?'School information':'College information'}<ArrowUpRight size={16}/></button>
  </section>;
}
export function DashboardNavigation({ value, onChange, allAccess }) {
  const views = [['overview', 'Overview'], ['information', 'College information'], ['academic', 'Academics'], ...(allAccess ? [['equity', 'Equity & inclusion']] : [])];
  return <nav className="view-tabs dashboard-tabs" aria-label="Dashboard sections">
    {views.map(([id, label]) => <button key={id} className={value === id ? 'active' : ''} aria-pressed={value === id} aria-controls="dashboard-view" onClick={() => onChange(id)}>{label}</button>)}
  </nav>;
}
export function CollegeProfile({ ctx, expanded = false }) {
  const { profile: p, go } = ctx, editable = canManageInstitution(ctx.user.role);
  const complete = ['name', 'code', 'address', 'university', 'principal', 'email', 'phone', 'established'].filter(k => p[k]).length;
  return <section className="card college-profile" aria-labelledby="college-profile-title"><div className="college-profile-heading"><span className="profile-emblem"><Building2 size={32}/></span><div><p className="eyebrow">Your institution</p><h2 id="college-profile-title">{p.name}</h2><p>{[p.type && (p.kind==='school' ? (/school/i.test(p.type) ? p.type : `${p.type} school`) : `${p.type} college`), p.university, p.established && `Est. ${p.established}`].filter(Boolean).join(' · ') || (p.kind==='school' ? 'Complete your school profile to show levels, principal and history.' : 'Complete your institution profile to show affiliation and history.')}</p></div>{editable && <button className="btn" onClick={() => go('settings')}>Edit institution details<ArrowUpRight size={16}/></button>}</div>
    <div className="college-contact">{[[MapPin, p.address, null, 'Address not provided'], [Mail, p.email, p.email && `mailto:${p.email}`, 'Email not provided'], [Phone, p.phone, p.phone && `tel:${p.phone.replace(/[^+0-9]/g, '')}`, 'Phone not provided'], [Globe2, p.website, safeWeb(p.website), 'Website not provided']].map(([Icon, text, url, fallback], i) => <span key={i}><Icon size={18}/>{url ? <a href={url} {...(i === 3 ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{text}</a> : <span>{text || fallback}</span>}</span>)}</div>
    <details className="college-details" open={expanded || undefined}><summary>{ctx.profile.kind==='school'?'Full school information':'Full college information'} <span>{complete}/8 essential details completed</span></summary><dl className="profile-facts">{profileFields(p.kind).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{p[key] || 'Not provided'}</dd></div>)}</dl><div className="college-direction">{[['vision', 'Vision'], ['mission', 'Mission'], ['values', 'Values & goals'], ['history', p.kind === 'school' ? 'School history' : 'College history'], ['milestones', 'Milestones'], ['priorAccreditation', 'Accreditation history']].map(([key, label]) => <div key={key}><h3>{label}</h3><p>{p[key] || 'Not provided'}</p></div>)}</div></details>
  </section>;
}
export function CollegeOperations({ ctx }) {
  const m = calculateIndicators(ctx.records, ctx.year);
  return <section className="college-operations" aria-labelledby="college-operations-title"><div className="overview-section-heading"><div><h2 id="college-operations-title">{ctx.profile.kind==='school'?'Across the school':'Across the college'}</h2><p>Operational records for {academicYearLabel(ctx.year)}. {ctx.profile.kind === 'school' ? 'Teachers, staff and resources use current school-wide records.' : 'Departments, programs and people use current institution-wide records.'}</p></div></div><div className="operations-grid">{(ctx.profile.kind === 'school' ? schoolSections : collegeSections).map(([title, metrics]) => { const visible = metrics.filter(([entity]) => can(ctx.user.role, entity)); if (!visible.length) return null; return <section className="card operation-card" key={title}><h3>{title}</h3>{visible.map(([entity, label]) => <button key={entity} onClick={() => ctx.go(entity)}><span>{label}</span><strong>{ctx.rows(entity).length.toLocaleString()}</strong><ArrowUpRight size={15}/></button>)}</section>; })}{can(ctx.user.role, 'transactions') && <section className="card operation-card"><h3>Institution finances · NPR</h3>{[['Income recorded', m.income, 'transactions'], ['Expenses recorded', m.expense, 'transactions'], ['Fees outstanding', m.outstanding, 'fees'], ['Budgets', ctx.rows('budgets').length, 'budgets']].filter(([, , entity]) => can(ctx.user.role, entity)).map(([label, value, entity]) => <button key={label} onClick={() => ctx.go(entity)}><span>{label}</span><strong>{value.toLocaleString('en-NP', { maximumFractionDigits: 2 })}</strong><ArrowUpRight size={15}/></button>)}</section>}</div></section>;
}
