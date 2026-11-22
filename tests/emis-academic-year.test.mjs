import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAcademicYear, academicYearLabel, adYearOfBs, currentBsYear } from '../modules/emis/shared/bs.mjs';

test('academic years can be typed in Bikram Sambat or AD', () => {
  for (const v of ['2083', '2083 BS', '2083/84', ' 2083 ', '2026/27']) assert.equal(normalizeAcademicYear(v), '2026/27', v);
  assert.equal(normalizeAcademicYear('2084'), '2027/28');
  for (const v of ['', '2026', '2083/85', '2026/28', 'abc', '1999/00']) assert.equal(normalizeAcademicYear(v), '', v);
});
test('academic years display in BS with the AD year', () => {
  assert.equal(academicYearLabel('2026/27'), '2083 BS (2026/27)');
  assert.equal(adYearOfBs(2083), '2026/27');
  assert.equal(currentBsYear('2026-11-19'), 2083);
  assert.equal(currentBsYear('2027-04-14'), 2083);
  assert.equal(currentBsYear('2027-04-15'), 2084);
});

import { isWeeklyHoliday, SCHOOL_DAYS, WEEKLY_HOLIDAYS } from '../modules/emis/shared/school-ops.mjs';
test('Saturday and Sunday are weekly holidays; school runs Monday to Friday', () => {
  assert.deepEqual(WEEKLY_HOLIDAYS, ['Saturday', 'Sunday']);
  assert.deepEqual(SCHOOL_DAYS, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(isWeeklyHoliday('2026-11-21'), true);  // Saturday, 5 Mangsir 2083
  assert.equal(isWeeklyHoliday('2026-11-22'), true);  // Sunday
  assert.equal(isWeeklyHoliday('2026-11-23'), false); // Monday
});
