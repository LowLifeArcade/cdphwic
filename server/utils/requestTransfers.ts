import {canDeleteShipment} from '../../shared/shipmentDeletion';
import type {RequestRecord,SessionUser} from '../../shared/domain';
import {isReviewer} from '../../shared/surplus';
import {shipmentPlan} from '../../shared/shipmentPublishing';
import {requestShipments,shipmentUpdates,validateShipments,type RequestShipment} from '../../shared/requestShipments';
import {preserveShipmentReceipts,shipmentDispatched} from '../../shared/shipmentReceipts';
import {shipmentIssueSummary} from '../../shared/shipmentIssues';
import {commitRequestTransfer} from './submittedRequests';
import {linkedTransfer,reserveTransferInventory,shipTransferInventory,transferError} from './requestTransferInventory';
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
 if(user.memberType!=='agency'||user.agencyId!==transfer.source_agency_id)throw transferError('Only the sending local agency can confirm shipment.',403);
 if(transfer.status!=='reserved')throw transferError('Only a reserved transfer can be shipped.');
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
 return {request,transfer:{...transfer,status:'shipped',eta:shipped.eta,carrier:shipped.carrier,tracking_reference:shipped.trackingNumbers.join('\n')}};
}

export async function saveRequestTransferEta(db:D1Database,id:string,user:SessionUser,input:Pick<RequestShipment,'eta'|'carrier'|'trackingNumbers'>,expectedRevision:number){
 if(!isReviewer(user))throw transferError('Only Admin or CDPH/WIC can arrange transfer shipping.',403);
 const transfer=await linkedTransfer(db,id);if(!transfer||transfer.status!=='reserved')throw transferError('Only a reserved transfer can have shipping details updated.');
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=?").bind(transfer.request_id).first<string>('request_json');
 if(!stored)throw transferError('Linked request not found.',404);
 const previous=JSON.parse(stored) as RequestRecord;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==(previous.revision??0))throw transferError('Request details changed. Reload before sending the transfer ETA.');
 const rows=requestShipments(previous);const index=rows.findIndex(row=>row.transferId===id);if(index<0)throw transferError('Linked shipment not found.');
 const planned={...rows[index]!,eta:input?.eta,carrier:'gso' as const,trackingNumbers:input?.trackingNumbers,transferEtaSentAt:new Date().toISOString()};
 const error=validateShipments([planned],true);if(error)throw transferError(error,400);
 planned.trackingNumbers=planned.trackingNumbers.map(number=>number.trim()).filter(Boolean);
 rows[index]=planned;const updates={...shipmentUpdates(rows),...(previous.shipmentDrafts?{shipmentDrafts:previous.shipmentDrafts.map((row,i)=>i===index?planned:row)}:{})};
 return commitRequestTransfer(db,previous,updates,[db.prepare("INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND status='reserved') THEN 1 ELSE 0 END").bind(id),db.prepare('UPDATE surplus_transfers SET eta=?,carrier=?,tracking_reference=? WHERE id=?').bind(planned.eta,planned.carrier,planned.trackingNumbers.join('\n'),id)]);
}
