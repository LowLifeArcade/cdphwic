import {describe,expect,it} from 'vitest';
import {groupSurplusLots} from '../shared/surplusInventoryGroups';
import {decorateSurplusMovements,surplusMovementReason} from '../shared/surplusMovement';
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
 expect(surplusMovementReason(JSON.stringify({reason:'Opening count',staff:'Agency Staff',date:'2026-11-16'}))).toBe('Opening count · Counted by Agency Staff · Count date 11-16-2026');
 expect(surplusMovementReason(JSON.stringify({reason:'Donation',staff:'Agency Staff',date:'2026-11-16'}))).toBe('Donation · Recorded by Agency Staff · Donation date 11-16-2026');
 expect(surplusMovementReason(JSON.stringify({reason:'Destruction',staff:'Agency Staff',date:'2026-11-16'}))).toBe('Destruction · Recorded by Agency Staff · Destruction date 11-16-2026');
 expect(surplusMovementReason(JSON.stringify({reason:'Correction',note:'Count was transcribed incorrectly',staff:'Correcting Staff',date:'2026-11-16'}))).toBe('Correction: Count was transcribed incorrectly · Corrected by Correcting Staff · Correction date 2026-11-16');
 expect(surplusMovementReason('legacy movement')).toBe('legacy movement');
});

it('decorates history with correction eligibility and the latest corrected quantity',()=>{
 const rows:any[]=[
  {id:'correction-2',kind:'correct-entry',quantity:2,reason:'{}',corrects_movement_id:'count-entry',corrected_quantity:6,command_payload:'{"kind":"correct-entry"}'},
  {id:'correction-1',kind:'correct-entry',quantity:2,reason:'{}',corrects_movement_id:'count-entry',corrected_quantity:8,command_payload:'{"kind":"correct-entry"}'},
  {id:'count-entry',kind:'reconcile',quantity:10,reason:'{}',created_at:'2026-10-01',corrects_movement_id:null,corrected_quantity:null,agency_authored:true,command_payload:'{"kind":"reconcile"}'},
  {id:'donation-entry',kind:'deduct',quantity:3,reason:'{"reason":"Donation"}',corrects_movement_id:null,corrected_quantity:null,agency_authored:true,command_payload:'{"kind":"deduct"}'},
  {id:'review-entry',kind:'reconcile',quantity:5,reason:'{}',corrects_movement_id:null,corrected_quantity:null,agency_authored:false,command_payload:'{"kind":"reconcile","reportId":"report-1"}'},
  {id:'review-direct-entry',kind:'reconcile',quantity:4,reason:'{}',corrects_movement_id:null,corrected_quantity:null,agency_authored:false,command_payload:'{"kind":"reconcile","confirmerName":"Reviewer"}'},
  {id:'review-donation-entry',kind:'deduct',quantity:3,reason:'{"reason":"Donation"}',corrects_movement_id:null,corrected_quantity:null,agency_authored:false,command_payload:'{"kind":"deduct","reason":"Donation"}'},
 ];
 const history=decorateSurplusMovements(rows,true);
 expect(history.find(row=>row.id==='count-entry')).toMatchObject({correctable:true,effective_quantity:6,quantity:10});
 expect(history.find(row=>row.id==='donation-entry')?.correctable).toBe(true);
 expect(history.find(row=>row.id==='review-entry')).toMatchObject({correctable:false,effective_quantity:5});
 expect(history.find(row=>row.id==='review-direct-entry')?.correctable).toBe(true);
 expect(history.find(row=>row.id==='review-donation-entry')?.correctable).toBe(false);
 expect(history.find(row=>row.id==='correction-2')).toMatchObject({corrects_movement_id:'count-entry',corrected_quantity:6});
 expect(history.find(row=>row.id==='correction-2')?.correction_target).toEqual({id:'count-entry',created_at:'2026-10-01',kind:'reconcile',quantity:10});
 expect(decorateSurplusMovements(rows,false).find(row=>row.id==='count-entry')?.correctable).toBe(false);
});
