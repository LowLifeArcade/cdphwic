import {expect,it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {applyShipmentDeletion,canDeleteShipment} from '../shared/shipmentDeletion';
import {requestShipments} from '../shared/requestShipments';
const row=(tracking='A')=>({eta:'2026-11-01',casesShipped:2,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:[tracking],etaSentAt:'2026-10-30'});
const base=():RequestRecord=>({id:9980,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',shipments:[row(),row('B')],shipmentDrafts:[row(),{...row('B'),eta:'2026-11-05'},row('PRIVATE')]});
it('deletes one published shipment and corresponding draft while archiving its snapshot',()=>{
 const source=base();const next={...source,...applyShipmentDeletion(source,1,200,'2026-10-30T12:00:00Z')};
 expect(next.shipments).toHaveLength(1);expect(next.shipmentDrafts).toHaveLength(2);
 expect(next.shipmentDrafts![1]!.trackingNumbers).toEqual(['PRIVATE']);
 expect(next.unitsIssued).toBe(2);expect(next.trackingNumbers).toEqual([{number:'A',carrier:'ups'}]);
 expect(next.deletedShipments![0]).toMatchObject({shipment:row('B'),draft:{eta:'2026-11-05'},deletedBy:200,deletedAt:'2026-10-30T12:00:00Z'});
 expect(source.shipments).toHaveLength(2);
});
it('deletes a saved private draft without publishing it or changing published totals',()=>{
 const source=base();const updates=applyShipmentDeletion(source,2,200);
 expect(updates.shipmentDrafts).toHaveLength(2);expect(updates.shipments).toBeUndefined();expect(updates.status).toBeUndefined();
});
it('permits deleting the final shipment without resurrecting a legacy fallback',()=>{
 const source={...base(),shipments:[row()],shipmentDrafts:[row()]};
 const next={...source,...applyShipmentDeletion(source,0,200)};
 expect(requestShipments(next)).toEqual([]);expect(next.eta).toBe('');expect(next.unitsIssued).toBe(0);expect(next.status).toBe('in_progress');
});
it('protects all receipt and issue history, including zero quantities and deleted reports',()=>{
 for(const history of [{receiptConfirmed:true},{receivedCases:0},{receivedUnits:0},{receivedAt:'2026-10-30'},{receiptCountHistory:[{cases:0,notes:'Counted',recordedAt:'2026-10-30',recordedBy:100}]},{issue:{type:'missing',reportedAt:'2026-10-30',reportedBy:100,notes:'Missing',resolvedAt:'2026-10-30'}},{deletedIssues:[{issue:{type:'missing',reportedAt:'2026-10-30',reportedBy:100,notes:'Missing'},deletedAt:'2026-10-30',deletedBy:100}]}]){
 const source=base();Object.assign(source.shipments![0]!,history);
 expect(canDeleteShipment(source,0)).toBe(false);expect(()=>applyShipmentDeletion(source,0,200)).toThrow();
 }
});
it('preserves replacement links when removing a preceding shipment',()=>{
 const source=base();source.shipments!.push({...row('R'),replacementFor:1});source.shipmentDrafts=source.shipments!.map(r=>({...r}));
 expect(()=>applyShipmentDeletion(source,1,200)).toThrow();
 const next=applyShipmentDeletion(source,0,200);expect(next.shipments![1]!.replacementFor).toBe(0);expect(next.shipmentDrafts![1]!.replacementFor).toBe(0);
});
it('allows a new ETA after deleting the final published shipment',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,deleteSubmittedShipment,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{...base(),submissionId:'delete-then-send',shipments:[row()],shipmentDrafts:[row()]});
 const deleted=await deleteSubmittedShipment(db,original,0,200);
 const sent=await updateSubmittedRequest(db,deleted,{shipmentDrafts:[row('NEW')]},false,0,200);
 expect(sent.shipments![0]!.trackingNumbers).toEqual(['NEW']);expect(sent.deletedShipments).toHaveLength(1);
});
it('does not treat a new private draft as a legacy received shipment',()=>{
 const source={...base(),receivedStatus:'received' as const,shipments:[row()],shipmentDrafts:[row(),row('PRIVATE')]};
 expect(canDeleteShipment(source,0)).toBe(false);expect(canDeleteShipment(source,1)).toBe(true);
});
