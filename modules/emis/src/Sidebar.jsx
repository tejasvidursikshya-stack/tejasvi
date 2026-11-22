import React, { useEffect, useMemo, useState, useRef } from 'react';
import { GraduationCap, Building2, LayoutDashboard, CalendarDays, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Settings, LockKeyhole, HelpCircle, House, LogOut, X, BookOpen, Users, Wallet, FlaskConical, ShieldCheck, ChartNoAxesCombined, CheckCheck, Award, Receipt, LifeBuoy, BriefcaseBusiness, HeartHandshake, Search, Bus, Contact, PencilLine, ClipboardList, MessageSquare, ClipboardCheck, UserCheck, Landmark, CornerDownLeft } from 'lucide-react';
import { modules, can } from '../shared/schema.mjs';
import { canManageUsers, canManageInstitution } from '../shared/access.mjs';

/*
 * One menu per kind of institution. Each section starts with the everyday work pages, then
 * set-up registers, then "records" (the raw lists behind a work page). Each item: [key, label, extra search words].
 */
const SCHOOL_MENU = [
  ['students', 'Students', GraduationCap, [
    ['students', 'Student directory', 'pupil profile record admission number'], ['admissions', 'Admissions', 'apply application new student'], ['enquiries', 'Admission enquiries', 'enquiry inquiry lead'],
    ['leaveRequests', 'Leave notes', 'absent sick leave parent note'], ['school-certificates', 'Certificates', 'character transfer tc bonafide'], ['school-idcards', 'ID cards', 'identity card qr'],
    ['school-promotion', 'Promote to next class', 'year end upgrade new session'], ['bulk-students', 'Update many students', 'bulk edit import'], ['services', 'Student support', 'counselling club welfare'], ['grievances', 'Grievances', 'complaint'],
    ['-', 'Records'], ['certificates', 'Certificate register']]],
  ['attendance', 'Attendance', CheckCheck, [
    ['school-attendance', 'Take student attendance', 'present absent hajiri roll call register daily'], ['school-staff-attendance', 'Staff attendance', 'teacher hajiri check in present absent'],
    ['-', 'Records'], ['schoolAttendance', 'Student attendance records', 'daily register history'], ['staffAttendance', 'Staff attendance records', 'teacher history']]],
  ['teaching', 'Teaching', BookOpen, [
    ['school-routine', 'Class routine', 'timetable schedule period substitution cover'], ['homework', 'Homework & classwork', 'assignment project'], ['school-homework', 'Check homework', 'done incomplete submitted'], ['diary', 'Teacher diary', 'lesson topic covered daily diary'],
    ['-', 'Set up'], ['classes', 'Classes & sections', 'grade section class teacher room'], ['subjects', 'Subjects', 'credit hour full marks teacher'], ['departments', 'Departments', 'faculty unit'],
    ['-', 'Records'], ['routine', 'Routine periods', 'timetable entries'], ['substitutions', 'Substitutions', 'cover teacher away'], ['homeworkChecks', 'Homework check records', '']]],
  ['exams', 'Exams & results', Award, [
    ['school-exams', 'Exam routine & admit cards', 'admit card seat plan exam schedule terminal'], ['school-cas', 'Continuous assessment', 'cas internal practical project remarks report card'], ['school-marks', 'Enter marks', 'marks entry score theory practical'], ['school-results', 'Grade sheets', 'result marksheet report card gpa ledger rank'],
    ['-', 'Set up'], ['terms', 'Examinations', 'first second third terminal final unit test'],
    ['-', 'Records'], ['marks', 'Marks records', ''], ['examSchedule', 'Exam papers', 'routine entries'], ['cas', 'Assessment scores', 'cas'], ['reportRemarks', 'Report card remarks', 'conduct teacher remark']]],
  ['fees', 'Fees & accounts', Wallet, [
    ['school-billing', 'Monthly billing', 'fee bill invoice tuition generate'], ['school-collection', 'Fee desk & dues', 'collection cash receipt due reminder sms advance overdue'], ['school-accounts', 'Books of account', 'accounting ledger day book trial balance balance sheet profit income statement journal'],
    ['-', 'Set up'], ['feeHeads', 'Fee structure', 'tuition transport lunch fee heads rate'], ['scholarships', 'Scholarships & discounts', 'scholarship waiver concession'], ['ledgerAccounts', 'Chart of accounts', 'ledger account head'],
    ['-', 'Records'], ['fees', 'Fee invoices', 'bill invoice'], ['payments', 'Payment receipts', 'receipt paid payment'], ['advances', 'Advance payments', 'deposit prepaid'], ['transactions', 'Income & expenditure', 'expense income voucher'], ['journals', 'Journal vouchers', 'voucher entry'], ['budgets', 'Budgets', '']]],
  ['staff', 'Staff & payroll', Users, [
    ['faculty', 'Teachers', 'teacher faculty staff profile'], ['staff', 'Non-teaching staff', 'accountant peon driver office'], ['leaves', 'Staff leave', 'leave request casual sick'], ['school-payroll', 'Payroll', 'salary payslip ssf cit tax pay'],
    ['-', 'Set up'], ['salaryStructures', 'Salary structure', 'basic allowance ssf'],
    ['-', 'Records'], ['payslips', 'Payslips', 'salary slip'], ['development', 'Staff training', 'development workshop']]],
  ['communication', 'Messages & calendar', MessageSquare, [
    ['school-messages', 'Messages', 'chat parent teacher conversation'], ['notices', 'Notices', 'announcement circular news'], ['school-calendar', 'School calendar', 'holiday event nepali bs date vacation'], ['school-sms', 'SMS messages', 'text sms log sent'],
    ['-', 'Records'], ['events', 'Calendar events', 'holiday'], ['messages', 'All messages', '']]],
  ['campus', 'Transport & library', Bus, [
    ['school-bus', 'Bus attendance', 'transport van boarded pickup drop'], ['routes', 'Bus routes', 'transport stop route fare'], ['vehicles', 'Vehicles', 'bus van driver'],
    ['school-library', 'Library desk', 'issue return book borrow fine'], ['library', 'Library books', 'catalogue accession'], ['loans', 'Library loans', 'borrowed books'],
    ['-', 'Records'], ['busAttendance', 'Bus attendance records', '']]],
  ['admin', 'School administration', Building2, [
    ['users', 'Users & logins', 'account login password parent access'], ['roles', 'Roles & permissions', 'access permission'], ['visitors', 'Front-office visits', 'visitor reception'], ['facilities', 'Facilities & ICT', 'building room computer asset'],
    ['governance', 'School committees', 'smc pta committee governance'], ['feedback', 'Feedback', 'survey'], ['strategy', 'Plans & targets', 'annual plan strategic'], ['outreach', 'Community activities', 'outreach community'], ['alumni', 'Alumni', 'graduates former students']]],
  ['reports', 'Reports', ChartNoAxesCombined, [
    ['ugc', 'School annual overview', 'summary dashboard annual'], ['school-iemis', 'IEMIS / Flash report', 'flash government census report iemis'], ['reports', 'School reports', 'report print export'], ['emis', 'All EMIS information', 'all modules registers'], ['audit', 'Activity log', 'audit history changes']]],
];
const COLLEGE_MENU = [
  ['students', 'Students', GraduationCap, [
    ['students', 'Student directory', 'profile record enrolment'], ['enquiries', 'Enquiries', 'enquiry lead interest'], ['admissions', 'Admissions', 'application entrance enrol'], ['scholarships', 'Scholarships', 'waiver concession'],
    ['services', 'Student support', 'counselling club welfare'], ['grievances', 'Grievances', 'complaint'], ['bulk-students', 'Update many students', 'bulk edit import']]],
  ['academics', 'Academics', BookOpen, [
    ['programs', 'Programs', 'bachelor master degree course program'], ['courses', 'Courses & teaching', 'subject course allocation credit'], ['timetable', 'Timetable', 'routine schedule class'], ['attendance', 'Attendance', 'present absent hajiri'],
    ['exams', 'Examinations', 'exam internal board university'], ['results', 'Results & assessment', 'marks result grade gpa'], ['departments', 'Departments', 'faculty unit'], ['academic-years', 'Academic years', 'session rollover new year']]],
  ['finance', 'Fees & finance', Wallet, [
    ['fees', 'Student fees', 'fee bill invoice tuition'], ['payments', 'Payments', 'receipt paid payment'], ['transactions', 'Income & expenditure', 'expense income voucher'], ['budgets', 'Budgets', 'budget allocation']]],
  ['people', 'Faculty & staff', Users, [
    ['faculty', 'Faculty', 'teacher lecturer professor'], ['staff', 'Non-teaching staff', 'admin office staff'], ['development', 'Staff development', 'training workshop']]],
  ['research', 'Research & careers', FlaskConical, [
    ['research', 'Research & innovation', 'project grant'], ['publications', 'Publications', 'journal paper article'], ['outreach', 'Community outreach', 'extension'], ['partnerships', 'Industry partnerships', 'mou industry'],
    ['placements', 'Internships & placement', 'job internship career'], ['alumni', 'Graduates & alumni', 'tracer graduate']]],
  ['quality', 'Quality (QAA)', ShieldCheck, [
    ['governance', 'Governance', 'committee board decision'], ['feedback', 'Feedback', 'survey'], ['evidence', 'QAA evidence', 'ssr qaa accreditation criterion'], ['actions', 'IQAC action plan', 'iqac improvement'], ['strategy', 'Strategic & annual plans', 'strategic plan target']]],
  ['campus', 'Campus', Building2, [
    ['facilities', 'Facilities & ICT', 'building room computer asset'], ['library', 'Library resources', 'book journal e-library'], ['vehicles', 'Vehicles & transport', 'bus driver'], ['visitors', 'Front-office visits', 'visitor reception'],
    ['users', 'Users & logins', 'account login password'], ['roles', 'Roles & permissions', 'access permission']]],
  ['reports', 'Reports', ChartNoAxesCombined, [
    ['ugc', 'UGC control center', 'ugc summary dashboard'], ['reports', 'UGC / HEMIS reports', 'hemis report export'], ['emis', 'All EMIS information', 'all modules registers'], ['audit', 'Activity log', 'audit history changes']]],
];
const FAMILY_MENU = (parent) => [
  ['child', parent ? 'My child' : 'My studies', GraduationCap, [
    ['school-messages', 'Messages', 'chat teacher school message'], ['notices', 'Notices', 'announcement circular'], ['school-routine', 'Class routine', 'timetable schedule period'], ['homework', 'Homework', 'assignment classwork'],
    ['my-attendance', 'Attendance', 'present absent'], ['school-results', 'Grade sheets', 'result marksheet report card gpa'], ['school-exams', 'Exams & admit card', 'exam routine admit card'], ['school-calendar', 'School calendar', 'holiday event'],
    ['subjects', 'Subjects', ''], ['courses', 'My courses', ''], ['timetable', 'My timetable', 'routine'], ['attendance', 'My attendance', ''], ['exams', 'My exams', ''], ['results', 'My results', 'marks grade']]],
  ['fees', 'Fees', Wallet, [['fees', 'Fee bills', 'invoice due pay esewa'], ['payments', 'Payment receipts', 'receipt paid'], ['scholarships', 'Scholarships', '']]],
  ['requests', 'Requests & records', LifeBuoy, [['leaveRequests', 'Leave notes', 'absent sick leave'], ['grievances', 'Support requests', 'complaint help'], ['placements', 'My placements', ''], ['students', parent ? 'Student record' : 'My student record', 'profile']]],
];
const ICONS = { 'school-messages': MessageSquare, notices: Contact, 'school-routine': CalendarDays, homework: PencilLine, 'my-attendance': CheckCheck, 'school-results': Award, 'school-exams': ClipboardCheck, 'school-calendar': CalendarDays, subjects: BookOpen, courses: BookOpen, timetable: CalendarDays, attendance: CheckCheck, exams: CalendarDays, results: Award, fees: Wallet, payments: Receipt, scholarships: HeartHandshake, leaveRequests: CalendarDays, grievances: LifeBuoy, placements: BriefcaseBusiness, students: GraduationCap, 'school-staff-attendance': UserCheck, 'school-accounts': Landmark };

