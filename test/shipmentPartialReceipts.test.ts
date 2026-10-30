import {expect,it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {confirmShipmentReceipts,shipmentReceiptKey,shipmentReceived,canConfirmShipment} from '../shared/shipmentReceipts';
import {receiptQuantityKey,shipmentQuantities,formatShipmentUnits} from '../shared/shipmentQuantities';
import {caseBalance,applyShipmentCaseCommand,shipmentCaseKey} from '../shared/shipmentCaseTracking';
const fixture=():RequestRecord=>({id:9080,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',approvedCases:30,status:'shipped',shipments:[{supplier:'Example Supplier',unitsPerCase:6,casesShipped:30,eta:'2026-11-01',etaSentAt:'2026-10-29T00:00:00Z',carrier:'ups',trackingNumbers:['A']}]});
const selection=(r:RequestRecord,cases:number,loose=0,damaged=0)=>({index:0,key:shipmentReceiptKey(r.shipments![0]!),expectedReceipt:receiptQuantityKey(r.shipments![0]!),receivedCases:cases,receivedLooseUnits:loose,damagedLooseUnits:damaged});
it('requires an explicit received quantity and keeps 10 of 30 cases outstanding after receipt of 20',()=>{
 const request=fixture();expect(()=>confirmShipmentReceipts(request,[{index:0,key:shipmentReceiptKey(request.shipments![0]!)}],100)).toThrow();
 const partial={...request,...confirmShipmentReceipts(request,[selection(request,20)],100)};
 expect(shipmentQuantities(partial,partial.shipments![0]!)).toMatchObject({receivedUnits:120,missingUnits:60,usableUnits:120});
 expect(shipmentReceived(partial,partial.shipments![0]!)).toBe(false);expect(canConfirmShipment(partial,partial.shipments![0]!)).toBe(true);
 expect(partial.status).not.toBe('complete');expect(partial.shipments![0]!.issue!.type).toBe('incomplete');
 const full={...partial,...confirmShipmentReceipts(partial,[selection(partial,30)],100)};
 expect(shipmentReceived(full,full.shipments![0]!)).toBe(true);expect(full.status).toBe('complete');
 expect(()=>confirmShipmentReceipts(full,[selection(partial,20)],100)).toThrow();
});
it('retains two good cases and two good cans when only two cans are damaged',()=>{
 const request=fixture();request.shipments![0]!.casesShipped=3;
 const received={...request,...confirmShipmentReceipts(request,[selection(request,2,4,2)],100)};
 const quantities=shipmentQuantities(received,received.shipments![0]!);
 expect(quantities).toMatchObject({receivedUnits:16,damagedUnits:2,usableUnits:14,missingUnits:2});
 expect(formatShipmentUnits(quantities.usableUnits,6)).toBe('2 cases + 2 units');
 expect(caseBalance(received).retained).toBeCloseTo(14/6);
 const disposed={...received,...applyShipmentCaseCommand(received,{index:0,key:shipmentReceiptKey(received.shipments![0]!),expectedCases:shipmentCaseKey(received.shipments![0]!),action:'destroyed',cases:0,looseUnits:2,fromDamaged:true,notes:'Documented destruction of 2 damaged cans'},100)};
 expect(shipmentQuantities(disposed,disposed.shipments![0]!)).toMatchObject({disposedUnits:2,damagedHeldUnits:0,usableUnits:14});
 expect(caseBalance(disposed).retained).toBeCloseTo(14/6);
});
it('rejects invalid damage totals and receipt corrections below documented disposed units',()=>{
 const request=fixture();expect(()=>confirmShipmentReceipts(request,[selection(request,0,1,2)],100)).toThrow();
 const received={...request,...confirmShipmentReceipts(request,[selection(request,1)],100)};
 const returned={...received,...applyShipmentCaseCommand(received,{index:0,key:shipmentReceiptKey(received.shipments![0]!),expectedCases:shipmentCaseKey(received.shipments![0]!),action:'returned',cases:1,notes:'Return R-1'},100)};
 expect(()=>confirmShipmentReceipts(returned,[selection(returned,0)],100)).toThrow();
});
it('persists cumulative partial receipts and locks packaging without losing counts on later staff saves',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedShipmentReceipt,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{...fixture(),submissionId:'partial-unit-persistence'});
 const partial=await updateSubmittedShipmentReceipt(db,original,[selection(original,20)],100);
 expect(partial.shipments![0]!.receivedUnits).toBe(120);
 await expect(updateSubmittedRequest(db,partial,{shipments:[{...partial.shipments![0]!,unitsPerCase:12}]})).rejects.toMatchObject({statusCode:409});
 const staff=await updateSubmittedRequest(db,partial,{shipments:[{...partial.shipments![0]!,supplier:'Corrected Supplier',receivedUnits:0,damagedUnits:0}]});
 expect(staff.shipments![0]!.receivedUnits).toBe(120);
 const full=await updateSubmittedShipmentReceipt(db,staff,[selection(staff,30)],100);
 expect(full.shipments![0]!.receivedUnits).toBe(180);expect(full.status).toBe('complete');
 await expect(updateSubmittedShipmentReceipt(db,partial,[selection(partial,25)],100)).rejects.toMatchObject({statusCode:409});
});
it('does not close a missing original against a fully damaged replacement',()=>{
 const request=fixture();request.shipments![0]!.issue={type:'missing',notes:'Original missing',reportedAt:'2026-10-29',reportedBy:100};
 request.shipments!.push({...request.shipments![0]!,issue:undefined,replacementFor:0,casesShipped:1});
 const damaged={...request,...confirmShipmentReceipts(request,[{index:1,key:shipmentReceiptKey(request.shipments![1]!),receivedCases:1,damagedCases:1}],100)};
 expect(()=>applyShipmentCaseCommand(damaged,{index:0,key:shipmentReceiptKey(damaged.shipments![0]!),expectedCases:shipmentCaseKey(damaged.shipments![0]!),action:'close-replaced',notes:'Replacement arrived'},200)).toThrow();
});
it('requires a current receipt snapshot when resolving an issue with quantities',async()=>{
 const {applyShipmentIssue,shipmentIssueKey}=await import('../shared/shipmentIssues');
 const request=fixture();const partial={...request,...confirmShipmentReceipts(request,[selection(request,20,0,1)],100)};
 const issueCommand={index:0,key:shipmentReceiptKey(partial.shipments![0]!),expectedIssue:shipmentIssueKey(partial.shipments![0]!),action:'resolve-received' as const,receivedCases:20,damagedLooseUnits:1};
 expect(()=>applyShipmentIssue(partial,issueCommand,100)).toThrow();
 const newer={...partial,...confirmShipmentReceipts(partial,[selection(partial,25,0,1)],100)};
 expect(()=>applyShipmentIssue(newer,{...issueCommand,expectedReceipt:receiptQuantityKey(partial.shipments![0]!)},100)).toThrow();
});
it('includes a partially received shipment in both partial and issue filters',async()=>{
 const {filterAndSortRequests}=await import('../shared/requestListFilters');
 const request=fixture();const partial={...request,...confirmShipmentReceipts(request,[selection(request,20)],100)};
 expect(filterAndSortRequests([partial],'partial','all','eta')).toHaveLength(1);
 expect(filterAndSortRequests([partial],'issue','all','eta')).toHaveLength(1);
});
