import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLetterhead, letterheadOf, letterheadLines, SIGNATORY_KEYS } from '../modules/emis/shared/letterhead.mjs';

test('letterhead settings get safe defaults', () => {
  const lh = letterheadOf({});
  assert.equal(lh.showLogo, true);
  assert.equal(lh.signatories.principal.title, 'Principal');
  assert.deepEqual(Object.keys(lh.signatories), SIGNATORY_KEYS);
});
test('letterhead settings are validated and trimmed', () => {
  const lh = cleanLetterhead({ nameNepali: ' युनाइटेड स्कूल ', showPan: false, signatories: { principal: { name: ' Sita Sharma ', title: '' } } });
  assert.equal(lh.nameNepali, 'युनाइटेड स्कूल');
  assert.equal(lh.showPan, false);
  assert.deepEqual(lh.signatories.principal, { name: 'Sita Sharma', title: 'Principal' });
  assert.throws(() => cleanLetterhead({ slogan: 'x'.repeat(161) }), /Slogan/);
  assert.throws(() => cleanLetterhead('bad'), /Invalid/);
});
test('header lines follow the profile and toggles without repeating the address', () => {
  const p = { kind: 'school', address: 'Kirtipur-3, Kathmandu', municipality: 'Kirtipur', district: 'Kathmandu', province: 'Bagmati', phone: '01-4330000', email: 'office@united.edu.np', established: '2050', panNumber: '600123456', registrationNumber: '24113', code: '270010001' };
  const lines = letterheadLines(p);
  assert.equal(lines[0], 'Kirtipur-3, Kathmandu, Bagmati Province');
  assert.equal(lines[1], 'Tel: 01-4330000 · office@united.edu.np');
  assert.equal(lines[2], 'Estd. 2050 · IEMIS code: 270010001 · Reg. no. 24113 · PAN 600123456');
  assert.equal(letterheadLines(p, cleanLetterhead({ showPan: false, showContact: false }))[1], 'Estd. 2050 · IEMIS code: 270010001 · Reg. no. 24113');
});
