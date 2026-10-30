import type {RequestRecord} from './domain';
import {requestShipments} from './requestShipments';
import {shipmentDispatched,shipmentFinished,shipmentReceiptKey} from './shipmentReceipts';
import {receiptQuantityKey} from './shipmentQuantities';
export interface SimpleShipmentReceiptCommand {index:number;key:string;expectedReceipt:string;expectedIssue:string;damaged:boolean;issueNotes:string}
/** Confirmation deliberately records no inferred actual quantity. Historical quantities remain intact. */
export function confirmSimpleShipmentReceipt(request:RequestRecord,command:SimpleShipmentReceiptCommand,actorId:number,now=new Date().toISOString()):Partial<RequestRecord>{
 const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
 const shipments=requestShipments(request).map(row=>({...row,dispatched:shipmentDispatched(request,row)}));
 const row=shipments[command?.index];
 if(!Number.isSafeInteger(command?.index)||!row||shipmentReceiptKey(row)!==command.key||receiptQuantityKey(row)!==command.expectedReceipt||JSON.stringify(row.issue??null)!==command.expectedIssue)fail('Shipment receipt changed. Refresh before confirming.');
 if(!shipmentDispatched(request,row!))fail('Only shipped deliveries can be confirmed.');
 if(typeof command.damaged!=='boolean'||typeof command.issueNotes!=='string'||command.issueNotes.length>4000)fail('Enter valid receipt details.');
 const next={...row!,receiptMode:'simple' as const,receiptConfirmed:true,receivedAt:row!.receivedAt??now,receivedBy:actorId};
 if(command.damaged){
  const {resolvedAt,resolvedBy,...prior}=next.issue??{};
  next.issue={...prior,id:prior.id??crypto.randomUUID(),source:'receipt-confirmation',type:'damaged',notes:command.issueNotes.trim(),reportedAt:prior.reportedAt??now,reportedBy:prior.reportedBy??actorId,...(prior.id?{updatedAt:now,updatedBy:actorId}:{}),...(resolvedAt?{reopenedAt:now,reopenedBy:actorId}:{})};
 }else if(next.issue){next.issue={...next.issue,notes:command.issueNotes.trim(),resolvedAt:next.issue.resolvedAt??now,resolvedBy:next.issue.resolvedBy??actorId};}
 shipments[command.index]=next;
 const issue=shipments.find(s=>s.issue&&!s.issue.resolvedAt)?.issue;
 const complete=shipments.every(s=>shipmentFinished(request,s));
 return {shipments,status:issue?(issue.type==='incomplete'?'needs_info':issue.type):complete?'complete':'shipped',receivedStatus:issue?issue.type:complete?'received':'shipped'};
}
