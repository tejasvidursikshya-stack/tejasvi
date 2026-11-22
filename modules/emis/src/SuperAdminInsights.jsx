import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { academicYearLabel } from '../shared/bs.mjs';
import { BarChart3, Users, UserX, GraduationCap, TrendingDown, ChartNoAxesCombined, Wallet, SlidersHorizontal, RotateCcw, ArrowUpRight, Table2 } from 'lucide-react';
import { amount, number } from './dashboard-model.mjs';
import { dashboardFilterOptions, emptyDashboardFilters, genderSeries, superAdminInsights, UNASSIGNED_SECTION } from './super-admin-model.mjs';

const count = value => value == null ? 'Not recorded' : number(value);
function chartCeiling(value) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value / 4));
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= value / 4);
  return step * 4;
}
function labelLines(value) {
  const words = String(value).split(' '), lines = [''];
  for (const word of words) { const i = lines.length - 1; if (lines[i] && lines[i].length + word.length > 19 && lines.length < 2) lines.push(word); else lines[i] += (lines[i] ? ' ' : '') + word; }
  return lines.map(line => line.length > 26 ? line.slice(0, 24) + '…' : line);
}

function ChartPlot({ title, rows, series, mode = 'stacked' }) {
  const id = useId().replaceAll(':', ''), [hover, setHover] = useState(null);
  const w = Math.max(540, rows.length * 96), h = 300, left = 44, right = w - 18, top = 22, bottom = 239;
  const values = rows.flatMap(r => mode === 'stacked' ? [series.reduce((sum, s) => sum + (r.values[s.key] || 0), 0)] : series.map(s => r.values[s.key] || 0));
  const ceiling = chartCeiling(Math.max(0, ...values)), cell = (right - left) / Math.max(1, rows.length), x = i => left + cell * (i + .5), y = value => bottom - (bottom - top) * value / ceiling;
  const lineMode = mode === 'line' || mode === 'area';
  const segments = key => { const result = []; let segment = []; rows.forEach((row, i) => { if (row.values[key] == null) { if (segment.length) result.push(segment); segment = []; } else segment.push({ x: x(i), y: y(row.values[key]) }); }); if (segment.length) result.push(segment); return result; };
  return <>
    <div className="insight-chart-scroll" tabIndex={0} role="region" aria-label={`${title} chart, scroll horizontally if needed`}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w > 540 ? w : 500 }} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{rows.map(r => `${r.label}: ${series.map(s => `${s.label} ${count(r.values[s.key])}`).join(', ')}`).join('; ') || 'No matching records. Exact figures are available in the data table.'}</desc>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} x2={right} y1={y(ceiling * i / 4)} y2={y(ceiling * i / 4)} className="insight-grid-line"/><text x={left - 10} y={y(ceiling * i / 4) + 4} textAnchor="end" className="insight-tick">{number(ceiling * i / 4)}</text></g>)}
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="insight-axis"/>
        {lineMode && series.map(s => <g key={s.key}>{segments(s.key).map((segment, i) => { const path = segment.map((p, pi) => `${pi ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); return <g key={i}>{mode === 'area' && segment.length > 1 && <path d={`${path} L ${segment.at(-1).x} ${bottom} L ${segment[0].x} ${bottom} Z`} fill={s.color} opacity=".11"/>}<path d={path} fill="none" stroke={s.color} strokeWidth="2.8" strokeLinejoin="round"/></g>; })}</g>)}
        {rows.map((row, index) => {
          let offset = 0;
          const missing = series.length > 0 && series.every(s => row.values[s.key] == null), total = series.reduce((sum, s) => sum + (row.values[s.key] || 0), 0);
          const focus = () => setHover({ label: row.name || row.label, text: series.map(s => `${s.label}: ${count(row.values[s.key])}`).join(' · ') });
          return <g key={row.key} tabIndex={0} className="insight-datum" onFocus={focus} onBlur={() => setHover(null)} onMouseEnter={focus} onMouseLeave={() => setHover(null)} aria-label={`${row.name || row.label}: ${missing ? 'Not recorded' : `${total} records`}`}>
            {missing ? <><rect x={x(index) - Math.min(cell * .31, 34)} y={top + 16} width={Math.min(cell * .62, 68)} height={bottom - top - 16} rx="5" className="insight-missing"/><text x={x(index)} y={top + 45} textAnchor="middle" className="insight-missing-text">—</text></> : series.map((s, si) => {
              const value = row.values[s.key]; if (value == null) return null;
              if (lineMode) return <circle key={s.key} cx={x(index)} cy={y(value)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.5"><title>{`${row.label} · ${s.label}: ${count(value)}`}</title></circle>;
              const width = mode === 'grouped' ? Math.min(cell * .72 / Math.max(1, series.length), 27) : Math.min(cell * .62, 78);
              const bx = mode === 'grouped' ? x(index) - width * series.length / 2 + si * width : x(index) - width / 2;
              const base = mode === 'stacked' ? offset : 0; offset += value;
              return value > 0 ? <rect key={s.key} x={bx} y={y(base + value)} width={Math.max(1, width - (mode === 'grouped' ? 3 : 0))} height={Math.max(.5, y(0) - y(value))} fill={s.color} rx={mode === 'grouped' ? 2 : 0}><title>{`${row.label} · ${s.label}: ${count(value)}`}</title></rect> : null;
            })}
            {!missing && !lineMode && mode !== 'grouped' && <text x={x(index)} y={y(total) - 8} textAnchor="middle" className="insight-value">{number(total)}</text>}
            {labelLines(row.label).map((line, li) => <text key={li} x={x(index)} y={bottom + 24 + li * 17} textAnchor="middle" className="insight-category">{line}</text>)}
            <title>{row.name || row.label}</title>
          </g>;
        })}
      </svg>
    </div>
    <div className="insight-hover" aria-live="polite">{hover ? <><b>{hover.label}</b><span>{hover.text}</span></> : <span>Hover or focus on a category for exact figures.</span>}</div>
    <div className="insight-legend" aria-label={`${title} legend`}>{series.map(s => <span key={s.key}><i style={{ background: s.color }}/>{s.label}</span>)}</div>
  </>;
}

function ChartCard({ icon: Icon, title, subtitle, rows, series, mode, note, badge, control, dimension = 'Program' }) {
  return <section className="insight-card">
    <header className="insight-card-head"><span className="insight-icon"><Icon size={23}/></span><div><h2>{title}</h2><p>{subtitle}</p></div>{badge != null && <span className="insight-badge">{badge}</span>}</header>
    <div className="insight-chart-controls" aria-hidden={control ? undefined : true}>{control}</div>
    <ChartPlot title={title} rows={rows} series={series} mode={mode}/>
    {note && <p className="insight-chart-note">{note}</p>}
    <details className="insight-data"><summary><Table2 size={16}/>View data table</summary><div className="table-wrap"><table><caption className="sr-only">{title}</caption><thead><tr><th>{dimension}</th>{series.map(s => <th key={s.key}>{s.label}</th>)}{series.length > 1 && <th>Total</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.name || row.label}</th>{series.map(s => <td key={s.key}>{count(row.values[s.key])}</td>)}{series.length > 1 && <td>{count(row.total)}</td>}</tr>)}{!rows.length && <tr><td colSpan={series.length + 2}>No matching records.</td></tr>}</tbody></table></div></details>
  </section>;
}

export default function SuperAdminInsights({ ctx }) {
  const [draft, setDraft] = useState(() => emptyDashboardFilters(ctx.year)), [applied, setApplied] = useState(() => emptyDashboardFilters(ctx.year)), [breakdown, setBreakdown] = useState('ethnicity-gender');
  const lastYear = useRef(ctx.year);
  useEffect(() => { if (lastYear.current !== ctx.year) { lastYear.current = ctx.year; setDraft(emptyDashboardFilters(ctx.year)); setApplied(emptyDashboardFilters(ctx.year)); } }, [ctx.year]);
  const records = ctx.records, data = useMemo(() => superAdminInsights(records, applied, breakdown), [records, applied, breakdown]);
  const options = dashboardFilterOptions(records, draft.year), pending = JSON.stringify(draft) !== JSON.stringify(applied);
  const years = [...new Set([ctx.year, ...(ctx.data?.years || []), ...(ctx.profile.years || []), ...(records.students || []).map(s => s.year)])].filter(Boolean).sort().reverse();
  const change = (key, value) => setDraft(old => key === 'year' ? emptyDashboardFilters(value) : { ...old, [key]: value });
  const apply = event => { event.preventDefault(); setApplied({ ...draft }); lastYear.current = draft.year; if (draft.year !== ctx.year) ctx.setYear?.(draft.year); };
  const reset = () => { const value = emptyDashboardFilters(ctx.year); setDraft(value); setApplied(value); };
  const historyNote = `${data.history.filter(r => r.recorded).length} of 5 years contain saved enrollment records. Unrecorded years are shown as gaps.`;
  const trend = key => data.history.map(r => ({ ...r, total: r[key], values: { [key]: r[key] } }));
  return <div className="super-admin-insights">
    <section className="due-card" aria-labelledby="due-heading">
      <header className="due-head"><span className="due-icon"><Wallet size={22}/></span><div><h2 id="due-heading">Due amount to be collected</h2><p>Outstanding student invoices · {applied.year}</p></div><button className="dash-link" onClick={() => ctx.go('fees')}>Open fee register<ArrowUpRight size={16}/></button></header>
      <div className="due-summary"><div className="due-total"><strong>{amount(data.outstanding)}</strong><span>{number(data.invoices.length)} unpaid invoices · {number(data.debtors)} students with a balance</span></div><div className="due-overdue"><span>Overdue balance</span><b>{amount(data.overdue)}</b><small>{data.overdueCount} invoices past their due date</small></div></div>
      <form className="insight-filters" onSubmit={apply} aria-label="Dashboard filters">
        <label>Academic year<select aria-label="Academic year" value={draft.year} onChange={e => change('year', e.target.value)}>{years.map(year => <option key={year} value={year}>{academicYearLabel(year)}</option>)}</select></label>
        <label>Batch / intake<select aria-label="Batch / intake" value={draft.batch} onChange={e => change('batch', e.target.value)}><option value="">All batches</option>{options.batches.map(batch => <option key={batch}>{batch}</option>)}</select></label>
        <label>Program<select aria-label="Program" value={draft.programId} onChange={e => change('programId', e.target.value)}><option value="">All programs</option>{(records.programs || []).map(program => <option value={program.id} key={program.id}>{program.code || program.name}</option>)}</select></label>
        <label>Year / semester<select aria-label="Year / semester" value={draft.semester} onChange={e => change('semester', e.target.value)}><option value="">All years / semesters</option>{options.semesters.map(semester => <option key={semester}>{semester}</option>)}</select></label>
        <label>Section<select aria-label="Section" value={draft.section} onChange={e => change('section', e.target.value)}><option value="">All sections</option>{options.sections.map(section => <option key={section}>{section}</option>)}{options.unassignedSection && <option value={UNASSIGNED_SECTION}>Not assigned</option>}</select></label>
        <div className="insight-filter-actions"><button className="btn primary" type="submit"><SlidersHorizontal size={16}/>Apply</button><button className="btn" type="button" onClick={reset}><RotateCcw size={15}/>Reset</button></div>
      </form>
      <div className="insight-filter-status" role="status">{pending ? <span>Filters changed. Select Apply to update the outstanding balance and charts.</span> : <span><b>{data.students} matching students</b> · Filters apply to this balance and the six charts below.</span>}</div>
      <details className="insight-data due-data"><summary><Table2 size={16}/>Review outstanding invoices ({data.invoices.length})</summary><div className="table-wrap"><table><thead><tr><th>Student</th><th>Invoice</th><th>Due date</th><th>Balance</th><th><span className="sr-only">Open invoice</span></th></tr></thead><tbody>{data.invoices.slice(0, 8).map(invoice => <tr key={invoice.id}><td><b>{invoice.student.name}</b><small>{invoice.student.studentNo}</small></td><td>{invoice.invoiceNo}</td><td>{invoice.dueDate || 'Not set'}</td><td>{amount(invoice.balanceCents / 100)}</td><td><button className="icon-btn" aria-label={`Open invoice ${invoice.invoiceNo}`} onClick={() => ctx.setDrawer({ entity: 'fees', record: invoice })}><ArrowUpRight size={17}/></button></td></tr>)}{!data.invoices.length && <tr><td colSpan="5">No outstanding invoices match these filters.</td></tr>}</tbody></table></div>{data.invoices.length > 8 && <p className="insight-chart-note">Showing the first 8 of {data.invoices.length} unpaid invoices, ordered by due date. Open the fee register to review all invoices.</p>}</details>
    </section>
    <div className="insights-heading"><div><span className="insights-eyebrow">COLLEGE INTELLIGENCE</span><h2>Enrollment & student insights</h2></div><div className="insights-context"><span>{applied.year}</span><b>{data.active} active</b><span>{data.dropouts} dropped out</span></div></div>
    {!data.students && <p className="insights-empty" role="status">No student records match the selected filters. Choose another year or reset the filters.</p>}
    <div className="insight-grid">
      <ChartCard icon={BarChart3} title="Academic program-wise student enrollment" subtitle={`Academic year ${applied.year}`} rows={data.enrollment} series={data.enrollmentSeries} mode="stacked" badge={`${data.students} students`} control={<label>Breakdown<select aria-label="Enrollment breakdown" value={breakdown} onChange={e => setBreakdown(e.target.value)}><option value="ethnicity-gender">Ethnicity & gender</option><option value="gender">Gender</option><option value="ethnicity">Ethnicity</option></select></label>} note="Includes every enrollment status. Unspecified demographic values remain in Not disclosed."/>
      <ChartCard icon={UserX} title="Dropout students" subtitle={`By program & gender · ${applied.year}`} rows={data.dropoutGender} series={genderSeries} mode="stacked" badge={`${data.dropouts} student${data.dropouts === 1 ? '' : 's'}`} note="Counts enrollment records marked Dropped out for this academic year."/>
      <ChartCard icon={Users} title="Students by faculty & gender" subtitle={`Academic year ${applied.year}`} rows={data.facultyGender} series={genderSeries} mode="line" dimension="Academic department" note="Faculty grouping uses each program’s academic department, not individual teaching staff."/>
      <ChartCard icon={GraduationCap} title="Students by program & gender" subtitle={`Academic year ${applied.year}`} rows={data.programGender} series={genderSeries} mode="grouped" note="Compare the recorded gender distribution across your academic programs."/>
      <ChartCard icon={TrendingDown} title="Dropout students of the last 5 years" subtitle={`${data.history[0].label} – ${data.history.at(-1).label}`} rows={trend('dropouts')} series={[{ key: 'dropouts', label: 'Dropped out', color: '#ed6793' }]} mode="area" dimension="Academic year" note={historyNote}/>
      <ChartCard icon={ChartNoAxesCombined} title="Student enrollment of the last 5 years" subtitle={`${data.history[0].label} – ${data.history.at(-1).label}`} rows={trend('enrollment')} series={[{ key: 'enrollment', label: 'Enrollment records', color: '#58aee7' }]} mode="stacked" dimension="Academic year" note={historyNote}/>
    </div>
    <p className="insights-footnote">Historical counts use each year’s saved enrollment, batch, semester, section and status. The same learner can have an enrollment in more than one year. {data.sectionMissing > 0 ? `${data.sectionMissing} matching student records have no assigned section.` : ''}</p>
  </div>;
}
