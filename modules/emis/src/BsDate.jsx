// Date entry in Bikram Sambat. The stored value stays an AD date (YYYY-MM-DD) so every
// rule, report and export keeps working; people pick the day in BS and see the AD date.
import React from 'react';
import { adToBs, bsToAd, bsMonthDays, BS_MONTHS, BS_FIRST, BS_LAST } from '../shared/bs.mjs';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const years = Array.from({ length: BS_LAST - BS_FIRST + 1 }, (_, i) => BS_FIRST + i);

export function BsDateInput({ value, onChange, required, min, max, label }) {
  const bs = adToBs(value || '');
  const pick = (y, m, d) => { const day = Math.min(d, bsMonthDays(y, m)); onChange(bsToAd(y, m, day)); };
  const base = bs || adToBs(todayIso()) || { year: BS_FIRST + 3, month: 1, day: 1 };
  return <span className="bs-date">
    <span className="bs-date-picks" role="group" aria-label={(label || 'Date') + ' in Bikram Sambat'}>
      <select aria-label="BS day" value={bs ? bs.day : ''} required={required} onChange={(e) => pick(base.year, base.month, Number(e.target.value))}>
        {!bs && <option value="">Day</option>}
        {Array.from({ length: bsMonthDays(base.year, base.month) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select aria-label="BS month" value={bs ? bs.month : ''} required={required} onChange={(e) => pick(base.year, Number(e.target.value), base.day)}>
        {!bs && <option value="">Month</option>}
        {BS_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select aria-label="BS year" value={bs ? bs.year : ''} required={required} onChange={(e) => pick(Number(e.target.value), base.month, base.day)}>
        {!bs && <option value="">Year</option>}
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </span>
    <span className="bs-date-ad">AD <input type="date" aria-label={(label || 'Date') + ' in AD'} value={value || ''} min={min} max={max} required={required} onChange={(e) => onChange(e.target.value)} />
      {value && !required && <button type="button" className="bs-date-clear" onClick={() => onChange('')}>Clear</button>}</span>
  </span>;
}

/** '2026-11-19' → '3 Mangsir 2083 BS (19 Nov 2026)'. */
export function bsAdText(iso) {
  if (!iso) return '—';
  const b = adToBs(String(iso).slice(0, 10)), ad = new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return b ? `${b.day} ${BS_MONTHS[b.month - 1]} ${b.year} BS (${ad})` : ad;
}
