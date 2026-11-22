// One letterhead and footer for every printed EMIS document, driven by
// Settings → Print & letterhead (profile.letterhead) and the institution logo.
import React from 'react';
import { letterheadOf, letterheadLines } from '../shared/letterhead.mjs';
import { formatBs } from '../shared/bs.mjs';

const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const logoSrc = (branding) => branding?.hasLogo ? `/api/branding/${branding.id}?v=${branding.logoVersion || 0}` : '';
const initials = (name = '') => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Logo, school names, slogan and contact lines, with the document title on the right. */
export function Letterhead({ ctx, title, subtitle, compact = false, settings }) {
  const p = ctx.profile, lh = settings || letterheadOf(p), src = lh.showLogo ? logoSrc(ctx.data?.branding) : '';
  const lines = letterheadLines(p, lh);
  return <header className={'lh' + (compact ? ' lh-compact' : '')}>
    <div className="lh-brand">
      {lh.showLogo && (src ? <img className="lh-logo" src={src} alt={p.name + ' logo'} /> : <span className="lh-logo lh-mark" aria-hidden="true">{initials(p.name)}</span>)}
      <div className="lh-names">
        {lh.nameNepali && <div className="lh-nepali" lang="ne">{lh.nameNepali}</div>}
        <div className="lh-name">{p.name}</div>
        {lh.slogan && <div className="lh-slogan">{lh.slogan}</div>}
        {!compact && lines.map((l) => <div key={l} className="lh-line">{l}</div>)}
        {compact && lines[0] && <div className="lh-line">{lines[0]}</div>}
      </div>
    </div>
    {(title || subtitle) && <div className="lh-doc">{title && <strong>{title}</strong>}{subtitle && <span>{subtitle}</span>}</div>}
  </header>;
}

/** Signature blocks, footer note and the printed date in BS and AD. */
export function LetterFooter({ ctx, signs = ['principal'], note, seal = false, settings }) {
  const lh = settings || letterheadOf(ctx.profile), day = isoToday();
  return <footer className="lh-footer">
    {signs.length > 0 && <div className="lh-signs">{signs.map((k) => {
      const s = lh.signatories[k] || { name: '', title: k };
      return <div key={k} className="lh-sign"><span className="lh-sign-line" /><b>{s.name || (k === 'principal' && ctx.profile.principal) || ' '}</b><span>{s.title}</span></div>;
    })}{seal && lh.showSeal && <div className="lh-sign lh-seal"><span className="lh-seal-ring">School seal</span></div>}</div>}
    {(note || lh.footerNote || lh.showPrintedDate) && <div className="lh-foot-meta">
      <span>{[note, lh.footerNote].filter(Boolean).join(' ')}</span>
      {lh.showPrintedDate && <span>Printed on {formatBs(day)} BS ({day})</span>}
    </div>}
  </footer>;
}

/** For pages printed straight from the screen: shown only on paper. */
export function PrintHeader({ ctx, title, subtitle }) {
  return <div className="lh-print-only"><Letterhead ctx={ctx} title={title} subtitle={subtitle} compact /></div>;
}
export function PrintFooter({ ctx, signs = [] }) {
  return <div className="lh-print-only"><LetterFooter ctx={ctx} signs={signs} /></div>;
}