const schoolPages = { 'school-routine': ['routine', 'read'], 'school-staff-attendance': ['staffAttendance', 'write'], 'school-exams': ['examSchedule', 'read'], 'school-cas': ['cas', 'write'], 'school-collection': ['fees', 'write', 'advances'], 'school-accounts': ['journals', 'read'], 'school-calendar': ['events', 'read'], 'school-messages': ['messages', 'read'], 'school-homework': ['homeworkChecks', 'write'], 'school-bus': ['busAttendance', 'write'], 'school-certificates': ['certificates', 'read'], 'school-idcards': ['classes', 'read', 'students'], 'school-library': ['loans', 'write'], 'school-payroll': ['payslips', 'write'], 'school-sms': ['notices', 'write'], 'school-attendance': ['schoolAttendance', 'write'], 'school-marks': ['marks', 'write'], 'school-results': ['marks', 'read'], 'school-billing': ['feeHeads', 'read', 'fees'], 'my-attendance': ['schoolAttendance', 'read'] };
const familyPages = new Set(['my-attendance', 'school-results', 'school-routine', 'school-exams', 'school-calendar', 'school-messages']);
function available(ctx, key) {
  const role = ctx.user.role, family = ['Student', 'Parent'].includes(role), school = ctx.profile.kind === 'school';
  if (['ugc', 'reports', 'emis', 'audit', 'school-iemis'].includes(key)) return !!ctx.allAccess && (key !== 'school-iemis' || school);
  if (key === 'school-promotion') return school && canManageInstitution(role);
  if (key === 'academic-years') return !school && canManageInstitution(role);
  if (key.startsWith('school-') || key === 'my-attendance') {
    if (!school || !schoolPages[key]) return false;
    const [m, op, also] = schoolPages[key];
    return can(role, m, op) && (!also || can(role, also, 'write')) && (family ? familyPages.has(key) : key !== 'my-attendance');
  }
  if (key === 'users' || key === 'roles') return canManageUsers(role);
  if (key === 'bulk-students') return can(role, 'students', 'write');
  return !!modules[key] && can(role, key);
}
function saved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
const norm = (s) => String(s || '').toLowerCase();

