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
  if(JSON.stringify(shipmentPlan({...row,...drafts[i]}))!==JSON.stringify(shipmentPlan(row)))throw transferError('Existing authorized transfers cannot be changed.');
  protectedRows[i]=row;
 }
 const prepared=await reserveTransferInventory(db,previous,protectedRows[index]!,user.id);
 protectedRows[index]=prepared.row;
 const shipments=preserveShipmentReceipts({...previous,shipments:published},published);shipments[index]=prepared.row;
 return commitRequestTransfer(db,previous,{...shipmentUpdates(shipments),shipmentDrafts:protectedRows,...shipmentIssueSummary({...previous,receivedStatus:'shipped'},shipments)},prepared.steps);
}
export async function shipRequestTransfer(db:D1Database,id:string,user:SessionUser,input:Pick<RequestShipment,'eta'|'carrier'|'trackingNumbers'>){
 const transfer=await linkedTransfer(db,id);
 if(!transfer||(!isReviewer(user)&&user.agencyId!==transfer.source_agency_id))throw transferError('Transfer not found.',404);
 if(transfer.status!=='reserved')throw transferError('Only a reserved transfer can be shipped.');
 const stored=await db.prepare("SELECT request_json FROM surplus_submissions WHERE json_extract(request_json,'$.id')=?").bind(transfer.request_id).first<string>('request_json');
 if(!stored)throw transferError('Linked request not found.');
 const previous=JSON.parse(stored) as RequestRecord;
 const rows=requestShipments(previous);const index=rows.findIndex(row=>row.transferId===id);const original=rows[index];
 if(!original)throw transferError('Linked shipment not found.');
 const shipped={...original,eta:input.eta,carrier:input.carrier,trackingNumbers:input.trackingNumbers,etaSentAt:new Date().toISOString(),dispatched:true,transferStatus:'shipped' as const};
 const message=validateShipments([shipped],true);if(message)throw transferError(message);
 rows[index]=shipped;
 const drafts=previous.shipmentDrafts?.map((row,i)=>i===index?shipped:row);
 const updates={...shipmentUpdates(rows),...(drafts?{shipmentDrafts:drafts}:{}),...shipmentIssueSummary({...previous,receivedStatus:'shipped'},rows)};
 const request=await commitRequestTransfer(db,previous,updates,shipTransferInventory(db,transfer,shipped,user.id));
 return {request,transfer:{...transfer,status:'shipped',eta:shipped.eta,carrier:shipped.carrier,tracking_reference:shipped.trackingNumbers.join('\n')}};
}
