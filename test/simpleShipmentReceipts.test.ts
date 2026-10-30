import {expect,it} from 'vitest';
import {confirmSimpleShipmentReceipt} from '../shared/simpleShipmentReceipts';
import {shipmentReceived,shipmentReceiptKey} from '../shared/shipmentReceipts';
import {receiptQuantityKey} from '../shared/shipmentQuantities';
import type {RequestRecord} from '../shared/domain';
const fixture=():RequestRecord=>({id:9995,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:5,unitsPerCase:6,carrier:'ups',trackingNumbers:['A'],etaSentAt:'2026-10-30'}]});
const command=(r:RequestRecord)=>({index:0,key:shipmentReceiptKey(r.shipments![0]!),expectedReceipt:receiptQuantityKey(r.shipments![0]!),expectedIssue:JSON.stringify(r.shipments![0]!.issue??null),damaged:false,issueNotes:''});
it('confirms receipt without inventing case or unit counts',()=>{
 const r=fixture();const next={...r,...confirmSimpleShipmentReceipt(r,command(r),100)};
 expect(next.shipments![0]).toMatchObject({receiptMode:'simple',receiptConfirmed:true,receivedBy:100});
 expect(next.shipments![0]!.receivedCases).toBeUndefined();expect(next.shipments![0]!.receivedUnits).toBeUndefined();
 expect(shipmentReceived(next,next.shipments![0]!)).toBe(true);expect(next.status).toBe('complete');
});
it('reports damage without quantities and retains the same issue on correction',()=>{
 let r=fixture();r={...r,...confirmSimpleShipmentReceipt(r,{...command(r),damaged:true,issueNotes:'Damaged packaging'},100)};
 expect(r.shipments![0]!.issue).toMatchObject({type:'damaged',notes:'Damaged packaging'});
 const issue=r.shipments![0]!.issue!;issue.responses=[{notes:'Reviewing',createdAt:'2026-10-30',createdBy:200}];
 const next=confirmSimpleShipmentReceipt(r,{...command(r),issueNotes:'Corrected report'},100);
 expect(next.shipments![0]!.issue).toMatchObject({id:issue.id,resolvedBy:100,responses:issue.responses});
});
it('preserves historical quantities and rejects stale snapshots',()=>{
 const r=fixture();Object.assign(r.shipments![0]!,{receivedCases:2,receivedUnits:12,damagedUnits:1});
 const next=confirmSimpleShipmentReceipt(r,command(r),100);
 expect(next.shipments![0]).toMatchObject({receivedCases:2,receivedUnits:12,damagedUnits:1});
 expect(()=>confirmSimpleShipmentReceipt(r,{...command(r),expectedReceipt:'stale'},100)).toThrow();
});
