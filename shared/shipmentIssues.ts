import type {RequestRecord} from './domain';
import {requestShipments,type RequestShipment} from './requestShipments';
import {shipmentReceiptKey,shipmentReceived,canConfirmShipment,shipmentDispatched,shipmentFinished,confirmShipmentReceipts} from './shipmentReceipts';
export type ShipmentIssueType='damaged'|'missing'|'incomplete';
export interface ShipmentIssueCommand {index:number;key:string;expectedIssue:string;action:'report'|'resolve'|'resolve-received'|'respond'|'update'|'reopen'|'delete';type?:ShipmentIssueType;notes?:string;catalogUnitsPerCase?:number;receivedCases?:number;receivedLooseUnits?:number;damagedCases?:number;damagedLooseUnits?:number;expectedReceipt?:string}
export function shipmentIssueKey(row:RequestShipment):string {return JSON.stringify(row.issue ?? null);}
export function activeShipmentIssue(row:RequestShipment) {return row.issue && !row.issue.resolvedAt ? row.issue : undefined;}
export function shipmentIssueSummary(request:RequestRecord,shipments:RequestShipment[]):Partial<RequestRecord> {
    const issue=shipments.map(activeShipmentIssue).find(Boolean);
    if (issue) return {status:issue.type==='incomplete'?'needs_info':issue.type,receivedStatus:issue.type};
    const allReceived=shipments.every(row=>shipmentFinished(request,row));
    return {status:allReceived?'complete':shipments.every(row=>shipmentDispatched(request,row))?'shipped':'in_progress',receivedStatus:allReceived?'received':'shipped'};
}
export function applyShipmentIssue(request:RequestRecord,command:ShipmentIssueCommand,actorId:number,now=new Date().toISOString()):Partial<RequestRecord> {
    const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
    const rows=requestShipments(request).map(row=>({...row,dispatched:shipmentDispatched(request,row),...(shipmentReceived(request,row)?{receiptConfirmed:true}:{})}));
    if (!command || !Number.isSafeInteger(command.index) || command.index<0 || !rows[command.index]) fail('Select a valid shipment.');
    const row=rows[command.index]!;
    if (shipmentReceiptKey(row)!==command.key || shipmentIssueKey(row)!==command.expectedIssue) fail('This shipment or issue has changed. Refresh and try again.');
    if (command.action==='report' || command.action==='update') {
        if (command.action==='report' && row.issue) fail('This shipment already has an issue. Update or reopen the existing report.');
        if (command.action==='update' && !row.issue) fail('This shipment has no issue to update.');
        if (!['damaged','missing','incomplete'].includes(command.type ?? '')) fail('Select a valid issue type.');
        if (command.notes!==undefined && (typeof command.notes!=='string' || command.notes.length>4000)) fail('Issue notes must be 4,000 characters or fewer.');
        if (!canConfirmShipment(request,row) && !shipmentReceived(request,row) && !activeShipmentIssue(row)) fail('Only shipped deliveries can have an issue reported.');
        if (command.action==='update') rows[command.index]={...row,issue:{...row.issue!,type:command.type!,notes:command.notes?.trim() ?? '',updatedAt:now,updatedBy:actorId}};
        else rows[command.index]={...row,issue:{id:row.issue?.id??crypto.randomUUID(),type:command.type!,notes:command.notes?.trim() ?? '',reportedAt:now,reportedBy:actorId,...(activeShipmentIssue(row)?.responses?{responses:row.issue!.responses}:{})}};
    } else if (command.action==='delete') {
        if (!row.issue) fail('This shipment has no issue to delete.');
        const {issue,...rest}=row;
        rows[command.index]={...rest,deletedIssues:[...(row.deletedIssues ?? []),{issue:issue!,deletedAt:now,deletedBy:actorId}]};
    } else if (command.action==='reopen') {
        if (!row.issue?.resolvedAt) fail('Only a resolved shipment issue can be reopened.');
        const {resolvedAt,resolvedBy,...issue}=row.issue!;
        rows[command.index]={...row,issue:{...issue,reopenedAt:now,reopenedBy:actorId}};
    } else if (command.action==='resolve' || command.action==='resolve-received') {
        if (!activeShipmentIssue(row)) fail('This shipment has no unresolved issue.');
        rows[command.index]={...row,issue:{...row.issue!,resolvedAt:now,resolvedBy:actorId}};
        if (command.action==='resolve-received' && typeof command.expectedReceipt!=='string') fail('Refresh receipt quantities before confirming.');
        if (command.action==='resolve-received') return confirmShipmentReceipts({...request,shipments:rows},[{index:command.index,key:command.key,receivedCases:command.receivedCases,receivedLooseUnits:command.receivedLooseUnits,damagedCases:command.damagedCases,damagedLooseUnits:command.damagedLooseUnits,expectedReceipt:command.expectedReceipt}],actorId,now);
    } else if (command.action==='respond') {
        if (!activeShipmentIssue(row)) fail('This shipment has no unresolved issue.');
        if (typeof command.notes!=='string' || !command.notes.trim() || command.notes.length>4000) fail('Enter a response of 4,000 characters or fewer.');
        rows[command.index]={...row,issue:{...row.issue!,responses:[...(row.issue!.responses ?? []),{notes:command.notes!.trim(),createdAt:now,createdBy:actorId}]}};
    } else fail('Select a valid shipment issue action.');
    return {shipments:rows,...shipmentIssueSummary(request,rows)};
}
