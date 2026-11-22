// Settings → Print & letterhead: logo, header lines, signatories and footer for every printout.
import React, { useRef, useState } from 'react';
import { Check, ImagePlus, Trash2, AlertCircle } from 'lucide-react';
import { letterheadOf, SIGNATORIES, SIGNATORY_KEYS } from '../shared/letterhead.mjs';
import { Letterhead, LetterFooter, logoSrc } from './Letterhead.jsx';

const TOGGLES = [
  ['showLogo', 'Logo'], ['showAddress', 'Address'], ['showContact', 'Phone, email and website'], ['showEstd', 'Established year'],
  ['showCode', 'IEMIS / institution code'], ['showRegistration', 'Registration number'], ['showPan', 'PAN number'],
  ['showSeal', 'Space for the school seal'], ['showPrintedDate', 'Printed date (BS and AD)'],
];

export default function LetterheadSettings({ ctx, api, editable }) {
  const [lh, setLh] = useState(() => letterheadOf(ctx.profile)), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const file = useRef(null), branding = ctx.data?.branding, school = ctx.profile.kind === 'school';
  const set = (k, v) => setLh((p) => ({ ...p, [k]: v }));
  const sign = (k, f, v) => setLh((p) => ({ ...p, signatories: { ...p.signatories, [k]: { ...p.signatories[k], [f]: v } } }));
  const run = async (fn) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const save = (e) => { e.preventDefault(); run(async () => { await api('/profile', 'PUT', { ...ctx.profile, letterhead: lh }); await ctx.changed('Letterhead saved. Every printout now uses it.'); }); };
  const upload = (f) => {
    if (!f) return;
    if (f.size > 2_000_000) { setError('Choose a logo under 2 MB.'); return; }
    run(async () => {
      const image = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('Could not read that file.')); r.readAsDataURL(f); });
      await api('/letterhead/logo', 'POST', { image }); await ctx.changed('Logo updated.');
    });
  };
  const preview = { ...lh };
  return <form className="lh-settings" onSubmit={save}>
    <section className="card settings-form">
      <div className="section-head"><div><h2>Logo</h2><p>PNG, JPEG or WebP, under 2 MB. A square or wide logo on a white or transparent background prints best.</p></div></div>
      <div className="lh-logo-row">
        {logoSrc(branding) ? <img src={logoSrc(branding)} alt="Current logo" /> : <span className="lh-logo-empty">No logo</span>}
        {editable && <><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={16} />{branding?.hasLogo ? 'Replace logo' : 'Upload logo'}</button>
          {branding?.hasLogo && <button type="button" className="btn" disabled={busy} onClick={() => run(async () => { await api('/letterhead/logo', 'POST', { remove: true }); await ctx.changed('Logo removed.'); })}><Trash2 size={16} />Remove</button>}</>}
      </div>
      <div className="form-divider" />
      <div className="section-head"><div><h2>Header</h2><p>The {school ? 'school' : 'college'} name, address, phone, email, Estd., PAN and codes come from the Institution profile tab.</p></div></div>
      <div className="form-grid">
        <label className="span-two">Name in Nepali (optional)<input disabled={!editable} lang="ne" value={lh.nameNepali} maxLength={160} placeholder={school ? 'e.g. युनाइटेड स्कूल' : 'e.g. नाम क्याम्पस'} onChange={(e) => set('nameNepali', e.target.value)} /></label>
        <label className="span-two">Slogan / motto (optional)<input disabled={!editable} value={lh.slogan} maxLength={160} placeholder="e.g. Knowledge, discipline and service" onChange={(e) => set('slogan', e.target.value)} /></label>
      </div>
      <div className="lh-toggles">{TOGGLES.map(([k, l]) => <label key={k}><input type="checkbox" disabled={!editable} checked={!!lh[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>)}</div>
      <div className="form-divider" />
      <div className="section-head"><div><h2>Signatures</h2><p>Names print above each title. Leave a name blank for a signature line only.</p></div></div>
      <div className="lh-sign-grid">{SIGNATORY_KEYS.map((k) => <React.Fragment key={k}>
        <label>{SIGNATORIES[k]} · name<input disabled={!editable} value={lh.signatories[k].name} maxLength={80} placeholder={k === 'principal' && ctx.profile.principal ? ctx.profile.principal : 'Name'} onChange={(e) => sign(k, 'name', e.target.value)} /></label>
        <label>Printed title<input disabled={!editable} value={lh.signatories[k].title} maxLength={60} onChange={(e) => sign(k, 'title', e.target.value)} /></label>
      </React.Fragment>)}</div>
      <div className="form-divider" />
      <div className="form-grid"><label className="span-two">Footer note (optional)<textarea rows={2} disabled={!editable} value={lh.footerNote} maxLength={300} placeholder="e.g. This document is computer generated. Contact the school office for verification." onChange={(e) => set('footerNote', e.target.value)} /></label></div>
      {error && <div className="error-box" role="alert"><AlertCircle size={17} />{error}</div>}
      {editable && <div className="settings-save"><button className="btn primary" disabled={busy}><Check size={16} />{busy ? 'Saving…' : 'Save letterhead'}</button></div>}
    </section>
    <aside className="lh-preview" aria-label="Letterhead preview">
      <p className="eyebrow">PREVIEW</p>
      <Letterhead ctx={ctx} settings={preview} title="GRADE SHEET" subtitle="First Terminal · Academic year 2083 BS" />
      <div className="lh-preview-body">Document content</div>
      <LetterFooter ctx={ctx} settings={preview} signs={['classTeacher', 'examCoordinator', 'principal']} seal />
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Used on grade sheets, certificates, admit cards, fee invoices and receipts, payslips, routines, registers, accounts and reports. ID cards use the logo and name.</p>
    </aside>
  </form>;
}
