import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, can } from '../modules/emis/shared/schema.mjs';
import { roleAvailable, rolesForKind, canViewInstitution, canManageUsers, assignableRoles } from '../modules/emis/shared/access.mjs';

test('Principal is a school-only role', () => {
  assert.ok(ROLES.includes('Principal'));
  assert.equal(roleAvailable('Principal', 'school'), true);
  assert.equal(roleAvailable('Principal', 'college'), false);
  assert.ok(!rolesForKind(ROLES, 'college').includes('Principal'));
  assert.ok(rolesForKind(ROLES, 'school').includes('Principal'));
  assert.ok(assignableRoles('Admin').includes('Principal'));
});
test('Principal leads academics but not accounts or finance', () => {
  assert.equal(canViewInstitution('Principal'), true);
  assert.equal(canManageUsers('Principal'), false);
  for (const e of ['students', 'fees', 'payments', 'journals']) assert.equal(can('Principal', e), true, 'read ' + e);
  for (const e of ['marks', 'terms', 'routine', 'notices', 'events', 'leaveRequests', 'staffAttendance']) assert.equal(can('Principal', e, 'write'), true, 'write ' + e);
  for (const e of ['fees', 'payments', 'journals', 'payslips', 'salaryStructures']) assert.equal(can('Principal', e, 'write'), false, 'no write ' + e);
});
