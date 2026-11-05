import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {getDemoUser} from '../server/utils/session';
import {saveClinic,archiveClinic} from '../server/utils/clinicStore';
import {ensureSurplusLot,executeSurplusCommand,listSurplus} from '../server/utils/surplusStore';
import {ensureSubmittedRequest,updateSubmittedRequest} from '../server/utils/submittedRequests';
import {authorizeRequestTransfer} from '../server/utils/requestTransfers';
const admin=getDemoUser('admin');
const variant={formulaName:'Nutramigen LGG',form:'powder',flavor:'',expirationDate:'2099-12-31'};
const address={clinicName:'North Clinic',addressLine1:'1 North Street',addressLine2:'',city:'Example',state:'CA',postalCode:'90001'};
async function fixture(){const {db}=surplusDb();const first=await saveClinic(db,admin,10,address);const second=await saveClinic(db,admin,10,{...address,clinicName:'South Clinic',addressLine1:'2 South Street'});return {db,first,second};}
it('separates identical stock at two clinics while retaining the legacy unspecified lot',async()=>{
 const {db,first,second}=await fixture();const unknown=await ensureSurplusLot(db,10,variant);
 const north=await ensureSurplusLot(db,10,{...variant,clinicId:first.id});const south=await ensureSurplusLot(db,10,{...variant,clinicId:second.id});
 expect(new Set([unknown.id,north.id,south.id]).size).toBe(3);
 expect((await ensureSurplusLot(db,10,variant)).id).toBe(unknown.id);
 expect(north).toMatchObject({clinicId:first.id,clinicName:'North Clinic',clinicAddress:address});
 await executeSurplusCommand(db,admin,{kind:'reconcile',operationId:'north-count',lotId:north.id,quantity:12,expectedVersion:0,reason:'Physical count'});
 const lots=(await listSurplus(db,admin)).lots;expect(lots.find(l=>l.id===north.id)?.onHand).toBe(12);expect(lots.find(l=>l.id===south.id)?.onHand).toBe(0);
});
it('rejects a clinic from another agency and archived or malformed clinic selections',async()=>{
 const {db,first}=await fixture();
 await expect(ensureSurplusLot(db,11,{...variant,clinicId:first.id})).rejects.toMatchObject({statusCode:400});
 await archiveClinic(db,admin,10,first.id);
 await expect(ensureSurplusLot(db,10,{...variant,clinicId:first.id})).rejects.toMatchObject({statusCode:400});
 await expect(ensureSurplusLot(db,10,{...variant,clinicId:123 as any})).rejects.toMatchObject({statusCode:400});
});
it('assigns unspecified unreserved stock without changing its balance, identity or history',async()=>{
 const {assignSurplusClinic}=await import('../server/utils/surplusClinicLocations');
 const {db,first}=await fixture();const unknown=await ensureSurplusLot(db,10,variant);
 await executeSurplusCommand(db,admin,{kind:'reconcile',operationId:'count',lotId:unknown.id,quantity:8,expectedVersion:0,reason:'Physical count'});
 await expect(assignSurplusClinic(db,getDemoUser('agency'),unknown.id,first.id,1)).rejects.toMatchObject({statusCode:403});
 await expect(assignSurplusClinic(db,admin,unknown.id,first.id,0)).rejects.toMatchObject({statusCode:409});
 const located=await assignSurplusClinic(db,admin,unknown.id,first.id,1);
 expect(located).toMatchObject({id:unknown.id,clinicId:first.id,onHand:8,reserved:0,version:2});
 expect((await db.prepare('SELECT COUNT(*) AS n FROM surplus_movements WHERE lot_id=?').bind(unknown.id).first<number>('n'))).toBe(2);
});
it('does not assign reserved stock or silently merge matching clinic balances',async()=>{
 const {assignSurplusClinic}=await import('../server/utils/surplusClinicLocations');
 const {db,first,second}=await fixture();const unknown=await ensureSurplusLot(db,10,variant);await ensureSurplusLot(db,10,{...variant,clinicId:first.id});
 await expect(assignSurplusClinic(db,admin,unknown.id,first.id,0)).rejects.toMatchObject({statusCode:409});
 await executeSurplusCommand(db,admin,{kind:'reconcile',operationId:'reserve-count',lotId:unknown.id,quantity:8,expectedVersion:0,reason:'Physical count'});
 await executeSurplusCommand(db,admin,{kind:'reserve',operationId:'reserve',lotId:unknown.id,quantity:2,destinationAgencyId:11,requestRef:'example'});
 await expect(assignSurplusClinic(db,admin,unknown.id,second.id,2)).rejects.toMatchObject({statusCode:409});
 expect((await listSurplus(db,admin)).lots.find(l=>l.id===unknown.id)).toMatchObject({onHand:8,reserved:2});
});
it('reserves only the selected clinic stock and snapshots its pickup address',async()=>{
 const {db,first,second}=await fixture();const north=await ensureSurplusLot(db,10,{...variant,clinicId:first.id});const south=await ensureSurplusLot(db,10,{...variant,clinicId:second.id});
 for(const lot of [north,south])await executeSurplusCommand(db,admin,{kind:'reconcile',operationId:lot.id,lotId:lot.id,quantity:12,expectedVersion:0,reason:'Physical count'});
 const request=await ensureSubmittedRequest(db,{id:9850,submissionId:'clinic-transfer',agencyId:11,agencyMemberId:101,participantName:'Example',productName:variant.formulaName,productForm:'powder',status:'in_progress'});
 const row={shipmentSource:'agency' as const,sourceAgencyId:10,sourceLotId:south.id,casesShipped:1,unitsPerCase:6,eta:'',carrier:'gso' as const,trackingNumbers:[]};
 await expect(authorizeRequestTransfer(db,{...request,agencyId:10},[row],0,admin)).rejects.toThrow();
 const reserved=await authorizeRequestTransfer(db,request,[row],0,admin);
 expect(reserved.shipments![0]).toMatchObject({sourceClinicId:second.id,sourceClinicName:'South Clinic'});
 const transferId=reserved.shipments![0]!.transferId!;
 await saveClinic(db,admin,10,{...second,addressLine1:'9 Changed Street'},second.id);
 const transfer=await db.prepare('SELECT source_clinic_id,source_clinic_address FROM surplus_transfers WHERE id=?').bind(transferId).first<any>();
 expect(transfer.source_clinic_id).toBe(second.id);expect(JSON.parse(transfer.source_clinic_address).addressLine1).toBe('2 South Street');
 const lots=(await listSurplus(db,admin)).lots;expect(lots.find(l=>l.id===north.id)?.reserved).toBe(0);expect(lots.find(l=>l.id===south.id)?.reserved).toBe(6);
});
it('lets reviewers explicitly locate an old pending count while rejecting an implicit clinic mismatch',async()=>{
 const {db,first}=await fixture();const lot=await ensureSurplusLot(db,10,{...variant,clinicId:first.id});
 await db.prepare("INSERT INTO surplus_reports(id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,reporter_id,counted_at) VALUES('old-count','old-count',10,?,'powder','',?,5,100,'2026-11-04')").bind(variant.formulaName,variant.expirationDate).run();
 const command={kind:'reconcile' as const,lotId:lot.id,quantity:5,expectedVersion:0,reportId:'old-count',reason:'Reviewed physical count'};
 await expect(executeSurplusCommand(db,admin,{...command,operationId:'implicit-review'})).rejects.toMatchObject({statusCode:409});
 await executeSurplusCommand(db,admin,{...command,clinicId:first.id,operationId:'explicit-review'});
 const reviewed=await db.prepare("SELECT clinic_id,clinic_name,status FROM surplus_reports WHERE id='old-count'").first<any>();
 expect(reviewed).toMatchObject({clinic_id:first.id,clinic_name:'North Clinic',status:'reconciled'});
});
it('retains clinic identity when an expiration date is corrected',async()=>{
 const {db,first,second}=await fixture();const north=await ensureSurplusLot(db,10,{...variant,clinicId:first.id});await ensureSurplusLot(db,10,{...variant,clinicId:second.id,expirationDate:'2099-11-01'});
 await executeSurplusCommand(db,admin,{kind:'correct-expiry',operationId:'correct-clinic-expiry',lotId:north.id,expectedVersion:0,expirationDate:'2099-11-01',reason:'Verified label'});
 const same=await ensureSurplusLot(db,10,{...variant,clinicId:first.id,expirationDate:'2099-11-01'});expect(same.id).toBe(north.id);
 expect((await listSurplus(db,admin)).lots).toHaveLength(2);
});
it('validates clinic ownership on reviewer surplus edits as well as original submissions',async()=>{
 const {db,first}=await fixture();const foreign=await saveClinic(db,admin,11,{...address,clinicName:'Other Agency Clinic'});
 const request=await ensureSubmittedRequest(db,{id:9851,submissionId:'clinic-edit-request',agencyId:10,agencyMemberId:100,participantName:'Example',productName:variant.formulaName,productForm:'powder',status:'in_progress'});
 const item={productName:variant.formulaName,productForm:'powder' as const,units:2,expirationDate:variant.expirationDate};
 await expect(updateSubmittedRequest(db,request,{surplusItems:[{...item,clinicId:foreign.id}]})).rejects.toMatchObject({statusCode:400});
 const updated=await updateSubmittedRequest(db,request,{surplusItems:[{...item,clinicId:first.id}]});expect(updated.surplusItems![0]!.clinicId).toBe(first.id);
 await archiveClinic(db,admin,10,first.id);
 const saved=await updateSubmittedRequest(db,updated,{surplusItems:updated.surplusItems,repNotes:'Updated note'});expect(saved.repNotes).toBe('Updated note');
});
