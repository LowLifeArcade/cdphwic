import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {ensureSubmittedRequest,updateSubmittedShipmentReceipt} from '../server/utils/submittedRequests';
import {shipmentReceiptKey} from '../shared/shipmentReceipts';
import {receiptQuantityKey} from '../shared/shipmentQuantities';
it('uses confirmed catalog packaging for an older receipt and saves all four corrected quantities',async()=>{
 const {db}=surplusDb();const request=await ensureSubmittedRequest(db,{id:9977,submissionId:'catalog-receipt',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',productId:302,status:'complete',receivedStatus:'received',shipments:[{eta:'2026-11-01',carrier:'ups',casesShipped:2,trackingNumbers:['A'],receivedAt:'2026-11-01',receivedCases:2}]});
 const row=request.shipments![0]!;const saved=await updateSubmittedShipmentReceipt(db,request,[{index:0,key:shipmentReceiptKey(row),expectedReceipt:receiptQuantityKey(row),catalogUnitsPerCase:6,receivedCases:1,receivedLooseUnits:4,damagedCases:1,damagedLooseUnits:1} as never],100);
 expect(saved.shipments![0]).toMatchObject({unitsPerCase:6,receivedUnits:10,damagedUnits:7});
 await expect(updateSubmittedShipmentReceipt(db,request,[{index:0,key:shipmentReceiptKey(row),expectedReceipt:receiptQuantityKey(row),catalogUnitsPerCase:12,receivedCases:1,receivedLooseUnits:1} as never],100)).rejects.toMatchObject({statusCode:409});
});
it('does not infer packaging for a request with multiple formulas',async()=>{
 const {db}=surplusDb();const request=await ensureSubmittedRequest(db,{id:9978,submissionId:'ambiguous-receipt',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',productId:302,requestedFormulas:[{},{}] as never,status:'shipped',shipments:[{eta:'2026-11-01',carrier:'ups',casesShipped:2,trackingNumbers:['A']}]});const row=request.shipments![0]!;
 await expect(updateSubmittedShipmentReceipt(db,request,[{index:0,key:shipmentReceiptKey(row),expectedReceipt:receiptQuantityKey(row),catalogUnitsPerCase:6,receivedCases:1,receivedLooseUnits:1} as never],100)).rejects.toMatchObject({statusCode:409});
});
it('uses catalog packaging when resolving an issue and preserves the original CAS record',async()=>{
 const {updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const {db}=surplusDb();const request=await ensureSubmittedRequest(db,{id:9979,submissionId:'resolve-catalog',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',productId:302,status:'missing',receivedStatus:'missing',shipments:[{eta:'2026-11-01',carrier:'ups',casesShipped:1,trackingNumbers:['A'],issue:{type:'missing',notes:'Found it',reportedAt:'2026-10-29',reportedBy:100}}]});const row=request.shipments![0]!;
 const saved=await updateSubmittedShipmentIssue(db,request,{index:0,key:shipmentReceiptKey(row),expectedIssue:shipmentIssueKey(row),expectedReceipt:receiptQuantityKey(row),action:'resolve-received',catalogUnitsPerCase:6,receivedCases:1,damagedCases:0,damagedLooseUnits:0},100);
 expect(saved.shipments![0]).toMatchObject({unitsPerCase:6,receivedUnits:6});expect(saved.status).toBe('complete');
});
