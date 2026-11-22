// Letterhead and footer settings used by every printed EMIS document (grade sheets,
// certificates, invoices, receipts, payslips, admit cards, ID cards and page reports).
// Stored in the institution profile as `letterhead`; shared by the server and the web app.

/** Signature blocks a document can ask for, with the default printed title. */
export const SIGNATORIES = {
  principal: 'Principal',
  classTeacher: 'Class teacher',
  examCoordinator: 'Exam coordinator',
  accountant: 'Accountant',
  preparedBy: 'Prepared by',
  receivedBy: 'Received by',
};
export const SIGNATORY_KEYS = Object.keys(SIGNATORIES);

export const LETTERHEAD_DEFAULTS = Object.freeze({
  nameNepali: '', slogan: '', showLogo: true, showEstd: true, showPan: true, showRegistration: true, showCode: true,
  showAddress: true, showContact: true, footerNote: '', showPrintedDate: true, showSeal: true,
  signatories: Object.fromEntries(SIGNATORY_KEYS.map((k) => [k, { name: '', title: SIGNATORIES[k] }])),
});

const text = (v, max, label) => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) throw Object.assign(new Error(`${label} must be text of at most ${max} characters.`), { status: 400, campusPublic: true });
  return v.trim();
};
const flag = (v, fallback) => (v === undefined ? fallback : v === true);

/** Validates letterhead settings from a form; throws a readable error. */
export function cleanLetterhead(input = {}) {
  if (typeof input !== 'object' || Array.isArray(input) || !input) throw Object.assign(new Error('Invalid letterhead settings.'), { status: 400, campusPublic: true });
  const d = LETTERHEAD_DEFAULTS, sig = input.signatories || {};
  return {
    nameNepali: text(input.nameNepali, 160, 'Name in Nepali'),
    slogan: text(input.slogan, 160, 'Slogan'),
    footerNote: text(input.footerNote, 300, 'Footer note'),
    showLogo: flag(input.showLogo, d.showLogo), showEstd: flag(input.showEstd, d.showEstd), showPan: flag(input.showPan, d.showPan),
    showRegistration: flag(input.showRegistration, d.showRegistration), showCode: flag(input.showCode, d.showCode),
    showAddress: flag(input.showAddress, d.showAddress), showContact: flag(input.showContact, d.showContact),
    showPrintedDate: flag(input.showPrintedDate, d.showPrintedDate), showSeal: flag(input.showSeal, d.showSeal),
    signatories: Object.fromEntries(SIGNATORY_KEYS.map((k) => [k, {
      name: text(sig[k]?.name, 80, 'Signatory name'),
      title: text(sig[k]?.title, 60, 'Signatory title') || SIGNATORIES[k],
    }])),
  };
}

/** Settings with defaults filled in, for display. */
export function letterheadOf(profile = {}) {
  const saved = profile.letterhead || {};
  try { return cleanLetterhead(saved); } catch { return cleanLetterhead({}); }
}

/** The lines printed under the school name, in order. */
export function letterheadLines(profile = {}, lh = letterheadOf(profile)) {
  const address = String(profile.address || ''), has = (v) => v && address.toLowerCase().includes(String(v).toLowerCase());
  const place = [address, !has(profile.municipality) && profile.ward && `Ward ${profile.ward}`, !has(profile.municipality) && profile.municipality, !has(profile.district) && profile.district, !has(profile.province) && profile.province && `${profile.province} Province`].filter(Boolean);
  const contact = [profile.phone && `Tel: ${profile.phone}`, profile.email, profile.website].filter(Boolean);
  const ids = [lh.showEstd && profile.established && `Estd. ${profile.established}`, lh.showCode && profile.code && `${profile.kind === 'school' ? 'IEMIS code' : 'Code'}: ${profile.code}`,
    lh.showRegistration && profile.registrationNumber && `Reg. no. ${profile.registrationNumber}`, lh.showPan && profile.panNumber && `PAN ${profile.panNumber}`].filter(Boolean);
  return [lh.showAddress && place.join(', '), lh.showContact && contact.join(' · '), ids.join(' · ')].filter(Boolean);
}
