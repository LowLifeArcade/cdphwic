import {receiptQuantityKey} from '../shared/shipmentQuantities';
import {it,expect,vi} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {persistSurplusSubmission} from '../server/utils/surplusReports';
import {getDemoUser} from '../server/utils/session';
import {submittedRequest} from '../server/utils/submittedRequests';
import type {RequestRecord} from '../shared/domain';
vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));
vi.stubGlobal('defineEventHandler',(fn:unknown)=>fn);
vi.stubGlobal('getRouterParam',()=> '1000998');
vi.stubGlobal('getHeader',(event:any)=>event.identity);
vi.stubGlobal('readBody',(event:any)=>event.body);
vi.stubGlobal('createError',(details:any)=>Object.assign(new Error(details.statusMessage),details));
const {default:put}=await import('../server/api/requests/[id].put');
const {default:get}=await import('../server/api/requests/[id].get');
async function fixture(){
 const {db}=surplusDb();
 const record={id:1000998,submissionId:'route-edit-test',agencyId:10,agencyMemberId:100,status:'unopened',participantName:'Synthetic Route'} as RequestRecord;
 await persistSurplusSubmission(db,record.submissionId!,record,getDemoUser('agency'));
 return {context:{cloudflare:{env:{CDPHWIC:db}}},identity:'agency',body:{},db};
}
it('rejects partial agency form edits without changing the saved form',async()=>{
 const event=await fixture();
 event.body={participantName:'Bypass'};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 expect((await submittedRequest(event.db,1000998,getDemoUser('agency')))?.participantName).toBe('Synthetic Route');
});
it('allows operational notes with an unchanged empty surplus list',async()=>{
 const event=await fixture();
 event.body={repNotes:'Delivery note',surplusItems:[]};
 const result=await put(event as never);
 expect(result.request.repNotes).toBe('Delivery note');
});
it('locks a submission when a reviewer reads its detail endpoint',async()=>{
 const event=await fixture();
 event.identity='internal';
 const result=await get(event as never);
 expect(result.request.status).toBe('opened');
 expect(result.request.openedAt).toBeTruthy();
});

