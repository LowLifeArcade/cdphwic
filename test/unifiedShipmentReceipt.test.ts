import {expect,it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {confirmShipmentReceipts,shipmentReceiptKey} from '../shared/shipmentReceipts';
import {receiptQuantityKey} from '../shared/shipmentQuantities';
const fixture=():RequestRecord=>({id:9990,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',shipments:[{eta:'2026-11-01',etaSentAt:'2026-10-30',casesShipped:3,unitsPerCase:6,carrier:'ups',trackingNumbers:['A']}]});
const selection=(r:RequestRecord,receivedCases=2,damagedLooseUnits=1)=>({index:0,key:shipmentReceiptKey(r.shipments![0]!),expectedReceipt:receiptQuantityKey(r.shipments![0]!),expectedIssue:JSON.stringify(r.shipments![0]!.issue??null),receivedCases,damagedLooseUnits,issueNotes:'One dented can and one missing case.'});
it('confirms quantities and saves issue notes in one operation',()=>{
 const r=fixture();const next={...r,...confirmShipmentReceipts(r,[selection(r)],100)};
 expect(next.shipments![0]!.issue).toMatchObject({source:'receipt-quantity',notes:'One dented can and one missing case.',type:'damaged'});
 expect(next.shipments![0]).toMatchObject({receivedUnits:12,damagedUnits:1});
});
it('corrects the same receipt issue, preserving responses and evidence, then resolves corrected quantities',()=>{
 let r=fixture();r={...r,...confirmShipmentReceipts(r,[selection(r)],100)};
 const issue=r.shipments![0]!.issue!;issue.responses=[{notes:'Reviewing',createdAt:'2026-10-30',createdBy:200}];issue.labelsSent={date:'2026-10-30',reference:'Label-A',recordedAt:'2026-10-30',recordedBy:100};
 const corrected={...r,...confirmShipmentReceipts(r,[{...selection(r,3,0),issueNotes:'Corrected the count; all product is undamaged.'}],100)};
 expect(corrected.shipments![0]!.issue).toMatchObject({id:issue.id,notes:'Corrected the count; all product is undamaged.',responses:issue.responses,labelsSent:issue.labelsSent,resolvedBy:100});
 expect(corrected.shipments![0]!.issue!.resolvedAt).toBeTruthy();expect(corrected.status).toBe('complete');
});
it('guards note changes against concurrent issue edits and rejects invalid notes',()=>{
 const r=fixture();
 expect(()=>confirmShipmentReceipts(r,[{...selection(r),expectedIssue:'stale'}],100)).toThrow();
 expect(()=>confirmShipmentReceipts(r,[{...selection(r),issueNotes:'x'.repeat(4001)}],100)).toThrow();
});
it('refreshes an image retry after a reviewer response without switching issues or shipments',async()=>{
 const {refreshReceiptEvidence}=await import('../shared/receiptEvidenceRetry');
 let r=fixture();r={...r,...confirmShipmentReceipts(r,[selection(r)],100)};
 const fresh=structuredClone(r);fresh.shipments![0]!.issue!.responses=[{notes:'Please attach the image.',createdAt:'2026-10-30',createdBy:200}];
 expect(await refreshReceiptEvidence(r,0,async()=>fresh)).toBe(fresh);
 const changed=structuredClone(fresh);changed.shipments![0]!.issue!.id='different-issue';
 await expect(refreshReceiptEvidence(r,0,async()=>changed)).rejects.toThrow();
 const moved=structuredClone(fresh);moved.shipments![0]!.trackingNumbers=['OTHER-SHIPMENT'];
 await expect(refreshReceiptEvidence(r,0,async()=>moved)).rejects.toThrow();
});
it('allows receipt corrections to clear issue notes without deleting the issue record',()=>{
 let r=fixture();r={...r,...confirmShipmentReceipts(r,[selection(r)],100)};
 const id=r.shipments![0]!.issue!.id;
 const next=confirmShipmentReceipts(r,[{...selection(r),issueNotes:''}],100);
 expect(next.shipments![0]!.issue).toMatchObject({id,notes:''});
});
