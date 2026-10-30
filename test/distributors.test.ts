import {expect,it} from 'vitest';
import {validateDistributor,snapshotDistributor,damageEvidenceNeeded} from '../shared/distributors';
import {shipmentQuantities} from '../shared/shipmentQuantities';
import {validateShipments} from '../shared/requestShipments';
import {validateDamageImage} from '../shared/shipmentEvidence';
const profile={id:'d1',name:'Example Distributor',revision:2,labelsRequired:true,imagesRequired:true,replacementBasis:'units' as const,instructions:'Send labels only.'};
it('validates named distributors and explicit requirements',()=>{
 expect(validateDistributor(profile)).toBe('');expect(validateDistributor({...profile,name:''})).toBeTruthy();expect(validateDistributor({...profile,labelsRequired:'yes' as never})).toBeTruthy();
});
it('snapshots profiles without inventing defaults for legacy suppliers',()=>{
 expect(snapshotDistributor(profile)).toMatchObject({distributorId:'d1',distributorName:profile.name,revision:2,labelsRequired:true});
 expect(snapshotDistributor(undefined)).toBeUndefined();const policy=snapshotDistributor(profile)!;profile.instructions='Changed';expect(policy.instructions).toBe('Send labels only.');
 expect(damageEvidenceNeeded({issue:{type:'missing'}} as never)).toBe(false);expect(damageEvidenceNeeded({damagedUnits:2} as never)).toBe(true);
});
it('counts planned loose-unit replacements and enforces whole-case policies',()=>{
 const row={eta:'2026-11-01',casesShipped:0,looseUnitsShipped:2,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A'],replacementBasis:'units' as const};
 expect(shipmentQuantities({},row)).toMatchObject({expectedUnits:2,missingUnits:2});expect(validateShipments([row],true)).toBe('');
 expect(validateShipments([{...row,replacementBasis:'cases'}],true)).toBeTruthy();
});
it('accepts only supported image content within the size limit',()=>{
 expect(validateDamageImage(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png')).toBe('image/png');
 expect(()=>validateDamageImage(new TextEncoder().encode('<script>bad</script>'),'image/png')).toThrow();
 expect(()=>validateDamageImage(new Uint8Array(10*1024*1024+1),'image/png')).toThrow();
});
it('persists distributor revisions and snapshots dispatched policies while preserving evidence inventory',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');const {saveDistributor}=await import('../server/utils/distributors');
 const {ensureSubmittedRequest,updateSubmittedRequest,persistShipmentEvidence,updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const {db}=surplusDb();const first=await saveDistributor(db,{...profile,id:undefined,name:'Test Distributor'},200);
 const revised=await saveDistributor(db,{...first,labelsRequired:false},200);expect(revised.revision).toBe(2);
 await expect(saveDistributor(db,{...first,name:'Stale'},200)).rejects.toMatchObject({statusCode:409});
 const original=await ensureSubmittedRequest(db,{id:9990,submissionId:'distributor-snapshot',agencyId:10,agencyMemberId:100,status:'in_progress',participantName:'Example',productName:'Example',approvedCases:3,shipments:[]});
 const shipped=await updateSubmittedRequest(db,original,{shipments:[{distributorId:first.id,eta:'2026-11-01',casesShipped:3,unitsPerCase:6,carrier:'ups',trackingNumbers:['A']}]},false,0);
 expect(shipped.shipments![0]!.distributorPolicy?.labelsRequired).toBe(false);
 await saveDistributor(db,{...revised,labelsRequired:true},200);
 const saved=await updateSubmittedRequest(db,shipped,{shipments:shipped.shipments});expect(saved.shipments![0]!.distributorPolicy?.labelsRequired).toBe(false);
 const reported=await updateSubmittedShipmentIssue(db,saved,{index:0,key:shipmentReceiptKey(saved.shipments![0]!),expectedIssue:shipmentIssueKey(saved.shipments![0]!),action:'report',type:'damaged',notes:'Two cans damaged'},100);
 const evidenced=await persistShipmentEvidence(db,reported,0,shipmentIssueKey(reported.shipments![0]!),{labelsSent:{date:'2026-10-29',reference:'L1',recordedAt:'2026-10-29',recordedBy:100}});
 expect(shipmentQuantities(evidenced,evidenced.shipments![0]!)).toEqual(shipmentQuantities(reported,reported.shipments![0]!));
 await expect(persistShipmentEvidence(db,evidenced,0,shipmentIssueKey(reported.shipments![0]!),{})).rejects.toMatchObject({statusCode:409});
});
it('retains individual replacement amounts and original good units when policies change',async()=>{
 const {applyShipmentCaseCommand,shipmentCaseKey,caseBalance}=await import('../shared/shipmentCaseTracking');
 const {shipmentReceiptKey,confirmShipmentReceipts}=await import('../shared/shipmentReceipts');
 const request={id:9991,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',approvedCases:1,shipments:[{eta:'2026-11-01',etaSentAt:'2026-10-29',casesShipped:1,unitsPerCase:6,carrier:'ups',trackingNumbers:['A'],distributorPolicy:snapshotDistributor(profile),issue:{id:'issue-1',type:'damaged',notes:'Damaged',reportedAt:'2026-10-29',reportedBy:100}}]} as import('../shared/domain').RequestRecord;
 const received={...request,...confirmShipmentReceipts(request,[{index:0,key:shipmentReceiptKey(request.shipments![0]!),receivedCases:1,damagedLooseUnits:2}],100)};
 const replaced={...received,...applyShipmentCaseCommand(received,{index:0,key:shipmentReceiptKey(received.shipments![0]!),expectedCases:shipmentCaseKey(received.shipments![0]!),expectedReplacements:0,action:'replacement'},200)};
 expect(replaced.shipments![1]).toMatchObject({replacementIssueId:'issue-1',replacementBasis:'units'});
 replaced.shipments![1]={...replaced.shipments![1]!,eta:'2026-11-02',etaSentAt:'2026-10-29',casesShipped:0,looseUnitsShipped:2};
 const complete={...replaced,...confirmShipmentReceipts(replaced,[{index:1,key:shipmentReceiptKey(replaced.shipments![1]!),receivedCases:0,receivedLooseUnits:2}],100)};
 expect(caseBalance(complete).retained).toBeCloseTo(1);expect(caseBalance(complete).excess).toBe(0);
 const whole={...replaced,shipments:replaced.shipments!.map((r,i)=>i===1?{...r,casesShipped:1,looseUnitsShipped:0}:r)};
 const over={...whole,...confirmShipmentReceipts(whole,[{index:1,key:shipmentReceiptKey(whole.shipments![1]!),receivedCases:1}],100)};
 expect(caseBalance(over).excess).toBeCloseTo(4/6);
});
it('keeps audited overrides when an undispatched shipment is saved and sent',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');const {saveDistributor}=await import('../server/utils/distributors');const {ensureSubmittedRequest,updateSubmittedRequest,updateSubmittedShipmentPolicy}=await import('../server/utils/submittedRequests');const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {db}=surplusDb();const distributor=await saveDistributor(db,{...profile,id:undefined,name:'Override Distributor'},200);
 const original=await ensureSubmittedRequest(db,{id:9987,submissionId:'override-dispatch',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
 const prepared=await updateSubmittedRequest(db,original,{shipments:[{distributorId:distributor.id,eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups',trackingNumbers:['A']}]});
 const row=prepared.shipments![0]!;const exception=await updateSubmittedShipmentPolicy(db,prepared,{index:0,key:shipmentReceiptKey(row),expectedPolicy:JSON.stringify(row.distributorPolicy),policy:{...row.distributorPolicy!,labelsRequired:false},reason:'Distributor waived labels'},200);
 const sent=await updateSubmittedRequest(db,exception,{shipments:exception.shipments},false,0);expect(sent.shipments![0]!.distributorPolicy?.labelsRequired).toBe(false);expect(sent.shipments![0]!.policyHistory).toHaveLength(1);
});
it('protects existing damage evidence from a second report and freezes known historical packaging',async()=>{
 const {applyShipmentIssue,shipmentIssueKey}=await import('../shared/shipmentIssues');const {shipmentReceiptKey,preserveShipmentReceipts}=await import('../shared/shipmentReceipts');
 const row={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['A'],receivedCases:1,issue:{type:'damaged' as const,notes:'Existing',reportedAt:'2026-10-29',reportedBy:100,labelsSent:{date:'2026-10-29',reference:'L1',recordedAt:'2026-10-29',recordedBy:100}}};const request={id:9986,agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',shipments:[row]} as import('../shared/domain').RequestRecord;
 expect(()=>applyShipmentIssue(request,{index:0,key:shipmentReceiptKey(row),expectedIssue:shipmentIssueKey(row),action:'report',type:'damaged'},100)).toThrow();
 expect(()=>preserveShipmentReceipts(request,[{...row,unitsPerCase:12}])).toThrow();
});
