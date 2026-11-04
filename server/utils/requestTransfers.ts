import {publishAuthorization} from '../../shared/authorizationPublication';
import {canDeleteShipment} from '../../shared/shipmentDeletion';
import type {RequestRecord,SessionUser} from '../../shared/domain';
import {isReviewer} from '../../shared/surplus';
import {shipmentPlan} from '../../shared/shipmentPublishing';
import {requestShipments,shipmentUpdates,validateShipments,type RequestShipment} from '../../shared/requestShipments';
import {preserveShipmentReceipts,shipmentDispatched} from '../../shared/shipmentReceipts';
import {shipmentIssueSummary} from '../../shared/shipmentIssues';
import {commitRequestTransfer} from './submittedRequests';
import {linkedTransfer,reserveTransferInventory,shipTransferInventory,transferError} from './requestTransferInventory';
import {localDate} from '../../shared/surplus';

export async function confirmRequestTransferStock(db:D1Database,id:string,user:SessionUser){
 const transfer=await linkedTransfer(db,id);
 if(!transfer||(!isReviewer(user)&&user.agencyId!==transfer.source_agency_id))throw transferError('Transfer not found.',404);
 if(isReviewer(user)||user.memberType!=='agency'||user.agencyId!==transfer.source_agency_id)throw transferError('Only the sending Local Agency can confirm product availability.',403);
 if(transfer.status!=='reserved')throw transferError('Only a reserved transfer can have stock confirmed.');
 const lot=await db.prepare('SELECT expiration_date,expired_units,on_hand,reserved FROM surplus_lots WHERE id=?').bind(transfer.source_lot_id).first<{expiration_date:string;expired_units:number;on_hand:number;reserved:number}>();
 if(!lot||lot.expiration_date<localDate()||lot.expired_units>0||lot.on_hand<transfer.quantity||lot.reserved<transfer.quantity)throw transferError('Reserved stock is no longer available. Contact CDPH/WIC.');
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=?").bind(transfer.request_id).first<string>('request_json');
 if(!stored)throw transferError('Linked request not found.',404);
 const previous=JSON.parse(stored) as RequestRecord;
 const rows=requestShipments(previous);const index=rows.findIndex(row=>row.transferId===id);
 if(index<0)throw transferError('Linked shipment not found.');
 if(transfer.stock_confirmed_at)return {request:previous,transfer};
 const confirmedAt=new Date().toISOString();rows[index]={...rows[index]!,transferStockConfirmedAt:confirmedAt};
 const updates={...shipmentUpdates(rows),...(previous.shipmentDrafts?{shipmentDrafts:previous.shipmentDrafts.map(row=>row.transferId===id?{...row,transferStockConfirmedAt:confirmedAt}:row)}:{})};
 const request=await commitRequestTransfer(db,previous,updates,[
  db.prepare("INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id WHERE t.id=? AND t.status='reserved' AND t.stock_confirmed_at IS NULL AND l.expiration_date>=? AND l.expired_units=0 AND l.on_hand>=t.quantity AND l.reserved>=t.quantity) THEN 1 ELSE 0 END").bind(id,localDate()),
  db.prepare('UPDATE surplus_transfers SET stock_confirmed_at=?,stock_confirmed_by=? WHERE id=?').bind(confirmedAt,user.id,id),
 ]);
 return {request,transfer:{...transfer,stock_confirmed_at:confirmedAt,stock_confirmed_by:user.id}};
}
export async function authorizeRequestTransfer(db:D1Database,previous:RequestRecord,drafts:RequestShipment[],index:number,user:SessionUser){
 if(!isReviewer(user))throw transferError('Only Admin or CDPH/WIC can authorize agency transfers.',403);
 if(!Array.isArray(drafts)||!Number.isSafeInteger(index)||index<0||!drafts[index])throw transferError('Select a valid shipment.');
 const published=previous.shipments??(previous.eta||previous.trackingNumbers?.length?requestShipments(previous):[]);
 if(index>published.length)throw transferError('Send or authorize the preceding shipment first.');
 const old=published[index];
 if(old && (old.transferId||shipmentDispatched(previous,old)||!canDeleteShipment(previous,index)))throw transferError('Only an unsent shipment without receipt or issue history can be authorized.');
 const message=validateShipments(drafts.map(r=>r&&({...r,etaSentAt:undefined})));if(message)throw transferError(message);
 // Client-supplied transfer IDs, policies and receipt fields are never trusted.
 const safe=drafts.map((row,i)=>({...published[i],...shipmentPlan(row),replacementFor:published[i]?.replacementFor,etaSentAt:published[i]?.etaSentAt}));
 const protectedRows=preserveShipmentReceipts({...previous,shipments:published},safe);
 for(const [i,row] of published.entries())if(row.transferId){
  const compared=row.transferStatus==='reserved'?{...row,...drafts[i],eta:row.eta,carrier:row.carrier,trackingNumbers:row.trackingNumbers}:{...row,...drafts[i]};
  if(JSON.stringify(shipmentPlan(compared))!==JSON.stringify(shipmentPlan(row)))throw transferError('Existing authorized transfers cannot be changed.');
  protectedRows[i]={...row,...(row.transferStatus==='reserved'?{eta:safe[i]!.eta,trackingNumbers:[...safe[i]!.trackingNumbers]}:{})};
 }
 const prepared=await reserveTransferInventory(db,previous,protectedRows[index]!,user.id);
 protectedRows[index]={...prepared.row,eta:safe[index]!.eta,trackingNumbers:[...safe[index]!.trackingNumbers]};
 const shipments=preserveShipmentReceipts({...previous,shipments:published},published);shipments[index]=prepared.row;
 return commitRequestTransfer(db,previous,{...shipmentUpdates(shipments),shipmentDrafts:protectedRows,...shipmentIssueSummary({...previous,receivedStatus:'shipped'},shipments)},prepared.steps);
}
export async function shipRequestTransfer(db:D1Database,id:string,user:SessionUser){
 const transfer=await linkedTransfer(db,id);
 if(!transfer||(!isReviewer(user)&&user.agencyId!==transfer.source_agency_id))throw transferError('Transfer not found.',404);
 if(isReviewer(user)||user.memberType!=='agency'||user.agencyId!==transfer.source_agency_id)throw transferError('Only the sending local agency can confirm pickup.',403);
 if(transfer.status!=='reserved')throw transferError('Only a reserved transfer can have pickup confirmed.');
 if(!transfer.stock_confirmed_at)throw transferError('The sending Local Agency must confirm product availability first.');
 if(!await db.prepare('SELECT id FROM transfer_shipping_labels WHERE transfer_id=? LIMIT 1').bind(id).first())throw transferError('CDPH/WIC must provide shipping labels before pickup.');
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=?").bind(transfer.request_id).first<string>('request_json');
 if(!stored)throw transferError('Linked request not found.');
 const previous=JSON.parse(stored) as RequestRecord;
 const rows=requestShipments(previous);const index=rows.findIndex(row=>row.transferId===id);const original=rows[index];
 if(!original)throw transferError('Linked shipment not found.');
 if(!original.transferEtaSentAt)throw transferError('CDPH/WIC must send the ETA and tracking details before shipment can be confirmed.');
 const shipped={...original,etaSentAt:new Date().toISOString(),dispatched:true,transferStatus:'shipped' as const};
 const message=validateShipments([shipped],true);if(message)throw transferError(message);
 rows[index]=shipped;
 const drafts=previous.shipmentDrafts?.map((row,i)=>i===index?shipped:row);
 const updates={...shipmentUpdates(rows),...(drafts?{shipmentDrafts:drafts}:{}),...shipmentIssueSummary({...previous,receivedStatus:'shipped'},rows)};
 const request=await commitRequestTransfer(db,previous,updates,shipTransferInventory(db,transfer,shipped,user.id));
 return {request,transfer:{...transfer,status:'shipped',shipped_date:shipped.etaSentAt.slice(0,10),eta:shipped.eta,carrier:shipped.carrier,tracking_reference:shipped.trackingNumbers.join('\n')}};
}

