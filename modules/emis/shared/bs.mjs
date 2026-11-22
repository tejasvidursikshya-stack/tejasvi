// Bikram Sambat (BS) calendar. Month lengths come from the published Nepali calendar for
// 2080–2083 BS. Later years use the usual pattern and are marked as projections until the
// calendar for that year is published: add the real month lengths to OFFICIAL then.
export const BS_MONTHS = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
const START = { year: 2080, ad: '2023-04-14' }; // 1 Baishakh 2080
const OFFICIAL = {
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
};
const PROJECTED = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
export const BS_FIRST = 2080, BS_LAST = 2095;
const monthsOf = (y) => OFFICIAL[y] || PROJECTED;
const sum = (a) => a.reduce((s, n) => s + n, 0);
const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5);
const isoOf = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export const isProjected = (y) => !OFFICIAL[y];
export const bsMonthDays = (y, m) => monthsOf(y)[m - 1];

/** AD date (YYYY-MM-DD) to { year, month, day } in BS, or null outside the supported range. */
export function adToBs(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  let n = dayNum(iso) - dayNum(START.ad), y = START.year;
  if (n < 0) return null;
  while (n >= sum(monthsOf(y))) { n -= sum(monthsOf(y)); y++; if (y > BS_LAST) return null; }
  let m = 0;
  while (n >= monthsOf(y)[m]) { n -= monthsOf(y)[m]; m++; }
  return { year: y, month: m + 1, day: n + 1, projected: isProjected(y) };
}
/** BS date to the AD date (YYYY-MM-DD). */
export function bsToAd(y, m, d) {
  if (y < BS_FIRST || y > BS_LAST || m < 1 || m > 12 || d < 1 || d > bsMonthDays(y, m)) throw new Error('That Bikram Sambat date does not exist.');
  let n = 0;
  for (let yy = START.year; yy < y; yy++) n += sum(monthsOf(yy));
  for (let i = 0; i < m - 1; i++) n += monthsOf(y)[i];
  return isoOf(dayNum(START.ad) + n + d - 1);
}
export const bsMonthRange = (y, m) => ({ from: bsToAd(y, m, 1), to: bsToAd(y, m, bsMonthDays(y, m)) });
export function formatBs(iso) { const b = adToBs(iso); return b ? `${b.day} ${BS_MONTHS[b.month - 1]} ${b.year}` : ''; }
/** School academic years start in Baishakh: '2026/27' is BS 2083. */
export const bsYearOf = (year) => Number(String(year).slice(0, 4)) + 57;

/** Current BS year for a date (default today); falls back to the AD-based estimate outside the table. */
export const currentBsYear = (iso = new Date().toISOString().slice(0, 10)) => adToBs(iso)?.year || Number(iso.slice(0, 4)) + 57 - (iso.slice(5) < '04-14' ? 1 : 0);
/** Stored academic year (AD 'YYYY/YY') for a BS year: BS 2083 is '2026/27'. */
export const adYearOfBs = (bs) => { const y = Number(bs) - 57; return y + '/' + String(y + 1).slice(-2); };
/**
 * Reads an academic year typed as BS ('2083', '2083 BS', '2083/84') or AD ('2026/27') and
 * returns the stored AD form ('2026/27'), or '' when it is not a valid academic year.
 */
export function normalizeAcademicYear(input) {
  const v = String(input ?? '').trim().replace(/\s*(B\.?S\.?|बि\.?सं\.?)$/i, '').trim();
  let m = /^(\d{4})(?:\s*[/-]\s*(\d{2}|\d{4}))?$/.exec(v);
  if (!m) return '';
  const y = Number(m[1]), next = m[2] ? Number(m[2].slice(-2)) : null;
  if (next !== null && next !== (y + 1) % 100) return '';
  if (y >= 2060 && y <= 2120) return adYearOfBs(y);          // Bikram Sambat
  if (y >= 2000 && y <= 2060 && next !== null) return y + '/' + String(y + 1).slice(-2); // AD
  return '';
}
/** Display label for a stored academic year: '2026/27' → '2083 BS (2026/27)'. */
export function academicYearLabel(year) {
  const s = String(year ?? '');
  return /^\d{4}\/\d{2}$/.test(s) ? `${bsYearOf(s)} BS (${s})` : s;
}
