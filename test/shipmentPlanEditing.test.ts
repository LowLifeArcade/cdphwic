import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {saveDistributor} from '../server/utils/distributors';
import {ensureSubmittedRequest,updateSubmittedRequest} from '../server/utils/submittedRequests';
it('saves every editable sent-shipment field, including distributor and its requirements',async()=>{
 const {db}=surplusDb();const policy={labelsRequired:false,imagesRequired:true,replacementBasis:'units' as const,instructions:'Image required'};
 const first=await saveDistributor(db,{...policy,name:'First'},200);const second=await saveDistributor(db,{...policy,name:'Second',labelsRequired:true},200);
 const base=await ensureSubmittedRequest(db,{id:9960,submissionId:'edit-all-shipment',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
 const sent=await updateSubmittedRequest(db,base,{shipments:[{distributorId:first.id,unitsPerCase:6,eta:'2026-11-01',casesShipped:1,carrier:'ups',trackingNumbers:['A']}]},false,0);
 const saved=await updateSubmittedRequest(db,sent,{shipments:[{...sent.shipments![0]!,distributorId:second.id,unitsPerCase:12,eta:'2026-11-04',casesShipped:2,carrier:'fedex',trackingNumbers:['B']}]},false,0,200);
 expect(saved.shipments![0]).toMatchObject({distributorId:second.id,supplier:'Second',unitsPerCase:12,eta:'2026-11-04',casesShipped:2,carrier:'fedex',trackingNumbers:['B'],distributorPolicy:{labelsRequired:true}});
 expect(saved.shipments![0]!.policyHistory?.at(-1)).toMatchObject({changedBy:200,policy:{distributorId:first.id}});
});
it('still protects a distributor snapshot once receipt records exist',async()=>{
 const {db}=surplusDb();const policy={labelsRequired:false,imagesRequired:true,replacementBasis:'units' as const,instructions:''};
 const first=await saveDistributor(db,{...policy,name:'Historical Distributor'},200);const second=await saveDistributor(db,{...policy,name:'Different Distributor'},200);
 const base=await ensureSubmittedRequest(db,{id:9961,submissionId:'historical-shipment-edit',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
 const sent=await updateSubmittedRequest(db,base,{shipments:[{distributorId:first.id,unitsPerCase:6,eta:'2026-11-01',casesShipped:1,carrier:'ups',trackingNumbers:['A']}]},false,0);
 const {updateSubmittedShipmentReceipt}=await import('../server/utils/submittedRequests');const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');const {receiptQuantityKey}=await import('../shared/shipmentQuantities');const row=sent.shipments![0]!;
 const received=await updateSubmittedShipmentReceipt(db,sent,[{index:0,key:shipmentReceiptKey(row),expectedReceipt:receiptQuantityKey(row),receivedCases:1}],100);
 await expect(updateSubmittedRequest(db,received,{shipments:[{...received.shipments![0]!,distributorId:second.id}]})).rejects.toMatchObject({statusCode:409});
});
it('locks legacy received snapshots even without receipt date or actual-count fields',async()=>{
 const {db}=surplusDb();const policy={labelsRequired:false,imagesRequired:true,replacementBasis:'units' as const,instructions:''};const distributor=await saveDistributor(db,{...policy,name:'Replacement Distributor'},200);
 for(const explicit of [false,true]){
 const base=await ensureSubmittedRequest(db,{id:explicit?9963:9962,submissionId:`legacy-received-lock-${explicit}`,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'complete',receivedStatus:'received',shipments:[{eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups',trackingNumbers:['A'],...(explicit?{receiptConfirmed:true}:{})}]});
 await expect(updateSubmittedRequest(db,base,{shipments:[{...base.shipments![0]!,distributorId:distributor.id}]})).rejects.toMatchObject({statusCode:409});
 }
});