export async function saveRequestTransferEta(db:D1Database,id:string,user:SessionUser,input:Pick<RequestShipment,'eta'|'carrier'|'trackingNumbers'>,expectedRevision:number){
 if(!isReviewer(user))throw transferError('Only Admin or CDPH/WIC can arrange transfer shipping.',403);
 const transfer=await linkedTransfer(db,id);if(!transfer||transfer.status!=='reserved')throw transferError('Only a reserved transfer can have shipping details updated.');
 if(!transfer.stock_confirmed_at)throw transferError('The sending Local Agency must confirm product availability before shipping details are sent.');
 if(!await db.prepare('SELECT id FROM transfer_shipping_labels WHERE transfer_id=? LIMIT 1').bind(id).first())throw transferError('Upload shipping labels before sending shipping details to the agency.');
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=?").bind(transfer.request_id).first<string>('request_json');
 if(!stored)throw transferError('Linked request not found.',404);
 const previous=JSON.parse(stored) as RequestRecord;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==(previous.revision??0))throw transferError('Request details changed. Reload before sending the transfer ETA.');
 const rows=requestShipments(previous);const index=rows.findIndex(row=>row.transferId===id);if(index<0)throw transferError('Linked shipment not found.');
 const planned={...rows[index]!,eta:input?.eta,carrier:'gso' as const,trackingNumbers:input?.trackingNumbers,transferEtaSentAt:new Date().toISOString()};
 const error=validateShipments([planned],true);if(error)throw transferError(error,400);
 planned.trackingNumbers=planned.trackingNumbers.map(number=>number.trim()).filter(Boolean);
 rows[index]=planned;const updates={...shipmentUpdates(rows),...(previous.shipmentDrafts?{shipmentDrafts:previous.shipmentDrafts.map((row,i)=>i===index?planned:row)}:{})};
 return commitRequestTransfer(db,previous,publishAuthorization({...previous,...updates},index),[db.prepare("INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id WHERE t.id=? AND t.status='reserved' AND t.stock_confirmed_at IS NOT NULL AND l.expiration_date>=? AND l.expired_units=0 AND EXISTS(SELECT 1 FROM transfer_shipping_labels s WHERE s.transfer_id=t.id)) THEN 1 ELSE 0 END").bind(id,localDate()),db.prepare('UPDATE surplus_transfers SET eta=?,carrier=?,tracking_reference=? WHERE id=?').bind(planned.eta,planned.carrier,planned.trackingNumbers.join('\n'),id)]);
}
