import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {ensureSubmittedRequest,updateSubmittedRequest} from '../server/utils/submittedRequests';
it('keeps shipment drafts private and publishes only the selected update',async()=>{
 const {db}=surplusDb();
 const row={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A']};
 const base=await ensureSubmittedRequest(db,{id:9970,submissionId:'publish-drafts',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
 const sent=await updateSubmittedRequest(db,base,{shipments:[row]},false,0);
 const drafts=[{...sent.shipments![0]!,eta:'2026-11-06'},{...row,eta:'',trackingNumbers:[]}];
 const saved=await updateSubmittedRequest(db,sent,{shipmentDrafts:drafts});
 expect(saved.shipments).toEqual(sent.shipments);
 expect(saved.eta).toBe('2026-11-01');
 expect(saved.status).toBe(sent.status);
 expect(saved.shipmentDrafts).toEqual(drafts);
 const published=await updateSubmittedRequest(db,saved,{shipmentDrafts:drafts},false,0);
 expect(published.shipments![0]!.eta).toBe('2026-11-06');
 expect(published.shipments).toHaveLength(1);
 expect(published.shipmentDrafts![1]!.eta).toBe('');
 expect(published.eta).toBe('2026-11-06');
});
it('saves an incomplete new draft without creating a published shipment or changing status',async()=>{
 const {db}=surplusDb();
 const base=await ensureSubmittedRequest(db,{id:9971,submissionId:'new-private-draft',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
 const saved=await updateSubmittedRequest(db,base,{shipmentDrafts:[{eta:'',casesShipped:0,carrier:'ups',trackingNumbers:[]}]});
 expect(saved.shipments).toBeUndefined();expect(saved.status).toBe('in_progress');expect(saved.eta).toBeUndefined();
 await expect(updateSubmittedRequest(db,saved,{shipmentDrafts:saved.shipmentDrafts},false,0)).rejects.toMatchObject({statusCode:400});
});
it('does not let a draft change receipt history or remove published shipments',async()=>{
 const {db}=surplusDb();
 const row={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A'],etaSentAt:'2026-10-30',receiptConfirmed:true,receivedCases:1};
 const base=await ensureSubmittedRequest(db,{id:9972,submissionId:'protected-draft',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'complete',shipments:[row]});
 await expect(updateSubmittedRequest(db,base,{shipmentDrafts:[{...row,eta:'2026-11-02'}]})).rejects.toMatchObject({statusCode:409});
 await expect(updateSubmittedRequest(db,base,{shipmentDrafts:[]})).rejects.toMatchObject({statusCode:400});
});
it('strips private drafts from agency response objects without changing the saved record',async()=>{
 const {withoutShipmentDrafts,staffShipmentRows,shipmentHasUnsentChanges}=await import('../shared/shipmentPublishing');
 const row={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A'],etaSentAt:'2026-10-30'};
 const record={id:1,shipments:[row],shipmentDrafts:[{...row,eta:'2026-11-06'}]};
 expect(withoutShipmentDrafts(record)).not.toHaveProperty('shipmentDrafts');expect(record.shipmentDrafts).toHaveLength(1);
 expect(staffShipmentRows(record as any)[0]!.eta).toBe('2026-11-06');expect(shipmentHasUnsentChanges(record.shipmentDrafts[0]!,row)).toBe(true);
});
it('inserts a replacement before unrelated private drafts and keeps it editable',async()=>{
 const {updateSubmittedShipmentCases}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {shipmentCaseKey}=await import('../shared/shipmentCaseTracking');
 const {staffShipmentRows}=await import('../shared/shipmentPublishing');
 for(const extra of [false,true]){
 const {db}=surplusDb();
 const row={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A'],etaSentAt:'2026-10-30',issue:{type:'missing' as const,notes:'Missing',reportedAt:'2026-10-30',reportedBy:100}};
 const base=await ensureSubmittedRequest(db,{id:9973,submissionId:'replacement-drafts',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'missing',shipments:[row]});
 const privateRow={eta:'2026-11-20',casesShipped:10,carrier:'fedex' as const,trackingNumbers:['PRIVATE']};
 const draft=await updateSubmittedRequest(db,base,{shipmentDrafts:[row,...(extra?[privateRow]:[])]});
 const next=await updateSubmittedShipmentCases(db,draft,{action:'replacement',index:0,key:shipmentReceiptKey(row),expectedCases:shipmentCaseKey(row),expectedReplacements:0},200);
 const staff=staffShipmentRows(next);
 expect(staff[1]!.replacementFor).toBe(0);expect(staff[1]!.eta).toBe('');
 if(extra)expect(staff[2]!.trackingNumbers).toEqual(['PRIVATE']);
 const saved=await updateSubmittedRequest(db,next,{shipmentDrafts:staff});
 expect(saved.shipmentDrafts).toHaveLength(extra?3:2);
 }
});
