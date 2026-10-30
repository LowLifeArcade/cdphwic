import type {RequestRecord} from './domain';
import {requestShipments,shipmentUpdates,type RequestShipment} from './requestShipments';
import {shipmentReceived} from './shipmentReceipts';
import {shipmentIssueSummary} from './shipmentIssues';
export function storedShipmentRows(request:RequestRecord):RequestShipment[] {
 return request.shipments ?? (request.eta || request.trackingNumbers?.length || request.unitsIssued ? requestShipments(request) : []);
}
export function canDeleteShipment(request:RequestRecord,index:number):boolean {
 const published=storedShipmentRows(request);
 const row=published[index] ?? request.shipmentDrafts?.[index];
 if(!Number.isSafeInteger(index)||index<0||!row)return false;
 if(row.transferId && row.transferStatus!=='reserved')return false;
 return !(published[index] && shipmentReceived(request,row)) && !row.receiptConfirmed && !row.receivedAt && row.receivedBy===undefined && row.receivedCases===undefined && row.receivedUnits===undefined && row.damagedUnits===undefined && !row.receiptCountHistory?.length && !row.dispositions?.length && !row.issue && !row.deletedIssues?.length && !row.replacedAt && !published.some(other=>other.replacementFor===index);
}
export function applyShipmentDeletion(request:RequestRecord,index:number,actorId:number,now=new Date().toISOString()):Partial<RequestRecord> {
 if(!canDeleteShipment(request,index))throw Object.assign(new Error('Only shipments without receipt or issue history can be deleted.'),{statusCode:409,statusMessage:'Only shipments without receipt or issue history can be deleted.'});
 const published=storedShipmentRows(request);
 const drafts=request.shipmentDrafts ?? published;
 const row=published[index] ?? drafts[index]!;
 const deletingPublished=index<published.length;
 const remove=(rows:RequestShipment[])=>rows.filter((_,i)=>i!==index).map(row=>({...row,...(deletingPublished && row.replacementFor!==undefined && row.replacementFor>index?{replacementFor:row.replacementFor-1}:{})}));
 const updates:Partial<RequestRecord>={shipmentDrafts:remove(drafts),deletedShipments:[...(request.deletedShipments??[]),{shipment:row,...(deletingPublished&&drafts[index]?{draft:drafts[index]}:{}),deletedAt:now,deletedBy:actorId}]};
 if(deletingPublished){
  const rows=remove(published);
  Object.assign(updates,shipmentUpdates(rows));
  if(['shipped','in_progress','complete','damaged','missing','needs_info'].includes(request.status))Object.assign(updates,rows.length?shipmentIssueSummary(request,rows):{status:'in_progress',receivedStatus:undefined});
 }
 return updates;
}
