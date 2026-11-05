import type {SessionUser} from '../../shared/domain';
import type {ClinicAddress} from '../../shared/shipping';
import {isReviewer,lotKey,type SurplusLot} from '../../shared/surplus';

const fail=(statusCode:number,statusMessage:string)=>Object.assign(new Error(statusMessage),{statusCode,statusMessage});
export const surplusLotColumns='id,agency_id AS agencyId,formula_name AS formulaName,form,flavor,expiration_date AS expirationDate,on_hand AS onHand,reserved,expired_units AS expiredUnits,version,clinic_id AS clinicId,clinic_name AS clinicName,clinic_address AS clinicAddress';
export function decodeSurplusLot(row:SurplusLot):SurplusLot {
 const {clinicId,clinicName,clinicAddress,...rest}=row;
 return {...rest,...(clinicId?{clinicId,clinicName:clinicName??'Clinic not specified',clinicAddress:typeof clinicAddress==='string'?JSON.parse(clinicAddress):clinicAddress}:{})};
}
export async function resolveSurplusClinic(db:D1Database,agencyId:number,clinicId?:string|null):Promise<{clinicId?:string;clinicName?:string;clinicAddress?:ClinicAddress}> {
 if(clinicId===undefined||clinicId===null||clinicId==='')return {};
 if(typeof clinicId!=='string')throw fail(400,'Select a clinic belonging to this Local Agency.');
 const row=await db.prepare('SELECT address_json FROM clinic_addresses WHERE id=? AND agency_id=? AND active=1').bind(clinicId,agencyId).first<{address_json:string}>();
 if(!row)throw fail(400,'Select an active clinic belonging to this Local Agency.');
 const address=JSON.parse(row.address_json) as ClinicAddress;
 return {clinicId,clinicName:address.clinicName,clinicAddress:address};
}
export async function assignSurplusClinic(db:D1Database,user:SessionUser,id:string,clinicId:string,expectedVersion:number):Promise<SurplusLot> {
 if(!isReviewer(user))throw fail(403,'Only CDPH/WIC or Admin can assign inventory to a clinic.');
 const stored=await db.prepare(`SELECT ${surplusLotColumns} FROM surplus_lots WHERE id=?`).bind(id).first<SurplusLot>();
 if(!stored)throw fail(404,'Inventory lot not found.');
 const lot=decodeSurplusLot(stored);
 if(lot.clinicId||lot.reserved||!Number.isSafeInteger(expectedVersion)||expectedVersion!==lot.version)throw fail(409,'Only unspecified, unreserved stock can be assigned. Refresh the inventory first.');
 const clinic=await resolveSurplusClinic(db,lot.agencyId,clinicId);
 if(!clinic.clinicId)throw fail(400,'Select a clinic.');
 const key=lotKey({...lot,clinicId:clinic.clinicId});
 if(await db.prepare('SELECT id FROM surplus_lots WHERE agency_id=? AND variant_key=?').bind(lot.agencyId,key).first())throw fail(409,'Matching stock already exists at this clinic. Reconcile its balance instead of merging automatically.');
 const operation=crypto.randomUUID();
 try {await db.batch([
  db.prepare("INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND reserved=0 AND clinic_id IS NULL) AND EXISTS(SELECT 1 FROM clinic_addresses WHERE id=? AND agency_id=? AND active=1) THEN 1 ELSE 0 END").bind(id,expectedVersion,clinic.clinicId,lot.agencyId),
  db.prepare('UPDATE surplus_lots SET clinic_id=?,clinic_name=?,clinic_address=?,variant_key=?,version=version+1 WHERE id=?').bind(clinic.clinicId,clinic.clinicName,JSON.stringify(clinic.clinicAddress),key,id),
  db.prepare("INSERT INTO surplus_commands(id,actor_id,payload,status,result) VALUES(?,?,?,'done',?)").bind(operation,user.id,JSON.stringify({kind:'assign-clinic',lotId:id,clinicId}),JSON.stringify({lotId:id})),
  db.prepare("INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units) SELECT ?,?,id,'assign-clinic',0,?,?,on_hand,reserved,expired_units FROM surplus_lots WHERE id=?").bind(crypto.randomUUID(),operation,user.id,`Assigned clinic: ${clinic.clinicName}`,id),
  db.prepare('DELETE FROM surplus_guard'),
 ]);}catch{throw fail(409,'Stock changed or matching stock already exists at the clinic. Refresh and reconcile the inventory.');}
 return decodeSurplusLot((await db.prepare(`SELECT ${surplusLotColumns} FROM surplus_lots WHERE id=?`).bind(id).first<SurplusLot>())!);
}
