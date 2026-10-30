import {requireShipmentFormula,shipmentFormulaKey} from '../../shared/shipmentFormulas';
import {listProducts} from './productStore';
import type {RequestRecord} from '../../shared/domain';
import type {RequestShipment} from '../../shared/requestShipments';
import {transferCatalogUnitsPerCase,matchingTransferLot,type RequestAgencyTransfer} from '../../shared/requestTransfers';
import {localDate,type SurplusLot} from '../../shared/surplus';
import {shipmentQuantities} from '../../shared/shipmentQuantities';
import {SEED_AGENCIES} from '../data/seed';
export const transferError=(message:string,statusCode=409)=>Object.assign(new Error(message),{statusCode,statusMessage:message});
const guard=(db:D1Database,condition:string,args:unknown[]=[])=>db.prepare(`INSERT INTO surplus_guard(ok) SELECT CASE WHEN (${condition}) THEN 1 ELSE 0 END`).bind(...args);
function audit(db:D1Database,lotId:string,requestId:number,actor:number,kind:string,quantity:number){
 const id=crypto.randomUUID();return [
 db.prepare("INSERT INTO surplus_commands(id,actor_id,payload,status,result) VALUES(?,?,?,'done','{}')").bind(id,actor,JSON.stringify({kind,requestId,lotId,quantity})),
 db.prepare('INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?,?,?,?,?,?,?,?,on_hand,reserved,expired_units FROM surplus_lots WHERE id=?').bind(crypto.randomUUID(),id,lotId,kind,quantity,actor,String(requestId),'Request-linked agency transfer',lotId)];
}
export async function reserveTransferInventory(db:D1Database,request:RequestRecord,row:RequestShipment,actor:number){
 const lot=await db.prepare('SELECT id,agency_id AS agencyId,formula_name AS formulaName,form,flavor,expiration_date AS expirationDate,on_hand AS onHand,reserved,expired_units AS expiredUnits,version FROM surplus_lots WHERE id=?').bind(row.sourceLotId??'').first<SurplusLot>();
 if(lot && row.unitsPerCase===undefined)row={...row,unitsPerCase:transferCatalogUnitsPerCase(lot,listProducts())};
 const quantity=row.unitsToTransfer??row.casesShipped*(row.unitsPerCase??0)+(row.looseUnitsShipped??0);
 if(!lot||row.sourceAgencyId!==lot.agencyId||!matchingTransferLot(request,lot)||lot.expirationDate<localDate()||lot.expiredUnits>0||!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(row.unitsPerCase)||row.unitsPerCase!<1||lot.onHand-lot.reserved<quantity)throw transferError('Select matching, unexpired agency surplus and a quantity within the available balance.');
 const formula=requireShipmentFormula(request,{transferFormulaName:lot.formulaName,transferForm:lot.form,transferFlavor:lot.flavor});
 if(row.shipmentFormula && shipmentFormulaKey(formula)!==shipmentFormulaKey(row.shipmentFormula))throw transferError('Selected surplus does not match the shipment formula.');
 const id=crypto.randomUUID();
 const trusted:RequestShipment={...row,shipmentFormula:formula,carrier:'gso',unitsToTransfer:quantity,casesShipped:Math.floor(quantity/row.unitsPerCase!),looseUnitsShipped:quantity%row.unitsPerCase!,shipmentSource:'agency',sourceAgencyId:lot.agencyId,sourceAgencyName:SEED_AGENCIES.find(a=>a.id===lot.agencyId)!.name,sourceLotId:lot.id,transferId:id,transferStatus:'reserved',transferQuantity:quantity,transferFormulaName:lot.formulaName,transferForm:lot.form,transferFlavor:lot.flavor,transferExpiration:lot.expirationDate,distributorId:undefined,distributorPolicy:undefined,supplier:undefined,eta:'',etaSentAt:undefined,dispatched:false,trackingNumbers:[]};
 const steps=[guard(db,'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND expiration_date>=? AND on_hand-reserved>=?)',[lot.id,lot.version,localDate(),quantity]),
 db.prepare('UPDATE surplus_lots SET reserved=reserved+?,version=version+1 WHERE id=?').bind(quantity,lot.id),
 db.prepare("INSERT INTO surplus_transfers(id,source_lot_id,source_agency_id,destination_agency_id,formula_name,form,flavor,expiration_date,quantity,request_ref,status,request_id,units_per_case,destination_shipping) VALUES(?,?,?,?,?,?,?,?,?,?,'reserved',?,?,?)").bind(id,lot.id,lot.agencyId,request.agencyId,lot.formulaName,lot.form,lot.flavor,lot.expirationDate,quantity,String(request.id),request.id,row.unitsPerCase,JSON.stringify(request.shipping??null)),
 ...audit(db,lot.id,request.id,actor,'reserve',quantity)];
 return {row:trusted,steps};
}
export async function linkedTransfer(db:D1Database,id:string){return db.prepare('SELECT * FROM surplus_transfers WHERE id=? AND request_id IS NOT NULL').bind(id).first<RequestAgencyTransfer>();}
export function shipTransferInventory(db:D1Database,t:RequestAgencyTransfer,row:RequestShipment,actor:number){
 return [guard(db,"EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND status='reserved')",[t.id]),guard(db,'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND reserved>=? AND on_hand>=? AND expiration_date>=?)',[t.source_lot_id,t.quantity,t.quantity,localDate()]),
 db.prepare('UPDATE surplus_lots SET on_hand=on_hand-?,reserved=reserved-?,version=version+1 WHERE id=?').bind(t.quantity,t.quantity,t.source_lot_id),
 db.prepare("UPDATE surplus_transfers SET status='shipped',eta=?,carrier=?,tracking_reference=?,shipped_date=? WHERE id=?").bind(row.eta,row.carrier,row.trackingNumbers.join('\n'),localDate(),t.id),...audit(db,t.source_lot_id,t.request_id,actor,'ship',t.quantity)];
}
export async function transferReceiptSteps(db:D1Database,previous:RequestRecord,next:Partial<RequestRecord>){
 const steps:D1PreparedStatement[]=[];
 for(const [index,row] of (next.shipments??[]).entries()){
  if(!row.transferId)continue;
  const old=previous.shipments?.[index];
  if(!old?.transferId||old.transferId!==row.transferId)throw transferError('Transfer identity changed.');
  if(row.receiptMode==='simple' && row.receiptConfirmed){
   if(old.receiptMode==='simple' && old.receiptConfirmed)continue;
   steps.push(guard(db,"EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND request_id=? AND status IN ('shipped','received'))",[row.transferId,previous.id]),db.prepare("UPDATE surplus_transfers SET status='received',received_date=COALESCE(received_date,?) WHERE id=?").bind(localDate(),row.transferId));row.transferStatus='received';continue;
  }
  if(JSON.stringify([old.receivedUnits,old.receivedCases,old.damagedUnits])===JSON.stringify([row.receivedUnits,row.receivedCases,row.damagedUnits]))continue;
  const q=shipmentQuantities({...previous,...next},row);const complete=q.missingUnits===0;
  steps.push(guard(db,"EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND request_id=? AND status IN ('shipped','received'))",[row.transferId,previous.id]),db.prepare('UPDATE surplus_transfers SET received_units=?,damaged_units=?,status=?,received_date=? WHERE id=?').bind(q.receivedUnits,q.damagedUnits,complete?'received':'shipped',localDate(),row.transferId));
  row.transferStatus=complete?'received':'shipped';
 }
 return steps;
}
export async function cancelTransferInventory(db:D1Database,request:RequestRecord,row:RequestShipment,actor:number){
 if(!row.transferId)return [];
 const t=await linkedTransfer(db,row.transferId);if(!t||!['reserved','blocked-expired'].includes(t.status))throw transferError('Shipped agency transfers cannot be deleted. Keep the transfer available for receipt and issue follow-up.');
 return [guard(db,"EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND status=?)",[t.id,t.status]),...(t.status==='reserved'?[guard(db,'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND reserved>=?)',[t.source_lot_id,t.quantity]),db.prepare('UPDATE surplus_lots SET reserved=reserved-?,version=version+1 WHERE id=?').bind(t.quantity,t.source_lot_id)]:[]),db.prepare("UPDATE surplus_transfers SET status='cancelled' WHERE id=?").bind(t.id),...audit(db,t.source_lot_id,request.id,actor,'cancel',t.quantity)];
}