it('requires selected shipped deliveries and prevents the old whole-request confirmation bypass',async()=>{
 const event=await fixture();
 event.body={receivedStatus:'received',status:'complete'};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
});
it('authenticates receipt selections and persists partial confirmation through the route',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const saved=await updateSubmittedRequest(event.db,previous,{status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']},{eta:'2026-11-03',casesShipped:3,carrier:'fedex',trackingNumbers:['B']}]});
 event.body={confirmShipmentReceipts:[{index:0,key:shipmentReceiptKey(saved.shipments![0]!),receivedCases:(saved.shipments![0]!).casesShipped,expectedReceipt:receiptQuantityKey(saved.shipments![0]!)}]};
 event.identity='internal';
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='agency';
 const result=await put(event as never);
 expect(result.request.status).toBe('shipped');
 expect(result.request.shipments![0]!.receivedBy).toBe(getDemoUser('agency').id);
 expect(result.request.shipments![1]!.receivedAt).toBeUndefined();
});
it('allows only Local Agency or Admin to report a shipment issue and preserves the other shipment',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const saved=await updateSubmittedRequest(event.db,previous,{status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']},{eta:'2026-11-03',casesShipped:3,carrier:'fedex',trackingNumbers:['B']}]});
 event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(saved.shipments![0]!),expectedIssue:shipmentIssueKey(saved.shipments![0]!),action:'report',type:'missing',notes:'Not delivered'}};
 event.identity='internal';await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='agency';const result=await put(event as never);
 expect(result.request.shipments![0]!.issue).toMatchObject({type:'missing',notes:'Not delivered',reportedBy:getDemoUser('agency').id});
 expect(result.request.shipments![1]!.issue).toBeUndefined();expect(result.request.status).toBe('missing');
 const stored=await submittedRequest(event.db,1000998,getDemoUser('agency'));
 expect(stored!.shipments![0]!.issue).toEqual(result.request.shipments![0]!.issue);
});
it('supports CDPH/WIC responses and an agency false-alarm resolution with receipt confirmation',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest,updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey,confirmShipmentReceipts}=await import('../shared/shipmentReceipts');
 const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const saved=await updateSubmittedRequest(event.db,previous,{status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']},{eta:'2026-11-03',casesShipped:3,carrier:'fedex',trackingNumbers:['B']}]});
 const reported=await updateSubmittedShipmentIssue(event.db,saved,{index:0,key:shipmentReceiptKey(saved.shipments![0]!),expectedIssue:shipmentIssueKey(saved.shipments![0]!),action:'report',type:'missing',notes:'Not found'},getDemoUser('agency').id);
 const withReceipt=await updateSubmittedRequest(event.db,reported,confirmShipmentReceipts(reported,[{index:1,key:shipmentReceiptKey(reported.shipments![1]!),receivedCases:(reported.shipments![1]!).casesShipped,expectedReceipt:receiptQuantityKey(reported.shipments![1]!)}],getDemoUser('agency').id));
 event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(withReceipt.shipments![0]!),expectedIssue:shipmentIssueKey(withReceipt.shipments![0]!),action:'respond',notes:'Please check your receiving area.'}};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='internal';const response=await put(event as never);
 expect(response.request.shipments![0]!.issue!.responses![0]!.createdBy).toBe(getDemoUser('internal').id);
 expect(response.request.status).toBe('missing');
 event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(response.request.shipments![0]!),expectedIssue:shipmentIssueKey(response.request.shipments![0]!),receivedCases:2,expectedReceipt:receiptQuantityKey(response.request.shipments![0]!),action:'resolve-received'}};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='agency';const resolved=await put(event as never);
 expect(resolved.request.status).toBe('complete');expect(resolved.request.receivedStatus).toBe('received');
 expect(resolved.request.shipments![0]!.receivedBy).toBe(getDemoUser('agency').id);
 expect(resolved.request.shipments![0]!.issue!.responses![0]!.notes).toBe('Please check your receiving area.');
});
for (const identity of ['agency','internal','admin'] as const) {
 it(`lets ${identity} update and reopen a resolved shipment issue`,async()=>{
  const event=await fixture();
  const {updateSubmittedRequest,updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');
  const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
  const {shipmentIssueKey}=await import('../shared/shipmentIssues');
  const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
  const saved=await updateSubmittedRequest(event.db,previous,{status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']}]});
  const reported=await updateSubmittedShipmentIssue(event.db,saved,{index:0,key:shipmentReceiptKey(saved.shipments![0]!),expectedIssue:shipmentIssueKey(saved.shipments![0]!),action:'report',type:'missing',notes:'Original report'},100);
  const resolved=await updateSubmittedShipmentIssue(event.db,reported,{index:0,key:shipmentReceiptKey(reported.shipments![0]!),expectedIssue:shipmentIssueKey(reported.shipments![0]!),receivedCases:2,expectedReceipt:receiptQuantityKey(reported.shipments![0]!),action:'resolve-received'},100);
  event.identity=identity;
  event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(resolved.shipments![0]!),expectedIssue:shipmentIssueKey(resolved.shipments![0]!),action:'update',type:'missing',notes:'Corrected report'}};
  const edited=await put(event as never);
  expect(edited.request.status).toBe('complete');expect(edited.request.shipments![0]!.issue!.resolvedAt).toBeTruthy();
  event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(edited.request.shipments![0]!),expectedIssue:shipmentIssueKey(edited.request.shipments![0]!),action:'reopen'}};
  const reopened=await put(event as never);
  expect(reopened.request.status).toBe('missing');expect(reopened.request.shipments![0]!.issue!.resolvedAt).toBeUndefined();
  expect(reopened.request.shipments![0]!.issue!.reopenedBy).toBe(getDemoUser(identity).id);
  expect(reopened.request.shipments![0]!.receivedAt).toBe(resolved.shipments![0]!.receivedAt);
 });
}
it('restricts replacements to reviewers, freezes approval and rejects stale shipping saves',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest,updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const {shipmentCaseKey}=await import('../shared/shipmentCaseTracking');
 const original=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const saved=await updateSubmittedRequest(event.db,original,{approved:true,approvedCases:10,status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:10,carrier:'ups',trackingNumbers:['A'],etaSentAt:'2026-10-29T00:00:00Z'}]});
 const reported=await updateSubmittedShipmentIssue(event.db,saved,{index:0,key:shipmentReceiptKey(saved.shipments![0]!),expectedIssue:shipmentIssueKey(saved.shipments![0]!),action:'report',type:'missing',notes:'Lost'},100);
 event.body={shipmentCases:{index:0,key:shipmentReceiptKey(reported.shipments![0]!),expectedCases:shipmentCaseKey(reported.shipments![0]!),expectedReplacements:0,action:'replacement'}};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='internal';const replaced=await put(event as never);
 expect(replaced.request.shipments![1]!.replacementFor).toBe(0);expect(replaced.request.originalApprovedCases).toBe(10);
 event.body={shipments:reported.shipments,revision:reported.revision};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 event.body={approvedCases:100,originalApprovedCases:100};const amended=await put(event as never);
 expect(amended.request.originalApprovedCases).toBe(10);
});
it('prevents Local Agency from changing approval limits or shipment plans through a generic update',async()=>{
 const event=await fixture();event.body={approvedCases:999};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.body={shipments:[],revision:0};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
});
it('permits agency completion values after an original closes as replaced without recording a false receipt',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest,updateSubmittedShipmentCases}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {shipmentCaseKey}=await import('../shared/shipmentCaseTracking');
 const original=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const prepared:RequestRecord={...original,approvedCases:10,status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:10,carrier:'ups',trackingNumbers:['A'],issue:{type:'missing',notes:'Lost',reportedAt:'2026-11-02T00:00:00Z',reportedBy:100}},{eta:'2026-11-03',casesShipped:10,carrier:'ups',trackingNumbers:['B'],receivedAt:'2026-11-03T00:00:00Z',replacementFor:0}]};
 await event.db.prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?').bind(JSON.stringify(prepared),prepared.submissionId).run();
 const closed=await updateSubmittedShipmentCases(event.db,prepared,{index:0,key:shipmentReceiptKey(prepared.shipments![0]!),expectedCases:shipmentCaseKey(prepared.shipments![0]!),action:'close-replaced',notes:'Replacement received'},200);
 expect(closed.status).toBe('complete');
 event.body={repNotes:'Replacement arrived',status:'complete',receivedStatus:'received'};
 const result=await put(event as never);
 expect(result.request.status).toBe('complete');expect(result.request.shipments![0]!.receivedAt).toBeUndefined();
});
it('allows Local Agency to delete an issue, rejects CDPH/WIC deletion, and preserves the deleted audit on later saves',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest,updateSubmittedShipmentIssue}=await import('../server/utils/submittedRequests');
 const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const {shipmentIssueKey}=await import('../shared/shipmentIssues');
 const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const shipped=await updateSubmittedRequest(event.db,previous,{status:'shipped',shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']}]});
 const reported=await updateSubmittedShipmentIssue(event.db,shipped,{index:0,key:shipmentReceiptKey(shipped.shipments![0]!),expectedIssue:shipmentIssueKey(shipped.shipments![0]!),action:'report',type:'damaged',notes:'Incorrect report'},100);
 event.body={shipmentIssue:{index:0,key:shipmentReceiptKey(reported.shipments![0]!),expectedIssue:shipmentIssueKey(reported.shipments![0]!),action:'delete'}};
 event.identity='internal';await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='agency';const removed=await put(event as never);
 expect(removed.request.shipments![0]!.issue).toBeUndefined();expect(removed.request.shipments![0]!.deletedIssues).toHaveLength(1);
 event.identity='internal';event.body={shipments:shipped.shipments,revision:removed.request.revision};const saved=await put(event as never);
 expect(saved.request.shipments![0]!.deletedIssues).toEqual(removed.request.shipments![0]!.deletedIssues);
});
it('rejects reconciliation mutations while flags are off without changing saved requests',async()=>{
 const event=await fixture();const before=await submittedRequest(event.db,1000998,getDemoUser('agency'));
 vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:false,shipmentPotentialOverDelivery:false}}));
 try{for(const action of ['returned','destroyed','received-count']){event.body={shipmentCases:{index:0,action}};await expect(put(event as never)).rejects.toMatchObject({statusCode:409,statusMessage:'Case reconciliation is currently disabled.'});}expect(await submittedRequest(event.db,1000998,getDemoUser('agency'))).toEqual(before);}finally{vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));}
});
it('requires reviewer role and current revision for private shipment draft saves',async()=>{
 const event=await fixture();
 event.body={shipmentDrafts:[{eta:'',casesShipped:0,carrier:'ups',trackingNumbers:[]}],revision:0};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='internal';event.body={...event.body,revision:999};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
});
it('treats older client Save Shipments payloads as private drafts',async()=>{
 const event=await fixture();event.identity='internal';
 event.body={shipments:[{eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups',trackingNumbers:['PRIVATE-OLD-CLIENT']}],revision:0};
 const result=await put(event as never);
 expect(result.request.shipments).toBeUndefined();
 expect(result.request.shipmentDrafts![0]!.trackingNumbers).toEqual(['PRIVATE-OLD-CLIENT']);
});
it('allows only reviewers to delete shipments and rejects stale delete commands',async()=>{
 const event=await fixture();
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const previous=(await submittedRequest(event.db,1000998,getDemoUser('agency')))!;
 const saved=await updateSubmittedRequest(event.db,previous,{shipments:[{eta:'2026-11-01',casesShipped:2,unitsPerCase:6,carrier:'ups',trackingNumbers:['DELETE-ME']}]},false,0);
 event.body={deleteShipmentIndex:0,revision:saved.revision};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='internal';event.body={deleteShipmentIndex:0,revision:0};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 event.body={deleteShipmentIndex:0,revision:saved.revision};
 const result=await put(event as never);
 expect(result.request.shipments).toEqual([]);expect(result.request.deletedShipments![0]!.deletedBy).toBe(getDemoUser('internal').id);
 expect((await submittedRequest(event.db,1000998,getDemoUser('internal')))?.shipments).toEqual([]);
});
it('uses simple receipt confirmation while quantity tracking is disabled',async()=>{
 const event=await fixture();
 const before=await submittedRequest(event.db,1000998,getDemoUser('agency'));
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const shipped=await updateSubmittedRequest(event.db,before!,{shipments:[{eta:'2026-11-01',casesShipped:5,carrier:'ups',trackingNumbers:['A'],etaSentAt:'2026-10-30'}]});
 vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentReceiptQuantities:false,shipmentQuantityTracking:false,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));
 try{
  event.body={confirmShipmentReceipts:[{index:0,receivedCases:5}]};await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
  for(const action of ['replacement','close-replaced','received-count','returned','destroyed']){event.body={shipmentCases:{index:0,action}};await expect(put(event as never)).rejects.toMatchObject({statusCode:409});}
  const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
  const {receiptQuantityKey}=await import('../shared/shipmentQuantities');
  event.body={confirmShipmentReceipt:{index:0,key:shipmentReceiptKey(shipped.shipments![0]!),expectedReceipt:receiptQuantityKey(shipped.shipments![0]!),expectedIssue:'null',damaged:false,issueNotes:''}};
  const saved=await put(event as never);expect(saved.request.shipments![0]).toMatchObject({receiptMode:'simple',receiptConfirmed:true});expect(saved.request.shipments![0]!.receivedUnits).toBeUndefined();
 }finally{vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));}
});
it('sends ETA without requiring hidden packaging fields when quantity tracking is off',async()=>{
 const event=await fixture();event.identity='internal';
 vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:false}}));
 try{
  const before=await submittedRequest(event.db,1000998,getDemoUser('agency'));
  event.body={revision:before!.revision??0,shipmentDrafts:[{eta:'2026-11-01',casesShipped:0,carrier:'ups',trackingNumbers:['SIMPLE-ETA']}],sendEtaShipmentIndex:0};
  const saved=await put(event as never);expect(saved.request.shipments![0]!.etaSentAt).toBeTruthy();
 }finally{vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));}
});
it('persists separate formula issuance values and restricts them to reviewers',async()=>{
 const event=await fixture();
 const rows=[{productName:'First',productForm:'powder',approvedCases:2,benefitIssuances:[{month:'2026-09',quantity:100}]},{productName:'Second',productForm:'ready-to-feed',approvedCases:4,benefitIssuances:[{month:'2026-09',quantity:200}]}];
 event.body={formulaAuthorizations:rows};await expect(put(event as never)).rejects.toMatchObject({statusCode:403});
 event.identity='internal';const saved=await put(event as never);expect(saved.request.formulaAuthorizations).toEqual(rows);
 const loaded=await submittedRequest(event.db,1000998,getDemoUser('agency'));expect(loaded!.formulaAuthorizations).toEqual(rows);
 event.body={formulaAuthorizations:[{...rows[1],approvedCases:-1}]};await expect(put(event as never)).rejects.toMatchObject({statusCode:400});
});
it('allows actual receipts with shipment tracking, reconciliation and overage off',async()=>{
 const event=await fixture();const before=await submittedRequest(event.db,1000998,getDemoUser('agency'));
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');const {shipmentReceiptKey}=await import('../shared/shipmentReceipts');
 const shipped=await updateSubmittedRequest(event.db,before!,{shipments:[{eta:'2026-11-01',casesShipped:5,unitsPerCase:6,carrier:'ups',trackingNumbers:['ACTUAL-RECEIPT'],etaSentAt:'2026-10-30'}]});
 vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentReceiptQuantities:true,shipmentQuantityTracking:false,shipmentCaseReconciliation:false,shipmentPotentialOverDelivery:false}}));
 try{
  event.body={confirmShipmentReceipts:[{index:0,key:shipmentReceiptKey(shipped.shipments![0]!),expectedReceipt:receiptQuantityKey(shipped.shipments![0]!),expectedIssue:'null',issueNotes:'',receivedCases:5,receivedLooseUnits:0,damagedCases:0,damagedLooseUnits:0}]};
  const saved=await put(event as never);expect(saved.request.shipments![0]).toMatchObject({receiptMode:'quantity',receivedUnits:30});
  event.body={shipmentCases:{index:0,action:'received-count'}};await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 }finally{vi.stubGlobal('useRuntimeConfig',()=>({public:{shipmentQuantityTracking:true,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true}}));}
});
it('lets reviewers save validated shipping snapshots and rejects stale or invalid edits',async()=>{
 const event=await fixture();event.identity='internal';
 event.body={revision:0,shipping:{clinicName:'Local agency',addressLine1:'123 Example Street',addressLine2:'Suite 4',city:'Example',state:'CA',postalCode:'90000',attention:'Example Contact',email:'shipping@example.test',phone:'(555) 555-0100'}};
 const saved=await put(event as never);expect(saved.request.shipping).toMatchObject({addressLine1:'123 Example Street',attention:'Example Contact'});
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 event.body={revision:saved.request.revision,shipping:{...saved.request.shipping,postalCode:'invalid'}};await expect(put(event as never)).rejects.toMatchObject({statusCode:400});
});
it('lets CDPH/WIC edit manual request shipping outside its assigned clinic address books',async()=>{
 const event=await fixture();event.identity='internal';
 await event.db.prepare("UPDATE surplus_submissions SET request_json=json_set(request_json,'$.agencyId',12) WHERE id=?").bind('route-edit-test').run();
 event.body={revision:0,shipping:{clinicName:'Local Agency',addressLine1:'123 Example Street',addressLine2:'',city:'Example',state:'CA',postalCode:'90000'}};
 const saved=await put(event as never);expect(saved.request.shipping!.addressLine1).toBe('123 Example Street');
});
