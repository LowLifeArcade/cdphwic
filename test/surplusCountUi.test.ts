import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const page=readFileSync(new URL('../app/pages/surplus.vue',import.meta.url),'utf8');

describe('Formula Surplus agency count and lot groups',()=>{
 it('offers agency count entry with clinic and staff/date attestation',()=>{
  expect(page).toContain('Record surplus count');
  expect(page).toContain("data?.user.agencyId");
  expect(page).toContain("'/api/surplus/counts'");
  expect(page).toContain('v-model="input.confirmerName"');
  expect(page).toContain('v-model="input.date"');
  expect(page).toContain('v-model="input.clinicId"');
  expect(page).toContain('surplusMovementReason(h.reason)');
 });

 it('summarizes multi-expiration inventory groups and retains individual lot actions',()=>{
  expect(page).toContain('groupSurplusLots(lots.value)');
  expect(page).toContain("row.kind==='group'");
  expect(page).toContain('row.group.earliestExpiration');
  expect(page).toMatch(/\{\{expandedInventoryGroups\[row\.group\.key\]\?'Hide':'View'\}\}\s*\{\{row\.group\.lots\.length\}\} expiration lots/);
  expect(page).toContain('useInRequest(row.lot)');
  expect(page).toContain('showHistory(row.lot)');
 });
});
