import {receiptQuantityKey} from '../shared/shipmentQuantities';
import {expect,it} from 'vitest';
import {applyShipmentIssue,shipmentIssueKey} from '../shared/shipmentIssues';
import {shipmentReceiptKey,confirmShipmentReceipts,canConfirmShipment} from '../shared/shipmentReceipts';
import {deliveryCategory} from '../shared/requestListFilters';
import type {RequestRecord} from '../shared/domain';
const fixture=():RequestRecord=>({id:9060,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Formula',status:'shipped',shipments:[{eta:'2026-11-01',carrier:'ups',casesShipped:2,trackingNumbers:['A']},{eta:'2026-11-02',carrier:'fedex',casesShipped:3,trackingNumbers:['B']}]});
const command=(r:RequestRecord,index=0)=>({index,key:shipmentReceiptKey(r.shipments![index]!),expectedIssue:shipmentIssueKey(r.shipments![index]!),receivedCases:r.shipments![index]!.casesShipped,expectedReceipt:receiptQuantityKey(r.shipments![index]!),action:'report' as const,type:'damaged' as const,notes:'Two damaged cases'});
it('reports one shipment while allowing receipt of the other and blocking completion',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,command(request),100,'2026-11-01T10:00:00Z')};
 expect(reported.shipments![0]!.issue).toMatchObject({type:'damaged',notes:'Two damaged cases',reportedBy:100,reportedAt:'2026-11-01T10:00:00Z'});
 expect(reported.shipments![1]!.issue).toBeUndefined();expect(deliveryCategory(reported)).toBe('issue');
 expect(canConfirmShipment(reported,reported.shipments![0]!)).toBe(true);
 expect(confirmShipmentReceipts(reported,[{index:0,key:shipmentReceiptKey(reported.shipments![0]!),receivedCases:2}],100).shipments![0]!.issue!.resolvedAt).toBeUndefined();
 const received={...reported,...confirmShipmentReceipts(reported,[{index:1,key:shipmentReceiptKey(reported.shipments![1]!),receivedCases:(reported.shipments![1]!).casesShipped,expectedReceipt:receiptQuantityKey(reported.shipments![1]!)}],100)};
 expect(received.shipments![1]!.receivedAt).toBeTruthy();expect(received.status).not.toBe('complete');
 const resolved={...received,...applyShipmentIssue(received,{...command(received),action:'resolve'},100)};
 expect(resolved.shipments![0]!.issue!.resolvedAt).toBeTruthy();expect(resolved.shipments![1]!.receivedAt).toBe(received.shipments![1]!.receivedAt);
 expect(canConfirmShipment(resolved,resolved.shipments![0]!)).toBe(true);
 const complete={...resolved,...confirmShipmentReceipts(resolved,[{index:0,key:shipmentReceiptKey(resolved.shipments![0]!),receivedCases:(resolved.shipments![0]!).casesShipped,expectedReceipt:receiptQuantityKey(resolved.shipments![0]!)}],100)};
 expect(complete.status).toBe('complete');
});
it('reopens an already received shipment issue and requires explicit resolution',()=>{
 const request=fixture();const complete={...request,...confirmShipmentReceipts(request,request.shipments!.map((row,index)=>({index,key:shipmentReceiptKey(row),receivedCases:(row).casesShipped,expectedReceipt:receiptQuantityKey(row)})),100)};
 const issue={...complete,...applyShipmentIssue(complete,command(complete),100)};
 expect(issue.status).toBe('damaged');expect(issue.shipments![0]!.receivedAt).toBeTruthy();
 const resolved={...issue,...applyShipmentIssue(issue,{...command(issue),action:'resolve'},100)};
 expect(resolved.status).toBe('complete');expect(resolved.receivedStatus).toBe('received');
});
it('rejects changed shipments, stale issue state, invalid types and reports on unsent shipments',()=>{
 const request=fixture();const cmd=command(request);
 expect(()=>applyShipmentIssue(request,{...cmd,key:'stale'},100)).toThrow();
 expect(()=>applyShipmentIssue(request,{...cmd,type:'invalid' as never},100)).toThrow();
 const reported={...request,...applyShipmentIssue(request,cmd,100)};
 expect(()=>applyShipmentIssue(reported,cmd,100)).toThrow();
 expect(()=>applyShipmentIssue({...request,status:'unopened'},cmd,100)).toThrow();
});
it('preserves shipment issues during unrelated staff saves and rejects altered or removed reported shipments',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedShipmentIssue,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const previous=await ensureSubmittedRequest(db,{...fixture(),submissionId:'shipment-issue-test'});
 const reported=await updateSubmittedShipmentIssue(db,previous,command(previous),100);
 const saved=await updateSubmittedRequest(db,reported,{shipments:previous.shipments,receivedStatus:'shipped',status:'shipped'});
 expect(saved.shipments![0]!.issue).toEqual(reported.shipments![0]!.issue);expect(saved.status).toBe('damaged');
 const altered=structuredClone(previous.shipments!);altered[0]!.trackingNumbers=['Changed'];
 await expect(updateSubmittedRequest(db,saved,{shipments:altered})).rejects.toMatchObject({statusCode:409});
 const other=await updateSubmittedShipmentIssue(db,saved,command(saved,1),100);
 const resolved=await updateSubmittedShipmentIssue(db,other,{...command(other),action:'resolve'},100);
 expect(resolved.status).toBe('damaged');expect(resolved.shipments![1]!.issue!.resolvedAt).toBeUndefined();
});
it('retains historical receipts when reporting an issue on a legacy completed request',()=>{
 const request=fixture();request.status='complete';request.receivedStatus='received';
 const reported={...request,...applyShipmentIssue(request,command(request),100)};
 expect(reported.shipments!.every(row=>row.receiptConfirmed)).toBe(true);
 const resolved={...reported,...applyShipmentIssue(reported,{...command(reported),action:'resolve'},100)};
 expect(resolved.status).toBe('complete');expect(resolved.receivedStatus).toBe('received');
});
it('keeps unaffected legacy shipments eligible after an Incomplete report',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,{...command(request),type:'incomplete'},100)};
 expect(canConfirmShipment(reported,reported.shipments![1]!)).toBe(true);
 const confirmed={...reported,...confirmShipmentReceipts(reported,[{index:1,key:shipmentReceiptKey(reported.shipments![1]!),receivedCases:(reported.shipments![1]!).casesShipped,expectedReceipt:receiptQuantityKey(reported.shipments![1]!)}],100)};
 expect(confirmed.shipments![1]!.receivedAt).toBeTruthy();expect(confirmed.status).toBe('needs_info');
});
it('does not make an unsent sibling confirmable when a sent shipment has an issue or is resolved',()=>{
 const request=fixture();request.status='in_progress';request.shipments![0]!.etaSentAt='2026-10-29T00:00:00Z';
 const reported={...request,...applyShipmentIssue(request,command(request),100)};
 expect(canConfirmShipment(reported,reported.shipments![1]!)).toBe(false);
 expect(()=>applyShipmentIssue(reported,command(reported,1),100)).toThrow();
 const resolved={...reported,...applyShipmentIssue(reported,{...command(reported),action:'resolve'},100)};
 expect(resolved.status).toBe('in_progress');expect(canConfirmShipment(resolved,resolved.shipments![1]!)).toBe(false);
});
it('appends CDPH/WIC responses without resolving the report and retains responses when an open report is edited',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,command(request),100)};
 const responded={...reported,...applyShipmentIssue(reported,{...command(reported),action:'respond',notes:'We are checking with the carrier.'},200,'2026-11-02T10:00:00Z')};
 expect(responded.shipments![0]!.issue!.responses).toEqual([{notes:'We are checking with the carrier.',createdAt:'2026-11-02T10:00:00Z',createdBy:200}]);
 expect(responded.shipments![0]!.issue!.resolvedAt).toBeUndefined();expect(responded.status).toBe('damaged');
 const edited={...responded,...applyShipmentIssue(responded,{...command(responded),action:'update',notes:'Updated agency details'},100)};
 expect(edited.shipments![0]!.issue!.responses).toEqual(responded.shipments![0]!.issue!.responses);
 expect(()=>applyShipmentIssue(responded,{...command(responded),action:'respond',notes:' '},200)).toThrow();
});
it('resolves and marks only the selected shipment received, completing only when all others are received',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,command(request),100)};
 const resolved={...reported,...applyShipmentIssue(reported,{...command(reported),action:'resolve-received'},100,'2026-11-02T11:00:00Z')};
 expect(resolved.shipments![0]!.issue!.resolvedBy).toBe(100);expect(resolved.shipments![0]!.receivedAt).toBe('2026-11-02T11:00:00Z');
 expect(resolved.shipments![1]!.receivedAt).toBeUndefined();expect(resolved.status).toBe('shipped');
 const complete={...resolved,...confirmShipmentReceipts(resolved,[{index:1,key:shipmentReceiptKey(resolved.shipments![1]!),receivedCases:(resolved.shipments![1]!).casesShipped,expectedReceipt:receiptQuantityKey(resolved.shipments![1]!)}],100)};
 expect(complete.status).toBe('complete');
});
it('updates a resolved issue without reopening it, then reopens it while retaining responses and receipts',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,command(request),100)};
 const responded={...reported,...applyShipmentIssue(reported,{...command(reported),action:'respond',notes:'Carrier checked.'},200)};
 const resolved={...responded,...applyShipmentIssue(responded,{...command(responded),action:'resolve-received'},100)};
 const edited={...resolved,...applyShipmentIssue(resolved,{...command(resolved),action:'update',notes:'Corrected details'},200)};
 expect(edited.shipments![0]!.issue!.resolvedAt).toBe(resolved.shipments![0]!.issue!.resolvedAt);
 expect(edited.shipments![0]!.issue!.responses).toEqual(resolved.shipments![0]!.issue!.responses);
 const reopened={...edited,...applyShipmentIssue(edited,{...command(edited),action:'reopen'},200,'2026-11-03T00:00:00Z')};
 expect(reopened.shipments![0]!.issue!.resolvedAt).toBeUndefined();expect(reopened.shipments![0]!.issue!.reopenedBy).toBe(200);
 expect(reopened.shipments![0]!.issue!.notes).toBe('Corrected details');
 expect(reopened.shipments![0]!.receivedAt).toBe(resolved.shipments![0]!.receivedAt);
 expect(deliveryCategory(reopened)).toBe('issue');expect(reopened.status).toBe('damaged');
 expect(()=>applyShipmentIssue(edited,{...command(resolved),action:'reopen'},200)).toThrow();
 expect(()=>applyShipmentIssue(request,{...command(request),action:'update'},200)).toThrow();
});
it('deletes a report without deleting received quantities, dispositions, or responses from its audit record',()=>{
 const request=fixture();const reported={...request,...applyShipmentIssue(request,command(request),100)};
 reported.shipments![0]!.receivedCases=1;
 reported.shipments![0]!.issue!.responses=[{notes:'Please send labels only.',createdAt:'2026-10-29',createdBy:200}];
 const removed={...reported,...applyShipmentIssue(reported,{...command(reported),action:'delete'},100,'2026-10-29T12:00:00Z')};
 expect(removed.shipments![0]!.issue).toBeUndefined();
 expect(removed.shipments![0]!.receivedCases).toBe(1);
 expect(removed.shipments![0]!.deletedIssues![0]).toMatchObject({deletedBy:100,deletedAt:'2026-10-29T12:00:00Z',issue:reported.shipments![0]!.issue});
 expect(removed.status).toBe('shipped');
 expect(()=>applyShipmentIssue(removed,{...command(removed),action:'delete'},100)).toThrow();
});
it('keeps deleted issue audits attached to immutable shipments during staff edits',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedShipmentIssue,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{...fixture(),submissionId:'deleted-issue-retention'});
 const reported=await updateSubmittedShipmentIssue(db,original,command(original),100);
 const removed=await updateSubmittedShipmentIssue(db,reported,{...command(reported),action:'delete'},100);
 await expect(updateSubmittedRequest(db,removed,{shipments:removed.shipments!.slice(1)})).rejects.toMatchObject({statusCode:409});
 const changed=structuredClone(removed.shipments!);changed[0]!.trackingNumbers=['changed'];
 await expect(updateSubmittedRequest(db,removed,{shipments:changed})).rejects.toMatchObject({statusCode:409});
});
