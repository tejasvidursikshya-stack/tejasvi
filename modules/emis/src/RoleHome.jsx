// Role dashboards for the EMIS home: one focused page per role group, built
// only from the records the server scoped to the signed-in member.
import React from 'react';
import { academicYearLabel } from '../shared/bs.mjs';
import {
  ArrowUpRight, Plus, Receipt, CheckCheck, Award, FileText, Users, GraduationCap, ShieldCheck, Wallet, CalendarDays,
  Clock, PenLine, CircleAlert, BookOpen, LifeBuoy, TrendingUp, HandCoins, Download, Video, MapPin, Sun, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { can, modules, calculateIndicators } from '../shared/schema.mjs';
import { canViewInstitution, normalizeRole, roleDescriptions } from '../shared/access.mjs';
import { campusNow, dateLabel, learningRows } from './dashboard-model.mjs';
import {
  greeting, firstName, attendanceRate, todaysClasses, marksToEnter, studentsToWatch, upcomingExams, adminActions,
  studentsByProgram, collectionByMonth, collectionByProgram, financeSummary, studentSummary, staffFocus, moduleCount,
} from './role-home-model.mjs';

const TONES = ['teal', 'sky', 'blue', 'purple', 'orange', 'rose'];
const nf = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');
const npr = (n) => { const v = Number(n) || 0; return v >= 1e7 ? `NPR ${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `NPR ${(v / 1e5).toFixed(1)}L` : `NPR ${nf(v)}`; };
const pctText = (n) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`);
const plural = (n, word) => `${n} ${n === 1 ? word : /(s|sh|ch|x)$/.test(word) ? `${word}es` : `${word}s`}`;
const initials = (name) => String(name || '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
const todayLabel = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kathmandu' });

/* ---------- Building blocks ---------- */

function Hero({ eyebrow, title, summary, actions = [] }) {
  return (
    <section className="rh-hero">
      <div className="rh-hero-glow" aria-hidden="true" />
      <div className="rh-hero-body">
        <span className="rh-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {summary && <p>{summary}</p>}
        {actions.length > 0 && (
          <div className="rh-actions">
            {actions.map(({ label, icon: Icon, onClick, primary }) => (
              <button key={label} type="button" className={`rh-qa ${primary ? 'primary' : ''}`} onClick={onClick}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Tiles({ tiles, label }) {
  const shown = tiles.filter(Boolean);
  if (!shown.length) return null;
  return (
    <section className={`rh-tiles c${Math.min(shown.length, 6)}`} aria-label={label}>
      {shown.map((t, i) => (
        <button key={t.label} type="button" className={`rh-tile tone-${t.tone || TONES[i % TONES.length]}`} onClick={t.onClick} aria-label={`${t.value} ${t.label}${t.sub ? `, ${t.sub}` : ''}`}>
          <span className="rh-tile-ring" aria-hidden="true" />
          <span className="rh-tile-icon" aria-hidden="true"><t.icon size={20} /></span>
          <span className="rh-tile-value">{t.value}</span>
          <span className="rh-tile-label">{t.label}</span>
          {t.sub && <span className="rh-tile-sub">{t.sub}</span>}
          <ArrowUpRight className="rh-tile-go" size={18} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

function Card({ title, action, children, wide, id }) {
  return (
    <section className={`rh-card ${wide ? 'wide' : ''}`} aria-labelledby={id}>
      <header className="rh-card-head">
        <h2 id={id}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function LinkButton({ children, onClick, primary }) {
  return <button type="button" className={`rh-btn ${primary ? 'primary' : ''}`} onClick={onClick}>{children}</button>;
}

function Pill({ tone = 'info', children }) {
  return <span className={`rh-pill ${tone}`}>{children}</span>;
}

function Empty({ icon: Icon = CheckCircle2, title, children }) {
  return (
    <div className="rh-empty">
      <span aria-hidden="true"><Icon size={22} /></span>
      <div><b>{title}</b>{children && <p>{children}</p>}</div>
    </div>
  );
}

function Bars({ items, empty }) {
  if (!items.length) return empty;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rh-bars">
      {items.map((i) => (
        <div className="rh-bar" key={i.label}>
          <span className="rh-bar-label" title={i.title || i.label}>{i.label}</span>
          <span className="rh-bar-track"><span style={{ width: `${(i.value / max) * 100}%`, background: i.color || '#0E7C66' }} /></span>
          <b>{i.text ?? nf(i.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Columns({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const text = items.map((i) => `${i.label} ${npr(i.value)}`).join(', ');
  return (
    <div className="rh-columns" role="img" aria-label={`Fees received by month: ${text}`}>
      {items.map((i, n) => (
        <div className="rh-col" key={i.key}>
          <span className="rh-col-value">{i.value ? npr(i.value).replace('NPR ', '') : '—'}</span>
          <span className="rh-col-bar" style={{ height: `${Math.max(4, (i.value / max) * 150)}px`, background: n === items.length - 1 ? '#FF7800' : '#2F6CB3' }} />
          <span className="rh-col-label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function ClassRows({ ctx, classes, student }) {
  if (!classes.length) return <Empty icon={Sun} title="No classes on the timetable today" />;
  return classes.map((c) => {
    const course = ctx.label('courses', c.courseId);
    const where = c.mode === 'Online' ? 'Online class' : c.room || 'Room not set';
    let status;
    if (student) {
      const mine = ctx.rows('attendance').find((a) => a.courseId === c.courseId && a.date === campusNow().date);
      status = mine ? <Pill tone={mine.status === 'Absent' ? 'danger' : 'success'}>{mine.status}</Pill> : !c.started ? <Pill tone="info">Upcoming</Pill> : <Pill tone="neutral">Not marked yet</Pill>;
    } else if (c.taken) status = <Pill tone="success">Attendance taken</Pill>;
    else if (c.needsAttendance && can(ctx.user.role, 'attendance', 'write')) status = <LinkButton primary onClick={() => ctx.setDialog({ type: 'attendance', courseId: c.courseId })}>Take attendance</LinkButton>;
    else status = <Pill tone="neutral">Upcoming</Pill>;
    return (
      <div className="rh-row" key={c.id}>
        <span className="rh-time">{c.startTime || '—'}</span>
        <div className="rh-row-text">
          <b>{course}</b>
          <small>{c.mode === 'Online' ? <Video size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />} {where}{c.endTime ? ` · until ${c.endTime}` : ''}</small>
        </div>
        {c.mode === 'Online' && c.link && c.started && !c.ended ? <a className="rh-btn" href={c.link} target="_blank" rel="noreferrer noopener">Join</a> : status}
      </div>
    );
  });
}

function ExamRows({ ctx, exams }) {
  if (!exams.length) return <Empty icon={CalendarDays} title="No upcoming exams" />;
  return exams.map((e) => (
    <button type="button" className="rh-row rh-row-btn" key={e.id} onClick={() => ctx.setDrawer({ entity: 'exams', record: e })}>
      <span className="rh-date"><small>{new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</small><b>{e.date.slice(8, 10)}</b></span>
      <div className="rh-row-text"><b>{e.name}</b><small>{ctx.label('courses', e.courseId)}{e.time ? ` · ${e.time}` : ''}{e.room ? ` · ${e.room}` : ''}</small></div>
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>
  ));
}

function ActionList({ ctx, items }) {
  if (!items.length) return <Empty title="Nothing needs your attention">Everything in your records is on track.</Empty>;
  return items.map((a) => (
    <div className="rh-row" key={a.key}>
      <Pill tone={a.tone === 'urgent' ? 'danger' : a.tone === 'today' || a.tone === 'week' ? 'warning' : 'info'}>{a.label}</Pill>
      <div className="rh-row-text"><b>{a.title}</b><small>{a.detail}</small></div>
      <LinkButton onClick={() => ctx.go(a.entity)}>{a.cta}</LinkButton>
    </div>
  ));
}

/* ---------- Admin / leadership ---------- */

function AdminHome({ ctx, setup }) {
  const role = ctx.user.role, m = calculateIndicators(ctx.records, ctx.year), todo = adminActions(ctx);
  const classes = can(role, 'timetable') ? todaysClasses(ctx) : [];
  const notTaken = classes.filter((c) => c.needsAttendance).length;
  const programs = studentsByProgram(ctx);
  const actions = [
    can(role, 'students', 'write') && { label: 'Add student', icon: Plus, onClick: () => ctx.setDrawer({ entity: 'students' }) },
    can(role, 'payments', 'write') && { label: 'Record payment', icon: Receipt, onClick: () => ctx.setDrawer({ entity: 'payments' }) },
    can(role, 'attendance', 'write') && { label: 'Take attendance', icon: CheckCheck, onClick: () => ctx.setDialog({ type: 'attendance' }) },
    can(role, 'results') && { label: 'Results', icon: Award, onClick: () => ctx.go('results') },
    ctx.allAccess && { label: 'Annual report', icon: FileText, onClick: () => ctx.go('reports') },
  ].filter(Boolean);
  return (
    <>
      {setup}
      <Hero
        eyebrow={`${todayLabel()} · Academic year ${academicYearLabel(ctx.year)}`}
        title={`${greeting()}, ${firstName(ctx.user.name)}`}
        summary={todo.length ? `${plural(todo.length, 'thing')} need${todo.length === 1 ? 's' : ''} your attention. Everything else is on track.` : 'Nothing needs your attention right now. Everything is on track.'}
        actions={actions}
      />
      <Tiles
        label="Institution at a glance"
        tiles={[
          can(role, 'students') && { icon: Users, value: nf(m.active), label: 'Active students', sub: `${nf(m.students)} enrolled in ${academicYearLabel(ctx.year)}`, tone: 'teal', onClick: () => ctx.go('students') },
          can(role, 'faculty') && { icon: GraduationCap, value: nf(m.faculty), label: 'Active faculty', sub: m.ratio ? `${m.ratio.toFixed(1)} students per teacher` : 'Add faculty to see the ratio', tone: 'sky', onClick: () => ctx.go('faculty') },
          can(role, 'attendance') && { icon: CheckCheck, value: pctText(m.attendance), label: 'Attendance', sub: m.attendance === null ? 'Nothing recorded yet' : 'Present and late, this year', tone: 'blue', onClick: () => ctx.go('attendance') },
          can(role, 'results') && { icon: Award, value: pctText(m.passRate), label: 'Pass rate', sub: m.assessed ? `${nf(m.assessed)} published results` : 'No published results yet', tone: 'purple', onClick: () => ctx.go('results') },
          can(role, 'payments') && { icon: Wallet, value: npr(m.payments), label: 'Fees collected', sub: m.invoices ? `${pctText((m.payments / m.invoices) * 100)} of ${npr(m.invoices)} invoiced` : 'No invoices yet', tone: 'orange', onClick: () => ctx.go('payments') },
          can(role, 'evidence') && { icon: ShieldCheck, value: pctText(m.readiness), label: 'QAA evidence verified', sub: m.evidence ? `${m.verified} of ${m.evidence} items` : 'No evidence recorded yet', tone: 'rose', onClick: () => ctx.go('evidence') },
        ]}
      />
      <div className="rh-grid">
        <Card id="rh-todo" title="Needs your action" action={todo.length ? <Pill tone="accent">{plural(todo.length, 'item')}</Pill> : null}>
          <ActionList ctx={ctx} items={todo} />
        </Card>
        {can(role, 'payments') && (
          <Card id="rh-fees" title="Fees received, last 6 months" action={<LinkButton onClick={() => ctx.go('payments')}>Payments</LinkButton>}>
            <Columns items={collectionByMonth(ctx).map((m) => ({ ...m, value: m.amount }))} />
          </Card>
        )}
        {can(role, 'students') && (
          <Card id="rh-programs" title="Students by program" action={<LinkButton onClick={() => ctx.go('programs')}>Programs</LinkButton>}>
            <Bars items={programs.map((p) => ({ label: p.program.code || p.program.name, title: p.program.name, value: p.count }))} empty={<Empty icon={GraduationCap} title="No enrolled students yet">Students appear here once they are enrolled in a program.</Empty>} />
            {m.gpi !== null && <p className="rh-note">Gender parity index {m.gpi.toFixed(2)}</p>}
          </Card>
        )}
        {can(role, 'timetable') && (
          <Card id="rh-today" title="Today on campus" action={<LinkButton onClick={() => ctx.go('timetable')}>Timetable</LinkButton>}>
            <div className="rh-mini">
              <div><b>{classes.length}</b><span>Classes today</span></div>
              <div><b>{notTaken}</b><span>Attendance not taken</span></div>
              <div><b>{upcomingExams(ctx, new Date(), 50).filter((e) => e.date === campusNow().date).length}</b><span>Exams today</span></div>
            </div>
            {classes.filter((c) => c.needsAttendance).slice(0, 3).map((c) => (
              <div className="rh-row" key={c.id}>
                <span className="rh-time">{c.startTime}</span>
                <div className="rh-row-text"><b>{ctx.label('courses', c.courseId)}</b><small>Attendance not taken yet</small></div>
                {can(role, 'attendance', 'write') && <LinkButton onClick={() => ctx.setDialog({ type: 'attendance', courseId: c.courseId })}>Take</LinkButton>}
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

/* ---------- Teacher ---------- */

function TeacherHome({ ctx }) {
  const classes = todaysClasses(ctx), toTake = classes.filter((c) => c.needsAttendance), marks = marksToEnter(ctx), watch = studentsToWatch(ctx);
  const next = classes.find((c) => !c.ended) || null;
  const remaining = marks.reduce((s, e) => s + e.remaining, 0);
  const rate = attendanceRate(ctx.rows('attendance')).rate;
  const studentCount = new Set(ctx.rows('courses').flatMap((c) => ctx.rows('students').filter((s) => s.programId === c.programId).map((s) => s.id))).size;
  const takeFirst = toTake[0];
  const actions = [
    takeFirst && { label: `Take attendance for ${ctx.label('courses', takeFirst.courseId)}`, icon: CheckCheck, primary: true, onClick: () => ctx.setDialog({ type: 'attendance', courseId: takeFirst.courseId }) },
    !takeFirst && can(ctx.user.role, 'attendance', 'write') && { label: 'Take attendance', icon: CheckCheck, onClick: () => ctx.setDialog({ type: 'attendance' }) },
    { label: 'Enter marks', icon: PenLine, onClick: () => ctx.go('results') },
    { label: 'Week timetable', icon: CalendarDays, onClick: () => ctx.go('timetable') },
  ].filter(Boolean);
  const summary = !classes.length
    ? 'No classes on your timetable today.'
    : `You have ${plural(classes.length, 'class')} today.${next ? ` Next: ${ctx.label('courses', next.courseId)} at ${next.startTime}${next.room && next.mode !== 'Online' ? ` in ${next.room}` : ''}.` : ' All done for today.'}`;
  return (
    <>
      <Hero eyebrow={todayLabel()} title={`${greeting()}, ${firstName(ctx.user.name)}`} summary={summary} actions={actions} />
      <Tiles
        label="Your classes at a glance"
        tiles={[
          { icon: Clock, value: nf(classes.length), label: 'Classes today', sub: classes.length ? `${classes.filter((c) => c.ended).length} done · ${classes.filter((c) => !c.ended).length} to go` : 'Free day', tone: 'blue', onClick: () => ctx.go('timetable') },
          { icon: CheckCheck, value: nf(toTake.length), label: 'Attendance to take', sub: toTake.length ? 'Classes already started' : 'All up to date', tone: 'orange', onClick: () => (takeFirst ? ctx.setDialog({ type: 'attendance', courseId: takeFirst.courseId }) : ctx.go('attendance')) },
          { icon: PenLine, value: nf(remaining), label: 'Marks still to enter', sub: marks.length ? plural(marks.length, 'exam') : 'Nothing outstanding', tone: 'purple', onClick: () => ctx.go('results') },
          { icon: Users, value: pctText(rate), label: 'Class attendance', sub: `${nf(studentCount)} students · ${plural(ctx.rows('courses').length, 'course')}`, tone: 'teal', onClick: () => ctx.go('attendance') },
          { icon: CircleAlert, value: nf(watch.length), label: 'Students to watch', sub: 'Low attendance or marks', tone: 'rose', onClick: () => ctx.go('students') },
        ]}
      />
      <div className="rh-grid">
        <Card id="rh-classes" title="Today's classes" action={<LinkButton onClick={() => ctx.go('timetable')}>Full timetable</LinkButton>}>
          <ClassRows ctx={ctx} classes={classes} />
        </Card>
        <Card id="rh-marks" title="Marks to enter" action={marks.length ? <Pill tone="warning">{plural(marks.length, 'exam')}</Pill> : null}>
          {marks.length ? marks.slice(0, 5).map((e) => (
            <div className="rh-row wrap" key={e.id}>
              <div className="rh-row-text">
                <b>{ctx.label('courses', e.courseId)} · {e.name}</b>
                <small>{e.entered} of {e.expected} entered · max {e.maxMarks}</small>
                <span className="rh-progress"><span style={{ width: `${(e.entered / e.expected) * 100}%` }} /></span>
              </div>
              <LinkButton primary onClick={() => ctx.go('results')}>Continue</LinkButton>
            </div>
          )) : <Empty title="All marks entered">Marks for finished exams are complete.</Empty>}
        </Card>
        <Card id="rh-watch" title="Students to watch" action={<LinkButton onClick={() => ctx.go('students')}>All my students</LinkButton>}>
          {watch.length ? watch.slice(0, 5).map((w) => (
            <button type="button" className="rh-row rh-row-btn" key={w.student.id} onClick={() => ctx.setDrawer({ entity: 'students', record: w.student })}>
              <span className="rh-avatar" aria-hidden="true">{initials(w.student.name)}</span>
              <div className="rh-row-text"><b>{w.student.name}</b><small>{w.detail}</small></div>
              <Pill tone={w.severity > 1 ? 'danger' : 'warning'}>{w.reason}</Pill>
            </button>
          )) : <Empty title="Everyone is on track">No student is under 75% attendance or below the pass mark.</Empty>}
          {watch.length > 5 && <p className="rh-note">+{watch.length - 5} more · attendance under 75% or marks below pass.</p>}
        </Card>
        <Card id="rh-exams" title="Upcoming exams" action={<LinkButton onClick={() => ctx.go('exams')}>Exam schedule</LinkButton>}>
          <ExamRows ctx={ctx} exams={upcomingExams(ctx)} />
        </Card>
      </div>
    </>
  );
}

/* ---------- Student ---------- */

function StudentHome({ ctx }) {
  const s = studentSummary(ctx), classes = todaysClasses({ ...ctx, rows: (k) => learningRows(ctx, k) });
  const next = classes.find((c) => !c.started) || null;
  const exams = new Map(ctx.rows('exams').map((e) => [e.id, e]));
  const enrollment = ctx.rows('students')[0];
  const learning = ctx.data?.learning || ctx.data?.suite;
  const feeLate = !!(s.nextFee?.dueDate && s.nextFee.dueDate < campusNow().date);
  const feeWhen = s.nextFee?.dueDate ? `${feeLate ? 'Overdue since' : 'Due'} ${dateLabel(s.nextFee.dueDate)}` : '';
  const parts = [];
  if (next) parts.push(`Your next class is ${ctx.label('courses', next.courseId)} at ${next.startTime}${next.room && next.mode !== 'Online' ? ` in ${next.room}` : ''}.`);
  else if (!classes.length) parts.push('No classes today.');
  if (s.nextFee?.dueDate) parts.push(feeLate ? `A fee of ${npr(s.nextFee.balance)} is overdue since ${dateLabel(s.nextFee.dueDate)}.` : `${npr(s.nextFee.balance)} fee due ${dateLabel(s.nextFee.dueDate)}.`);
  const doingWell = s.attendance.rate === null || s.attendance.rate >= 80;
  return (
    <>
      <Hero
        eyebrow={`${todayLabel()}${enrollment ? ` · ${ctx.label('programs', enrollment.programId)}${enrollment.semester ? ` · Semester ${enrollment.semester}` : ''}` : ''}`}
        title={`Hi ${firstName(ctx.user.name)}${doingWell ? ", you're doing well" : ''}`}
        summary={parts.join(' ') || 'Welcome to your student dashboard.'}
        actions={[
          learning && { label: 'Open my learning', icon: BookOpen, primary: true, onClick: ctx.openLearning },
          { label: 'My timetable', icon: CalendarDays, onClick: () => ctx.go('timetable') },
          { label: 'My results', icon: Award, onClick: () => ctx.go('results') },
          { label: 'Ask for help', icon: LifeBuoy, onClick: () => ctx.setDrawer({ entity: 'grievances' }) },
        ].filter(Boolean)}
      />
      <Tiles
        label="Your progress at a glance"
        tiles={[
          { icon: CheckCheck, value: pctText(s.attendance.rate), label: 'My attendance', sub: s.attendance.rate === null ? 'Nothing recorded yet' : s.attendance.rate >= 80 ? 'Above the 80% requirement' : 'Below 80%: talk to your teacher', tone: s.attendance.rate !== null && s.attendance.rate < 80 ? 'rose' : 'teal', onClick: () => ctx.go('attendance') },
          s.gpa !== null
            ? { icon: Award, value: s.gpa.toFixed(2), label: 'Current GPA', sub: `From ${plural(s.published.length, 'published result')}`, tone: 'purple', onClick: () => ctx.go('results') }
            : { icon: Award, value: pctText(s.average), label: 'Average mark', sub: s.published.length ? `From ${plural(s.published.length, 'published result')}` : 'No published results yet', tone: 'purple', onClick: () => ctx.go('results') },
          { icon: Wallet, value: s.balance ? npr(s.balance) : 'Paid', label: s.balance ? feeWhen || 'Fees outstanding' : 'Fees', sub: s.balance ? s.nextFee?.category || 'Outstanding balance' : 'Nothing outstanding', tone: feeLate ? 'rose' : s.balance ? 'orange' : 'teal', onClick: () => ctx.go('fees') },
          { icon: FileText, value: nf(s.examsSoon.length), label: 'Exams in the next month', sub: s.examsSoon[0] ? `Next: ${s.examsSoon[0].name}, ${dateLabel(s.examsSoon[0].date)}` : 'None scheduled', tone: 'blue', onClick: () => ctx.go('exams') },
        ]}
      />
      <div className="rh-grid">
        <Card id="rh-sclasses" title="Today's classes" action={<LinkButton onClick={() => ctx.go('timetable')}>Week view</LinkButton>}>
          <ClassRows ctx={ctx} classes={classes} student />
        </Card>
        <Card id="rh-results" title="Latest results" action={<LinkButton onClick={() => ctx.go('results')}>All results</LinkButton>}>
          {s.published.length ? s.published.slice(0, 4).map((r) => {
            const e = exams.get(r.examId);
            const passed = e ? Number(r.marks) >= Number(e.passMarks) : null;
            return (
              <button type="button" className="rh-row rh-row-btn" key={r.id} onClick={() => ctx.setDrawer({ entity: 'results', record: r })}>
                <div className="rh-row-text"><b>{e ? `${ctx.label('courses', e.courseId)} · ${e.name}` : 'Examination'}</b><small>{e?.date ? dateLabel(e.date) : ''}</small></div>
                <span className="rh-score"><b>{nf(r.marks)}{e ? ` / ${nf(e.maxMarks)}` : ''}</b>{passed !== null && <Pill tone={passed ? 'success' : 'danger'}>{passed ? 'Passed' : 'Below pass'}</Pill>}</span>
              </button>
            );
          }) : <Empty icon={Award} title="No published results yet">Marks appear here once the exam team publishes them.</Empty>}
        </Card>
        <Card id="rh-att" title="Attendance by subject" action={<LinkButton onClick={() => ctx.go('attendance')}>Details</LinkButton>}>
          <Bars items={s.byCourse.map((c) => ({ label: c.course.name, value: c.rate ?? 0, text: pctText(c.rate), color: c.rate !== null && c.rate < 80 ? '#E8590C' : '#0E7C66' }))} empty={<Empty icon={CheckCheck} title="No attendance recorded yet" />} />
          {s.byCourse.length > 0 && <p className="rh-note">Keep each subject above 80% to sit the final exam.</p>}
        </Card>
        <Card id="rh-sfees" title="Fees" action={<LinkButton onClick={() => ctx.go('payments')}>Receipts</LinkButton>}>
          <div className="rh-mini two">
            <div className="good"><b>{npr(s.paid)}</b><span>Paid this year</span></div>
            <div className={s.balance ? 'due' : 'good'}><b>{s.balance ? npr(s.balance) : 'Nothing'}</b><span>{feeWhen || 'Outstanding'}</span></div>
          </div>
          {[...ctx.rows('payments')].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3).map((p) => (
            <button type="button" className="rh-row rh-row-btn" key={p.id} onClick={() => ctx.setDrawer({ entity: 'payments', record: p })}>
              <div className="rh-row-text"><b>Receipt {p.receiptNo}</b><small>{p.method} · {dateLabel(p.date)}</small></div>
              <b>{npr(p.amount)}</b>
            </button>
          ))}
        </Card>
      </div>
      <section className="rh-help">
        <span aria-hidden="true"><LifeBuoy size={22} /></span>
        <div><b>Something not right?</b><p>Ask about fees, marks, facilities or anything else. Your college's student support team will follow up.</p></div>
        <LinkButton primary onClick={() => ctx.setDrawer({ entity: 'grievances' })}>Ask for support</LinkButton>
      </section>
    </>
  );
}

/* ---------- Finance ---------- */

function FinanceHome({ ctx }) {
  const f = financeSummary(ctx), programs = collectionByProgram(ctx), role = ctx.user.role;
  const todayTotal = f.todaysPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const summary = `${f.todaysPayments.length ? `${npr(todayTotal)} received today across ${plural(f.todaysPayments.length, 'payment')}.` : 'No payments recorded today yet.'} ${f.overdue.length ? `${plural(f.overdue.length, 'invoice')} ${f.overdue.length === 1 ? 'is' : 'are'} overdue.` : 'No invoices are overdue.'}`;
  return (
    <>
      <Hero
        eyebrow={`Finance · ${todayLabel()}`}
        title={`${greeting()}, ${firstName(ctx.user.name)}`}
        summary={summary}
        actions={[
          can(role, 'payments', 'write') && { label: 'Record payment', icon: Receipt, primary: true, onClick: () => ctx.setDrawer({ entity: 'payments' }) },
          can(role, 'fees', 'write') && { label: 'New invoice', icon: Plus, onClick: () => ctx.setDrawer({ entity: 'fees' }) },
          can(role, 'transactions', 'write') && { label: 'Record expense', icon: Download, onClick: () => ctx.setDrawer({ entity: 'transactions', defaults: { type: 'Expenditure' } }) },
        ].filter(Boolean)}
      />
      <Tiles
        label="Finance at a glance"
        tiles={[
          { icon: Wallet, value: npr(f.collected), label: 'Collected this year', sub: f.invoiced ? `${pctText((f.collected / f.invoiced) * 100)} of ${npr(f.invoiced)} invoiced` : 'No invoices yet', tone: 'teal', onClick: () => ctx.go('payments') },
          { icon: CircleAlert, value: npr(f.overdueAmount), label: 'Overdue', sub: f.overdue.length ? `${plural(f.overdue.length, 'invoice')} · ${plural(f.overdueStudents, 'student')}` : 'Nothing overdue', tone: 'rose', onClick: () => ctx.go('fees') },
          { icon: CalendarDays, value: npr(f.dueSoonAmount), label: 'Due in next 14 days', sub: plural(f.dueSoon.length, 'invoice'), tone: 'orange', onClick: () => ctx.go('fees') },
          can(role, 'transactions') && { icon: TrendingUp, value: npr(f.net), label: 'Net this year', sub: `Income ${npr(f.income)} · spend ${npr(f.expense)}`, tone: 'blue', onClick: () => ctx.go('transactions') },
          can(role, 'scholarships') && { icon: HandCoins, value: npr(f.scholarshipAmount), label: 'Scholarships awarded', sub: `${plural(f.scholarshipStudents, 'student')}${f.renewalsDue ? ` · ${f.renewalsDue} renewal${f.renewalsDue === 1 ? '' : 's'} due` : ''}`, tone: 'purple', onClick: () => ctx.go('scholarships') },
        ]}
      />
      <div className="rh-grid">
        <Card id="rh-overdue" wide title="Overdue invoices, oldest first" action={f.overdue.length > 8 ? <LinkButton onClick={() => ctx.go('fees')}>All {f.overdue.length}</LinkButton> : null}>
          {f.overdue.length ? (
            <div className="rh-table-wrap">
              <table className="rh-table">
                <thead><tr><th>Student</th><th>Invoice</th><th>Category</th><th>Balance</th><th>Overdue by</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {f.overdue.slice(0, 8).map((inv) => (
                    <tr key={inv.id}>
                      <td><b>{ctx.label('students', inv.studentId)}</b></td>
                      <td>{inv.invoiceNo}</td>
                      <td>{inv.category}</td>
                      <td><b>{npr(inv.balance)}</b></td>
                      <td><Pill tone={inv.daysOverdue > 30 ? 'danger' : 'warning'}>{plural(inv.daysOverdue, 'day')}</Pill></td>
                      <td className="rh-table-actions">
                        <LinkButton onClick={() => ctx.setDrawer({ entity: 'fees', record: inv })}>Open</LinkButton>
                        {can(role, 'payments', 'write') && <LinkButton primary onClick={() => ctx.setDrawer({ entity: 'payments', defaults: { invoiceId: inv.id, amount: inv.balance } })}>Record payment</LinkButton>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No overdue invoices">Every invoice past its due date has been paid.</Empty>}
        </Card>
        <Card id="rh-byprog" title="Collection by program" action={<LinkButton onClick={() => ctx.go('fees')}>Invoices</LinkButton>}>
          <Bars items={programs.map((p) => ({ label: ctx.label('programs', p.programId), value: p.rate ?? 0, text: pctText(p.rate), color: (p.rate ?? 0) < 75 ? '#E8590C' : '#0E7C66' }))} empty={<Empty icon={Wallet} title="No invoices yet" />} />
        </Card>
        <Card id="rh-todaypay" title="Today's payments" action={<LinkButton onClick={() => ctx.go('payments')}>All payments</LinkButton>}>
          {f.todaysPayments.length ? f.todaysPayments.slice(0, 5).map((p) => (
            <button type="button" className="rh-row rh-row-btn" key={p.id} onClick={() => ctx.setDrawer({ entity: 'payments', record: p })}>
              <div className="rh-row-text"><b>{p.receiptNo} · {ctx.label('fees', p.invoiceId)}</b><small>{p.method}{p.reference ? ` · ${p.reference}` : ''}</small></div>
              <b>{npr(p.amount)}</b>
            </button>
          )) : <Empty icon={Receipt} title="No payments recorded today" />}
          {f.todaysPayments.length > 5 && <p className="rh-note">+{f.todaysPayments.length - 5} more · {npr(todayTotal)} in total.</p>}
        </Card>
      </div>
    </>
  );
}

/* ---------- Other staff roles ---------- */

function StaffHome({ ctx }) {
  const role = normalizeRole(ctx.user.role);
  const focus = (staffFocus[role] || Object.keys(modules).filter((k) => can(role, k, 'write'))).filter((k) => can(role, k));
  const counts = focus.slice(0, 5).map((k) => moduleCount(ctx, k));
  const icons = { exams: FileText, results: Award, courses: BookOpen, students: Users, timetable: CalendarDays, attendance: CheckCheck, programs: GraduationCap, faculty: GraduationCap, admissions: GraduationCap, grievances: LifeBuoy, payments: Receipt, fees: Wallet };
  const todo = adminActions(ctx);
  const writable = focus.filter((k) => can(role, k, 'write') && k !== 'attendance').slice(0, 3);
  return (
    <>
      <Hero
        eyebrow={`${role} · ${todayLabel()}`}
        title={`${greeting()}, ${firstName(ctx.user.name)}`}
        summary={todo.length ? `${plural(todo.length, 'item')} need${todo.length === 1 ? 's' : ''} your attention.` : roleDescriptions[role] || 'Your workspace is up to date.'}
        actions={[
          ...writable.map((k) => ({ label: `New ${modules[k].singular.toLowerCase()}`, icon: Plus, onClick: () => ctx.setDrawer({ entity: k }) })),
          can(role, 'attendance', 'write') && { label: 'Take attendance', icon: CheckCheck, onClick: () => ctx.setDialog({ type: 'attendance' }) },
        ].filter(Boolean)}
      />
      <Tiles
        label="Your areas at a glance"
        tiles={counts.map((c, i) => ({ icon: icons[c.entity] || ClipboardList, value: nf(c.count), label: modules[c.entity].title, sub: c.line, tone: TONES[i % TONES.length], onClick: () => ctx.go(c.entity) }))}
      />
      <div className="rh-grid">
        <Card id="rh-stodo" title="Needs your action">
          <ActionList ctx={ctx} items={todo} />
        </Card>
        {can(role, 'timetable') && (
          <Card id="rh-sday" title="Today's classes" action={<LinkButton onClick={() => ctx.go('timetable')}>Timetable</LinkButton>}>
            <ClassRows ctx={ctx} classes={todaysClasses(ctx).slice(0, 6)} />
          </Card>
        )}
        {can(role, 'exams') && (
          <Card id="rh-sexams" title="Upcoming exams" action={<LinkButton onClick={() => ctx.go('exams')}>Exams</LinkButton>}>
            <ExamRows ctx={ctx} exams={upcomingExams(ctx)} />
          </Card>
        )}
        <Card id="rh-areas" title="Your records">
          <div className="rh-areas">
            {Object.keys(modules).filter((k) => can(role, k)).map((k) => (
              <button type="button" key={k} onClick={() => ctx.go(k)}>
                <span>{modules[k].title}</span>
                <b>{nf(ctx.rows(k).length)}</b>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

/** Picks the dashboard for the signed-in member's role. */
export default function RoleHome({ ctx, setup, details }) {
  const role = normalizeRole(ctx.user.role);
  let body;
  if (role === 'Student') body = <StudentHome ctx={ctx} />;
  else if (role === 'Faculty') body = <TeacherHome ctx={ctx} />;
  else if (role === 'Finance Head') body = <FinanceHome ctx={ctx} />;
  else if (canViewInstitution(role)) body = <AdminHome ctx={ctx} setup={setup} />;
  else body = <StaffHome ctx={ctx} />;
  return (
    <div className="role-home">
      {body}
      {details && (
        <nav className="rh-more" aria-label="More dashboard views">
          <button type="button" className="rh-btn" onClick={details}>{role === 'Student' ? 'My records' : 'Reports & details'}<ArrowUpRight size={15} aria-hidden="true" /></button>
        </nav>
      )}
    </div>
  );
}
