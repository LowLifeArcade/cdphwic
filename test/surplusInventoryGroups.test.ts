import {describe,expect,it} from 'vitest';
import {groupSurplusLots} from '../shared/surplusInventoryGroups';
import {surplusMovementReason} from '../shared/surplusMovement';
import type {SurplusLot} from '../shared/surplus';

const lot=(id:string,overrides:Partial<SurplusLot>={}):SurplusLot=>({
 id,agencyId:10,formulaName:'Nutramigen',form:'ready-to-feed',flavor:'Vanilla',expirationDate:'2027-03-01',
 clinicId:'north',clinicName:'North Clinic',onHand:10,reserved:2,expiredUnits:1,version:0,...overrides,
});

describe('surplus inventory display groups',()=>{
 it('groups expiration lots and aggregates each balance while sorting by expiration',()=>{
  const groups=groupSurplusLots([
   lot('later',{expirationDate:'2027-09-01',onHand:8,reserved:3,expiredUnits:0}),
   lot('earlier',{expirationDate:'2027-03-01',onHand:10,reserved:2,expiredUnits:1}),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({onHand:18,reserved:5,available:13,expiredUnits:1,total:19,earliestExpiration:'2027-03-01'});
  expect(groups[0]!.lots.map(row=>row.id)).toEqual(['earlier','later']);
 });

 it('keeps the same formula separate by agency and clinic',()=>{
  const groups=groupSurplusLots([
   lot('north'),
   lot('south',{clinicId:'south',clinicName:'South Clinic'}),
   lot('other-agency',{agencyId:11,clinicId:'north',clinicName:'North Clinic'}),
  ]);
  expect(groups).toHaveLength(3);
  expect(groups.map(group=>group.key)).toHaveLength(3);
 });
});

it('renders count attestation details from inventory history as readable text',()=>{
 expect(surplusMovementReason(JSON.stringify({reason:'Opening count',staff:'Agency Staff',date:'2026-11-16'}))).toBe('Opening count · Counted by Agency Staff · Count date 2026-11-16');
 expect(surplusMovementReason('legacy movement')).toBe('legacy movement');
});