export default function Sidebar({ ctx, page, mobileOpen, closeMobile, compact, setCompact, onLogout }) {
  const panel = useRef(null), searchRef = useRef(null);
  const [smallScreen, setSmallScreen] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 1000px)').matches);
  useEffect(() => { const query = window.matchMedia?.('(max-width: 1000px)'); if (!query) return; const update = () => setSmallScreen(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement, sidebar = panel.current;
    sidebar?.querySelector('button[aria-label="Close navigation"]')?.focus();
    const key = event => {
      if (event.key === 'Escape') { closeMobile(); return; }
      if (event.key !== 'Tab') return;
      const buttons = [...sidebar.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(button => !button.closest('[hidden]') && button.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus?.(); };
  }, [mobileOpen]);
  // Press "/" anywhere (outside a text field) to jump to the menu search.
  useEffect(() => {
    const key = (e) => { if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target?.tagName || '') || e.target?.isContentEditable) return; e.preventDefault(); if (compact) setCompact(false); searchRef.current?.focus(); };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [compact]);
  const role = ctx.user.role, family = ['Student', 'Parent'].includes(role), manager = canManageInstitution(role);
  const menu = family ? FAMILY_MENU(role === 'Parent') : ctx.profile.kind === 'school' ? SCHOOL_MENU : COLLEGE_MENU;
  // Keep only what this person can open; drop sub-headings with nothing under them.
  const visible = useMemo(() => menu.map(([id, title, Icon, items]) => {
    const out = []; let pending = null;
    for (const it of items) { if (it[0] === '-') { pending = it[1]; continue; } if (!available(ctx, it[0]) || out.some((x) => x.key === it[0])) continue; if (pending) { out.push({ heading: pending }); pending = null; } out.push({ key: it[0], label: it[1], words: it[2] || '' }); }
    return { id, title, Icon, items: out };
  }).filter((g) => g.items.some((x) => x.key)), [menu, ctx.user.role, ctx.profile.kind, ctx.allAccess]);
  const activeGroup = visible.find((g) => g.items.some((x) => x.key === page))?.id;
  const storeKey = 'emis-nav-v2:' + (family ? 'family' : ctx.profile.kind);
  const [open, setOpen] = useState(() => { const v = saved(storeKey, null); return Array.isArray(v) ? v : family ? visible.map((g) => g.id) : []; });
  useEffect(() => { if (activeGroup) setOpen((old) => (old.includes(activeGroup) ? old : [...old, activeGroup])); }, [activeGroup]);
  useEffect(() => { save(storeKey, open); }, [open]);
  const [query, setQuery] = useState(''), [cursor, setCursor] = useState(0);
  const extras = [['overview', family ? 'My dashboard' : 'Dashboard', 'home start'], ...(!family ? [['campus', ctx.profile.kind === 'school' ? 'School information' : 'College information', 'profile about campus']] : []), ['settings', manager ? 'Settings' : 'My account', 'password profile preferences sms fine discount'], ['help', family ? 'Help & support' : 'Help & documentation', 'guide how to manual'],
    ...((ctx.data?.suite && family) || (ctx.data?.learning && !family) ? [['@learning', 'Tejasvi Learning (LMS)', 'lms lesson course online class quiz']] : []), ...(ctx.data?.suite ? [['@workspaces', 'My workspaces', 'switch school college organization']] : [])];
  const index = useMemo(() => [...visible.flatMap((g) => g.items.filter((x) => x.key).map((x) => ({ ...x, group: g.title, Icon: ICONS[x.key] || g.Icon }))), ...extras.map(([key, label, words]) => ({ key, label, words, group: 'General', Icon: key === 'overview' ? LayoutDashboard : key === 'settings' ? Settings : key === 'help' ? HelpCircle : key === '@learning' ? BookOpen : House }))], [visible, ctx.data]);
  const words = norm(query).split(/\s+/).filter(Boolean);
  const results = !words.length ? [] : index.map((x) => {
    const label = norm(x.label), hay = `${label} ${norm(x.words)} ${norm(x.group)} ${norm(x.key)}`;
    if (!words.every((w) => hay.includes(w))) return null;
    return { ...x, score: (label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2) };
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, 12);
  useEffect(() => setCursor(0), [query]);
  function openResult(k) { setQuery(''); if (k === '@learning') ctx.openLearning(); else if (k === '@workspaces') window.location.assign('/workspaces'); else ctx.go(k); }
  function searchKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); openResult(results[cursor].key); }
    else if (e.key === 'Escape') { setQuery(''); }
  }
  const item = (id, title, Icon) => <button key={id} className={`nav-item ${page === id ? 'selected' : ''}`} title={compact ? title : undefined} aria-label={title} aria-current={page === id ? 'page' : undefined} onClick={() => ctx.go(id)}>{Icon && <Icon size={20} />}<span>{title}</span></button>;
  const toggle = (id) => { if (compact && !mobileOpen) { setCompact(false); setOpen((old) => (old.includes(id) ? old : [...old, id])); } else setOpen((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id])); };
  return <aside ref={panel} inert={smallScreen && !mobileOpen} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="EMIS navigation">
    <div className="brand-zone"><div className="brand small"><span className="brand-mark"><GraduationCap size={24} /></span><div><strong>Tejasvi EMIS</strong><small>{ctx.profile.kind === 'school' ? 'School office' : 'Campus workspace'}</small></div></div><button className="sidebar-mode icon-btn" onClick={() => setCompact(!compact)} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} title={compact ? 'Expand sidebar' : 'Collapse sidebar'}>{compact ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><button className="icon-btn mobile" onClick={closeMobile} aria-label="Close navigation"><X size={20} /></button></div>
    <button className="college-switch" onClick={() => ctx.go('campus')} title={ctx.profile.name}><span className="college-avatar"><Building2 size={21} /></span><span><b>{ctx.profile.name}</b><small>{ctx.profile.kind === 'school' ? (family ? 'My school' : 'School information') : (family ? 'My college' : 'College information')}</small></span><ChevronRight size={16} /></button>
    <div className="nav-menu-search" role="combobox" aria-expanded={results.length > 0} aria-haspopup="listbox" aria-owns="emis-nav-results">
      <Search size={16} /><input ref={searchRef} aria-label="Search the menu" aria-controls="emis-nav-results" aria-activedescendant={results[cursor] ? 'nav-result-' + cursor : undefined} placeholder="Search menu…" value={query} onKeyDown={searchKey} onChange={(e) => { setQuery(e.target.value); if (compact) setCompact(false); }} />{!query && <kbd title="Press / to search">/</kbd>}{query && <button className="nav-clear" aria-label="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} /></button>}
    </div>
    <nav className="nav-scroll" aria-label="Main menu">{query.trim() ? <>
      <p className="nav-section-label" role="status">{results.length ? `${results.length} match${results.length === 1 ? '' : 'es'} · Enter to open` : 'No menu matches. Try another word, such as fee, marks or salary.'}</p>
      <div id="emis-nav-results" role="listbox" className="nav-results">{results.map((r, i) => { const Icon = r.Icon; return <button key={r.key} id={'nav-result-' + i} role="option" aria-selected={i === cursor} className={'nav-item nav-result' + (i === cursor ? ' active' : '')} onMouseEnter={() => setCursor(i)} onClick={() => openResult(r.key)}><Icon size={18} /><span><b>{r.label}</b><small>{r.group}</small></span>{i === cursor && <CornerDownLeft size={14} />}</button>; })}</div>
    </> : <>
      {item('overview', family ? 'My dashboard' : 'Dashboard', LayoutDashboard)}
      {family && ctx.data?.suite && <button className="nav-item student-learning-link" aria-label="My learning in Tejasvi" title={compact ? 'My learning in Tejasvi' : undefined} onClick={ctx.openLearning}><BookOpen size={20} /><span>My learning in Tejasvi</span></button>}
      {!family && visible.length > 1 && <div className="nav-group-actions"><button onClick={() => setOpen(visible.map((x) => x.id))}>Expand all</button><button onClick={() => setOpen([])}>Collapse all</button></div>}
      {visible.map(({ id, title, Icon, items }) => { const expanded = open.includes(id), count = items.filter((x) => x.key).length; return <div className={'nav-group' + (activeGroup === id ? ' has-active' : '')} key={id}>
        <button className="group-toggle" title={compact ? title : undefined} aria-label={`${title}, ${count} items`} aria-expanded={(!compact || mobileOpen) && expanded} aria-controls={`navigation-${id}`} onClick={() => toggle(id)}><Icon size={20} /><span>{title}</span><ChevronDown size={16} className={expanded ? '' : 'rotated'} /></button>
        <div id={`navigation-${id}`} className="nav-children" hidden={(compact && !mobileOpen) || !expanded}>{items.map((x, i) => x.heading ? <p key={'h' + i} className="nav-sub-label">{x.heading}</p> : item(x.key, x.label, family ? ICONS[x.key] : null))}</div></div>; })}
    </>}
      <div className="nav-insights">{ctx.data?.learning && !family && <button className="nav-item" onClick={ctx.openLearning} aria-label="Open Tejasvi Learning"><BookOpen size={20} /><span>Tejasvi Learning (LMS)</span></button>}{ctx.data?.suite && <a className="nav-item" href="/workspaces" title="My workspaces" aria-label="My workspaces"><House size={20} /><span>My workspaces</span></a>}{item('settings', manager ? 'Settings' : 'My account', Settings)}{!canManageUsers(role) && item('roles', 'My permissions', LockKeyhole)}{item('help', family ? 'Help & support' : 'Help & documentation', HelpCircle)}</div>
    </nav><div className="sidebar-bottom"><div className="user-block"><span className="avatar" aria-hidden="true">{ctx.user.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span><span><b>{ctx.user.name}</b><small>{role}</small></span><button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={20} /></button></div></div>
  </aside>;
}
