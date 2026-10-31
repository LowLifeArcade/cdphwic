import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {ensureSurplusLot,executeSurplusCommand} from '../server/utils/surplusStore';
import {getDemoUser} from '../server/utils/session';
import {ensureSubmittedRequest,updateSubmittedShipmentReceipt} from '../server/utils/submittedRequests';
import {authorizeRequestTransfer,shipRequestTransfer,saveRequestTransferEta} from '../server/utils/requestTransfers';
import {shipmentReceiptKey} from '../shared/shipmentReceipts';
import {receiptQuantityKey} from '../shared/shipmentQuantities';
async function fixture(){
 const {db,sqlite}=surplusDb();const admin=getDemoUser('admin');
 const lot=await ensureSurplusLot(db,11,{formulaName:'Nutramigen LGG',form:'powder',flavor:'',expirationDate:'2027-06-01'});
 await executeSurplusCommand(db,admin,{kind:'reconcile',operationId:crypto.randomUUID(),lotId:lot.id,quantity:48,expectedVersion:0,reason:'Verified count',confirmerName:'Example'});
 const request=await ensureSubmittedRequest(db,{id:9988,submissionId:'transfer-test',agencyId:10,agencyMemberId:100,participantName:'Private participant',productName:'Nutramigen LGG',productForm:'powder',status:'in_progress'});
 const row={shipmentSource:'agency' as const,sourceAgencyId:11,sourceLotId:lot.id,unitsPerCase:6,casesShipped:2,eta:'',carrier:'ups' as const,trackingNumbers:[]};
 return {db,sqlite,admin,lot,request,row};
}
async function dispatchTransfer(db:D1Database,id:string,sender:ReturnType<typeof getDemoUser>,input:{eta:string;carrier:any;trackingNumbers:string[]}){
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=9988").first<string>('request_json');
 await saveRequestTransferEta(db,id,getDemoUser('admin'),input,JSON.parse(stored!).revision??0);
 return shipRequestTransfer(db,id,sender);
}
it('reserves, ships and confirms against one request without creating destination surplus',async()=>{
 const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:12,on_hand:48});
 const id=reserved.shipments![0]!.transferId!;
 const sender={...getDemoUser('agency'),agencyId:11};
 const shipped=await dispatchTransfer(f.db,id,sender,{eta:'2026-11-10',carrier:'ups',trackingNumbers:['TRANSFER-A']});
 expect(shipped.request.shipments![0]!.etaSentAt).toBeTruthy();
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0,on_hand:36});
 const row=shipped.request.shipments![0]!;
 const received=await updateSubmittedShipmentReceipt(f.db,shipped.request,[{index:0,key:shipmentReceiptKey(row),expectedReceipt:receiptQuantityKey(row),receivedCases:1,expectedIssue:'null',issueNotes:'One case missing'}],100);
 expect(f.sqlite.prepare('SELECT received_units,status FROM surplus_transfers WHERE id=?').get(id)).toMatchObject({received_units:6,status:'shipped'});
 expect(f.sqlite.prepare('SELECT count(*) AS n FROM surplus_lots WHERE agency_id=10').get()).toMatchObject({n:0});
 const corrected=received.shipments![0]!;
 await updateSubmittedShipmentReceipt(f.db,received,[{index:0,key:shipmentReceiptKey(corrected),expectedReceipt:receiptQuantityKey(corrected),receivedCases:2}],100);
 expect(f.sqlite.prepare('SELECT received_units,status FROM surplus_transfers WHERE id=?').get(id)).toMatchObject({received_units:12,status:'received'});
 await expect(dispatchTransfer(f.db,id,sender,{eta:'2026-11-10',carrier:'ups',trackingNumbers:['TRANSFER-A']})).rejects.toThrow();
});
it('rejects source, variant, expiry and permission mismatches without reserving stock',async()=>{
 const f=await fixture();
 await expect(authorizeRequestTransfer(f.db,f.request,[f.row],0,getDemoUser('agency'))).rejects.toMatchObject({statusCode:403});
 await expect(authorizeRequestTransfer(f.db,f.request,[{...f.row,sourceAgencyId:10}],0,f.admin)).rejects.toThrow();
 await expect(authorizeRequestTransfer(f.db,{...f.request,productName:'Different formula'},[f.row],0,f.admin)).rejects.toThrow();
 expect(f.sqlite.prepare('SELECT reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0});
});
it('rolls inventory back when the request revision changed',async()=>{
 const f=await fixture();
 f.sqlite.prepare("UPDATE surplus_submissions SET request_json=json_set(request_json,'$.revision',99) WHERE id=?").run(f.request.submissionId!);
 await expect(authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin)).rejects.toThrow();
 expect(f.sqlite.prepare('SELECT reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0});
 expect(f.sqlite.prepare('SELECT count(*) AS n FROM surplus_transfers').get()).toMatchObject({n:0});
});
it('releases only an unshipped reservation when the linked shipment is deleted',async()=>{
 const {deleteSubmittedShipment}=await import('../server/utils/submittedRequests');const f=await fixture();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;
 await deleteSubmittedShipment(f.db,reserved,0,f.admin.id);
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0,on_hand:48});
 expect(f.sqlite.prepare('SELECT status FROM surplus_transfers WHERE id=?').get(id)).toMatchObject({status:'cancelled'});
});
it('protects authorized quantities, source permissions, and legacy command paths',async()=>{
 const {updateSubmittedRequest,deleteSubmittedShipment}=await import('../server/utils/submittedRequests');const f=await fixture();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;
 await expect(updateSubmittedRequest(f.db,reserved,{shipmentDrafts:[{...reserved.shipments![0]!,casesShipped:1}]})).rejects.toThrow();
 await expect(shipRequestTransfer(f.db,id,{...getDemoUser('agency'),agencyId:12})).rejects.toMatchObject({statusCode:404});
 await expect(executeSurplusCommand(f.db,f.admin,{kind:'ship',operationId:crypto.randomUUID(),lotId:f.lot.id,transferId:id})).rejects.toThrow();
 const shipped=await dispatchTransfer(f.db,id,{...getDemoUser('agency'),agencyId:11},{eta:'2026-11-10',carrier:'agency',trackingNumbers:['Local delivery']});
 await expect(deleteSubmittedShipment(f.db,shipped.request,0,f.admin.id)).rejects.toThrow();
});
it('rejects expired or over-allocated lots and handles competing reservations atomically',async()=>{
 const f=await fixture();
 await expect(authorizeRequestTransfer(f.db,f.request,[{...f.row,casesShipped:9}],0,f.admin)).rejects.toThrow();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[{...f.row,casesShipped:6}],0,f.admin);
 const other=await ensureSubmittedRequest(f.db,{...f.request,id:9989,submissionId:'other-transfer'});
 await expect(authorizeRequestTransfer(f.db,other,[{...f.row,casesShipped:3}],0,f.admin)).rejects.toThrow();
 expect(f.sqlite.prepare('SELECT reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:36});
 f.sqlite.prepare("UPDATE surplus_lots SET expiration_date='2000-01-01' WHERE id=?").run(f.lot.id);
 await expect(dispatchTransfer(f.db,reserved.shipments![0]!.transferId!,{...getDemoUser('agency'),agencyId:11},{eta:'2026-11-10',carrier:'ups',trackingNumbers:['X']})).rejects.toThrow();
 expect(f.sqlite.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({on_hand:48,reserved:36});
});
it('preserves legacy dispatched logistics when explicit sent flags are absent',async()=>{
 const f=await fixture();
 const legacy={...f.request,status:'shipped' as const,shipments:[{eta:'2026-11-02',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['LEGACY-SENT']}]};
 await f.db.prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?').bind(JSON.stringify(legacy),legacy.submissionId).run();
 await expect(authorizeRequestTransfer(f.db,legacy,[f.row],0,f.admin)).rejects.toThrow('unsent');
 expect(f.sqlite.prepare('SELECT reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0});
 expect(legacy.shipments[0]!.trackingNumbers).toEqual(['LEGACY-SENT']);
});
it('does not replace zero-count receipt or disposition history with a reservation',async()=>{
 const f=await fixture();
 for(const history of [{receivedUnits:0},{receiptCountHistory:[{cases:0,notes:'Counted',recordedAt:'2026-10-30',recordedBy:100}]},{dispositions:[{kind:'destroyed' as const,cases:0,notes:'Documented',recordedAt:'2026-10-30',recordedBy:100}]}]){
 const historical={...f.request,shipments:[{...f.row,shipmentSource:'distributor' as const,...history}]};
 await f.db.prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?').bind(JSON.stringify(historical),historical.submissionId).run();
 await expect(authorizeRequestTransfer(f.db,historical,[f.row],0,f.admin)).rejects.toThrow();
 }
 expect(f.sqlite.prepare('SELECT reserved FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0});
});
it('keeps legacy receipts confirmed while a newly reserved transfer remains unreceived',async()=>{
 const {shipmentReceived}=await import('../shared/shipmentReceipts');const f=await fixture();
 const old={eta:'2026-10-20',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['OLD-RECEIVED']};
 const previous={...f.request,status:'complete' as const,receivedStatus:'received' as const,shipments:[old]};
 await f.db.prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?').bind(JSON.stringify(previous),previous.submissionId).run();
 const reserved=await authorizeRequestTransfer(f.db,previous,[old,f.row],1,f.admin);
 expect(shipmentReceived(reserved,reserved.shipments![0]!)).toBe(true);
 expect(shipmentReceived(reserved,reserved.shipments![1]!)).toBe(false);
 expect(reserved.status).toBe('in_progress');
});
it('authorizes only the selected transfer without publishing other shipment drafts',async()=>{
 const f=await fixture();
 const old={eta:'2026-11-01',casesShipped:1,unitsPerCase:6,carrier:'ups' as const,trackingNumbers:['PUBLISHED'],etaSentAt:'2026-10-30'};
 const previous={...f.request,status:'shipped' as const,shipments:[old]};
 await f.db.prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?').bind(JSON.stringify(previous),previous.submissionId).run();
 const reserved=await authorizeRequestTransfer(f.db,previous,[{...old,eta:'2026-11-09',trackingNumbers:['PRIVATE-DRAFT']},f.row],1,f.admin);
 expect(reserved.shipments![0]).toMatchObject({eta:'2026-11-01',trackingNumbers:['PUBLISHED']});
 expect(reserved.shipmentDrafts![0]).toMatchObject({eta:'2026-11-09',trackingNumbers:['PRIVATE-DRAFT']});
});
it('confirms a transfer without inferred quantities and preserves its first receipt date on edits',async()=>{
 const {updateSubmittedSimpleShipmentReceipt}=await import('../server/utils/submittedRequests');
 const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;
 const shipped=await dispatchTransfer(f.db,id,{...getDemoUser('agency'),agencyId:11},{eta:'2026-11-10',carrier:'agency',trackingNumbers:['Local delivery']});
 const command=(request:typeof f.request)=>({index:0,key:shipmentReceiptKey(request.shipments![0]!),expectedReceipt:receiptQuantityKey(request.shipments![0]!),expectedIssue:JSON.stringify(request.shipments![0]!.issue??null),damaged:false,issueNotes:''});
 const received=await updateSubmittedSimpleShipmentReceipt(f.db,shipped.request,command(shipped.request),100);
 expect(f.sqlite.prepare('SELECT received_units,damaged_units,status FROM surplus_transfers WHERE id=?').get(id)).toMatchObject({received_units:null,damaged_units:null,status:'received'});
 f.sqlite.prepare('UPDATE surplus_transfers SET received_date=? WHERE id=?').run('2026-10-01',id);
 await updateSubmittedSimpleShipmentReceipt(f.db,received,command(received),100);
 expect(f.sqlite.prepare('SELECT received_date FROM surplus_transfers WHERE id=?').get(id)).toMatchObject({received_date:'2026-10-01'});
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0,on_hand:36});
});
it('keeps reserved transfer destinations in sync with Shipping edits and preserves dispatched destinations',async()=>{
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');const f=await fixture();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;
 const shipping={clinicName:'Agency',addressLine1:'123 Example Lane',addressLine2:'',city:'Example',state:'CA',postalCode:'90000'};
 await updateSubmittedRequest(f.db,reserved,{shipping});
 expect(JSON.parse((f.sqlite.prepare('SELECT destination_shipping FROM surplus_transfers WHERE id=?').get(id) as {destination_shipping:string}).destination_shipping)).toEqual(shipping);
 const shipped=await dispatchTransfer(f.db,id,{...getDemoUser('agency'),agencyId:11},{eta:'2026-11-10',carrier:'agency',trackingNumbers:['Local delivery']});
 await updateSubmittedRequest(f.db,shipped.request,{shipping:{...shipping,addressLine1:'456 New Lane'}});
 expect(JSON.parse((f.sqlite.prepare('SELECT destination_shipping FROM surplus_transfers WHERE id=?').get(id) as {destination_shipping:string}).destination_shipping)).toEqual(shipping);
});
it('notifies only the sending agency of a pending linked transfer and stops after shipment',async()=>{
 const {listSurplusNotices}=await import('../server/utils/surplusNotices');const f=await fixture();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;
 const sender={...getDemoUser('agency'),id:111,agencyId:11};
 expect((await listSurplusNotices(f.db,sender)).some(n=>n.kind==='transfer')).toBe(false);
 await saveRequestTransferEta(f.db,id,f.admin,{eta:'2026-11-10',carrier:'agency',trackingNumbers:['DELIVERY']},reserved.revision!);
 const pending=(await listSurplusNotices(f.db,sender)).filter(n=>n.kind==='transfer');
 expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({id:`transfer:${id}`,title:'Transfer Requested - Product Ready to Ship',transfer_id:id,quantity:12,is_read:0});
 expect((await listSurplusNotices(f.db,getDemoUser('agency'))).some(n=>n.id===`transfer:${id}`)).toBe(false);
 await f.db.prepare('INSERT INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)').bind(`transfer:${id}`,sender.id).run();
 expect((await listSurplusNotices(f.db,sender)).find(n=>n.id===`transfer:${id}`)?.is_read).toBe(1);
 await dispatchTransfer(f.db,id,sender,{eta:'2026-11-10',carrier:'agency',trackingNumbers:['DELIVERY']});
 expect((await listSurplusNotices(f.db,sender)).some(n=>n.id===`transfer:${id}`)).toBe(false);
});
it('reserves an exact unit quantity including loose units',async()=>{
 const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[{...f.row,unitsToTransfer:13,casesShipped:0}],0,f.admin);
 expect(reserved.shipments![0]).toMatchObject({transferQuantity:13,casesShipped:2,looseUnitsShipped:1});
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:13,on_hand:48});
});
it('requires CDPH/WIC logistics before sender confirmation without deducting stock at ETA entry',async()=>{
 const {saveRequestTransferEta}=await import('../server/utils/requestTransfers');const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);const id=reserved.shipments![0]!.transferId!;const sender={...getDemoUser('agency'),agencyId:11};
 await expect(shipRequestTransfer(f.db,id,sender)).rejects.toThrow();
 await expect(saveRequestTransferEta(f.db,id,sender,{eta:'2026-11-10',carrier:'ups',trackingNumbers:['STAFF-TRACKING']},reserved.revision!)).rejects.toMatchObject({statusCode:403});
 const planned=await saveRequestTransferEta(f.db,id,f.admin,{eta:'2026-11-10',carrier:'ups',trackingNumbers:[' STAFF-TRACKING ','']},reserved.revision!);
 expect(planned.shipments![0]!.etaSentAt).toBeUndefined();expect(planned.shipments![0]!.transferEtaSentAt).toBeTruthy();
 const {shipmentDispatched,canConfirmShipment}=await import('../shared/shipmentReceipts');expect(shipmentDispatched(planned,planned.shipments![0]!)).toBe(false);expect(canConfirmShipment(planned,planned.shipments![0]!)).toBe(false);
 await expect(saveRequestTransferEta(f.db,id,f.admin,{eta:'2026-11-11',carrier:'ups',trackingNumbers:['STALE']},reserved.revision!)).rejects.toMatchObject({statusCode:409});
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:12,on_hand:48});
 await expect(shipRequestTransfer(f.db,id,f.admin)).rejects.toMatchObject({statusCode:403});
 const shipped=await shipRequestTransfer(f.db,id,sender);expect(shipped.request.shipments![0]).toMatchObject({trackingNumbers:['STAFF-TRACKING'],dispatched:true});
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:0,on_hand:36});
});
it('fixes local agency transfer carrier to GSO at reservation and ETA publication',async()=>{
 const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[{...f.row,carrier:'ups'}],0,f.admin);
 expect(reserved.shipments![0]!.carrier).toBe('gso');
 const planned=await saveRequestTransferEta(f.db,reserved.shipments![0]!.transferId!,f.admin,{eta:'2026-11-10',carrier:'ups',trackingNumbers:['GSO-TRACKING']},reserved.revision!);
 expect(planned.shipments![0]!.carrier).toBe('gso');
 expect(f.sqlite.prepare('SELECT carrier FROM surplus_transfers WHERE id=?').get(reserved.shipments![0]!.transferId!)).toMatchObject({carrier:'gso'});
});
it('retains transfer ETA drafts without publishing them or changing the reserved quantity',async()=>{
 const {updateSubmittedRequest}=await import('../server/utils/submittedRequests');const f=await fixture();
 const reserved=await authorizeRequestTransfer(f.db,f.request,[{...f.row,eta:'2026-11-10',trackingNumbers:['PREPARED']}],0,f.admin);
 expect(reserved.shipments![0]).toMatchObject({eta:'',trackingNumbers:[],carrier:'gso'});
 expect(reserved.shipmentDrafts![0]).toMatchObject({eta:'2026-11-10',trackingNumbers:['PREPARED']});
 const saved=await updateSubmittedRequest(f.db,reserved,{shipmentDrafts:[{...reserved.shipmentDrafts![0]!,eta:'2026-11-11',trackingNumbers:['DRAFT']}]});
 expect(saved.shipments![0]!.eta).toBe('');expect(saved.shipmentDrafts![0]!.eta).toBe('2026-11-11');
 expect(f.sqlite.prepare('SELECT reserved,on_hand FROM surplus_lots WHERE id=?').get(f.lot.id)).toMatchObject({reserved:12,on_hand:48});
});
it('keeps earlier reserved transfer logistics private while authorizing another transfer',async()=>{
 const f=await fixture();const first=await authorizeRequestTransfer(f.db,f.request,[{...f.row,eta:'2026-11-10',trackingNumbers:['FIRST-DRAFT']}],0,f.admin);
 const second=await authorizeRequestTransfer(f.db,first,[first.shipmentDrafts![0]!,{...f.row,casesShipped:1}],1,f.admin);
 expect(second.shipments![0]!.eta).toBe('');expect(second.shipmentDrafts![0]!.eta).toBe('2026-11-10');expect(second.shipments).toHaveLength(2);
});
it('counts pending transfers for the sending agency before ETA and clears when shipped or cancelled',async()=>{
 const {pendingTransferCount}=await import('../server/utils/pendingTransfers');
 const f=await fixture();const reserved=await authorizeRequestTransfer(f.db,f.request,[f.row],0,f.admin);
 const sender={...getDemoUser('agency'),agencyId:11};
 expect(await pendingTransferCount(f.db,sender)).toBe(1);
 expect(await pendingTransferCount(f.db,getDemoUser('agency'))).toBe(0);
 expect(await pendingTransferCount(f.db,f.admin)).toBe(0);
 const id=reserved.shipments![0]!.transferId!;
 await dispatchTransfer(f.db,id,sender,{eta:'2026-11-10',carrier:'gso',trackingNumbers:['PENDING']});
 expect(await pendingTransferCount(f.db,sender)).toBe(0);
 const second=await fixture();const other=await authorizeRequestTransfer(second.db,second.request,[second.row],0,second.admin);
 const {deleteSubmittedShipment}=await import('../server/utils/submittedRequests');
 await deleteSubmittedShipment(second.db,other,0,second.admin.id);
 expect(await pendingTransferCount(second.db,sender)).toBe(0);
});
