import {expect,it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {shipmentReceiptKey,confirmShipmentReceipts} from '../shared/shipmentReceipts';
import {caseBalance,applyShipmentCaseCommand,shipmentCaseKey,shipmentListSummary} from '../shared/shipmentCaseTracking';
const fixture=():RequestRecord=>({id:9070,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Formula',status:'shipped',approved:true,approvedCases:10,shipments:[{eta:'2026-11-01',casesShipped:10,carrier:'ups',trackingNumbers:['ORIGINAL'],etaSentAt:'2026-10-29T00:00:00Z',issue:{type:'missing',notes:'Not found',reportedAt:'2026-11-02T00:00:00Z',reportedBy:100}}]});
const command=(r:RequestRecord)=>({expectedReplacements:r.shipments!.filter(row=>row.replacementFor===0).length,index:0,key:shipmentReceiptKey(r.shipments![0]!),expectedCases:shipmentCaseKey(r.shipments![0]!)});
it('links a replacement, retains the original issue and approval baseline, and keeps a pending replacement unreceived',()=>{
 const r=fixture();const next={...r,...applyShipmentCaseCommand(r,{...command(r),action:'replacement'},200)};
 expect(next.shipments).toHaveLength(2);expect(next.shipments![1]!.replacementFor).toBe(0);
 expect(next.shipments![0]!.issue).toEqual(r.shipments![0]!.issue);expect(next.originalApprovedCases).toBe(10);
 expect(shipmentListSummary(next,'2026-11-03').received).toBe(0);
 expect(caseBalance({...next,approvedCases:100}).approved).toBe(10);
});
it('counts original plus replacement receipts and subtracts only documented returns/destruction',()=>{
 const r=fixture();delete r.shipments![0]!.issue;
 const first={...r,...confirmShipmentReceipts(r,[{index:0,key:shipmentReceiptKey(r.shipments![0]!),receivedCases:8}],100)};
 const originalCases=caseBalance(first);expect(originalCases.retained).toBe(8);
 first.shipments!.push({eta:'2026-11-03',casesShipped:4,carrier:'ups',trackingNumbers:['REPLACEMENT'],receivedAt:'2026-11-03T00:00:00Z',receivedCases:4,replacementFor:0});
 expect(caseBalance(first)).toMatchObject({received:12,retained:12,excess:2});
 expect(()=>applyShipmentCaseCommand(first,{...command(first),action:'returned',cases:2,notes:''},200)).toThrow();
 const adjusted={...first,...applyShipmentCaseCommand(first,{...command(first),action:'destroyed',cases:2,notes:'Destruction form reference D-1'},200)};
 expect(caseBalance(adjusted)).toMatchObject({received:12,disposed:2,retained:10,excess:0});
 expect(adjusted.shipments![0]!.dispositions![0]).toMatchObject({kind:'destroyed',cases:2,notes:'Destruction form reference D-1',recordedBy:200});
 expect(()=>applyShipmentCaseCommand(adjusted,{...command(adjusted),action:'returned',cases:7,notes:'Too many'},200)).toThrow();
});
it('records partial/over deliveries accurately and rejects stale corrections or counts below disposed cases',()=>{
 const r=fixture();const recorded={...r,...applyShipmentCaseCommand(r,{...command(r),action:'received-count',cases:12,notes:'Counted at receiving'},100)};
 expect(caseBalance(recorded).excess).toBe(2);expect(recorded.status).toBe('missing');
 expect(()=>applyShipmentCaseCommand(recorded,{...command(r),action:'received-count',cases:10,notes:'Stale'},100)).toThrow();
 const returned={...recorded,...applyShipmentCaseCommand(recorded,{...command(recorded),action:'returned',cases:3,notes:'Return R-1'},100)};
 expect(()=>applyShipmentCaseCommand(returned,{...command(returned),action:'received-count',cases:2,notes:'Invalid correction'},100)).toThrow();
});
it('summarizes shipments with earliest unreceived dispatched ETA and flags overdue delivery',()=>{
 const r=fixture();delete r.shipments![0]!.issue;r.shipments![0]!.receivedAt='2026-11-01T10:00:00Z';r.receivedStatus='shipped';
 r.shipments!.push({eta:'2026-11-03',casesShipped:2,carrier:'ups',trackingNumbers:['B'],etaSentAt:'2026-10-29T00:00:00Z'},{eta:'2026-11-02',casesShipped:2,carrier:'fedex',trackingNumbers:['C'],etaSentAt:'2026-10-29T00:00:00Z'});
 expect(shipmentListSummary(r,'2026-11-03')).toMatchObject({received:1,total:3,awaiting:2,nextEta:'2026-11-02',overdue:true});
 expect(caseBalance({...r,approvedCases:undefined}).needsApproval).toBe(true);
});
it('closes a missing original as replaced without a false receipt and flags a later original delivery',()=>{
 const r=fixture();const withReplacement={...r,...applyShipmentCaseCommand(r,{...command(r),action:'replacement'},200)};
 withReplacement.shipments![1]={...withReplacement.shipments![1]!,eta:'2026-11-03',casesShipped:10,trackingNumbers:['R'],etaSentAt:'2026-11-02T00:00:00Z',receivedCases:10,receivedAt:'2026-11-03T00:00:00Z'};
 const closed={...withReplacement,...applyShipmentCaseCommand(withReplacement,{...command(withReplacement),action:'close-replaced',notes:'Replacement delivered; carrier confirmed original lost.'},200)};
 expect(closed.status).toBe('complete');expect(closed.shipments![0]!.receivedAt).toBeUndefined();
 expect(shipmentListSummary(closed,'2026-11-04')).toMatchObject({received:1,replaced:1,awaiting:0,nextEta:''});
 expect(caseBalance(closed)).toMatchObject({retained:10,excess:0,projectedExcess:0});
 const late={...closed,...applyShipmentCaseCommand(closed,{...command(closed),action:'received-count',cases:10,notes:'Original located and delivered late'},100)};
 expect(caseBalance(late)).toMatchObject({retained:20,excess:10});
});
it('persists counts and documented deductions and preserves them across stale staff shipment payloads',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedShipmentCases,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const source=fixture();delete source.shipments![0]!.issue;
 const original=await ensureSubmittedRequest(db,{...source,id:9071,submissionId:'case-persistence'});
 const counted=await updateSubmittedShipmentCases(db,original,{...command(original),action:'received-count',cases:12,notes:'Actual receiving count'},100);
 const disposed=await updateSubmittedShipmentCases(db,counted,{...command(counted),action:'returned',cases:2,notes:'Return reference R-1'},200);
 const staffSave=await updateSubmittedRequest(db,disposed,{shipments:original.shipments,approvedCases:100});
 expect(caseBalance(staffSave)).toMatchObject({received:12,disposed:2,retained:10,approved:10,excess:0});
 expect(staffSave.shipments![0]!.receiptCountHistory![0]!.recordedBy).toBe(100);
 await expect(updateSubmittedShipmentCases(db,staffSave,{...command(counted),action:'destroyed',cases:1,notes:'Stale details'},200)).rejects.toMatchObject({statusCode:409});
});
it('rejects duplicate replacement retries and ignores unsent draft ETAs',()=>{
 const original=fixture();const creation={...command(original),action:'replacement' as const};
 const added={...original,...applyShipmentCaseCommand(original,creation,200)};
 expect(()=>applyShipmentCaseCommand(added,creation,200)).toThrow();
 added.shipments![1]!.eta='2026-10-01';
 expect(shipmentListSummary(added,'2026-11-02').nextEta).toBe('2026-11-01');
});
