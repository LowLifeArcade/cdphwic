import {shipmentQuantities,inputShipmentUnits,receiptQuantityKey,validUnitSize} from './shipmentQuantities';
import type {RequestRecord} from './domain';
import {requestShipments,type RequestShipment} from './requestShipments';
export interface ShipmentReceiptSelection {index:number; key:string;catalogUnitsPerCase?:number;receivedCases?:number;receivedLooseUnits?:number;damagedCases?:number;damagedLooseUnits?:number;expectedReceipt?:string;expectedIssue?:string;issueNotes?:string}
export function shipmentReceiptKey(row:RequestShipment):string {
    return JSON.stringify([row.eta,row.carrier,row.casesShipped,row.trackingNumbers,row.etaSentAt ?? '',row.supplier ?? '',row.unitsPerCase ?? null,row.looseUnitsShipped??0]);
}
export function shipmentReceived(request:Partial<RequestRecord>,row:RequestShipment):boolean {
    const confirmed=!!row.receivedAt || !!row.receiptConfirmed || (request.receivedStatus==='received' && !request.shipments?.some(r=>r.receivedAt || r.receiptConfirmed || r.receivedUnits!==undefined));
    return confirmed && (row.receiptMode==='simple' || shipmentQuantities(request,row).missingUnits===0);
}
export function shipmentFinished(request:Partial<RequestRecord>,row:RequestShipment):boolean {return shipmentReceived(request,row) || !!row.replacedAt;}
export function shipmentDispatched(request:Partial<RequestRecord>,row:RequestShipment):boolean {
    if (row.etaSentAt || row.dispatched || shipmentReceived(request,row)) return true;
    if (row.dispatched===false) return false;
    const legacyShipped=['shipped','damaged','missing'].includes(request.status ?? '') || (request.status==='needs_info' && request.receivedStatus==='incomplete');
    return legacyShipped && !request.shipments?.some(s=>s.etaSentAt || s.dispatched!==undefined);
}
export function canConfirmShipment(request:Partial<RequestRecord>,row:RequestShipment):boolean {
    return !shipmentReceived(request,row) && shipmentDispatched(request,row);
}
export function confirmShipmentReceipts(request:RequestRecord,selections:ShipmentReceiptSelection[],actorId:number,now=new Date().toISOString()):Partial<RequestRecord> {
    const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
    if (!Array.isArray(selections) || !selections.length) fail('Select at least one shipment to confirm.');
    const rows=requestShipments(request).map(row=>({...row,dispatched:shipmentDispatched(request,row)}));
    for (const selection of selections) {
        if (!selection || !Number.isSafeInteger(selection.index) || selection.index<0 || !rows[selection.index] || shipmentReceiptKey(rows[selection.index]!)!==selection.key) fail('A selected shipment has changed. Refresh and select it again.');
        const row=rows[selection.index]!;
        if (selection.expectedReceipt!==undefined && selection.expectedReceipt!==receiptQuantityKey(row)) fail('Receipt quantities have changed. Refresh before confirming.');
        if (selection.issueNotes!==undefined && (typeof selection.issueNotes!=='string'||selection.issueNotes.length>4000)) fail('Issue notes must be 4,000 characters or fewer.');
        if (selection.issueNotes!==undefined && selection.expectedIssue!==JSON.stringify(row.issue??null)) fail('Shipment issue details changed. Refresh before confirming receipt.');
        if (!shipmentDispatched(request,row)) fail('Only shipped deliveries can be confirmed.');
        const units=inputShipmentUnits(row,selection.receivedCases,selection.receivedLooseUnits ?? 0);
        const damaged=inputShipmentUnits(row,selection.damagedCases ?? 0,selection.damagedLooseUnits ?? 0);
        if (damaged && !validUnitSize(row.unitsPerCase)) fail('CDPH/WIC must confirm Units per Case before recording damaged product.');
        const existing=shipmentQuantities(request,row);
        if (damaged>units || units<existing.disposedUnits || damaged<existing.disposedDamagedUnits || units-existing.disposedUnits-Math.max(0,damaged-existing.disposedDamagedUnits)<0) fail('Received and damaged quantities must include all documented returns/destruction, without exceeding the received total.');
    }
    const shipments=rows.map((row,index)=>{
        const selection=selections.find(s=>s.index===index);
        if (!selection) return row;
        const units=inputShipmentUnits(row,selection.receivedCases,selection.receivedLooseUnits ?? 0);
        const damaged=inputShipmentUnits(row,selection.damagedCases ?? 0,selection.damagedLooseUnits ?? 0);
        const size=validUnitSize(row.unitsPerCase)?row.unitsPerCase:1;
        let next={...row,receivedAt:row.receivedAt ?? now,receiptConfirmed:true,receiptMode:'quantity',receivedBy:actorId,receivedCases:units/size,...(validUnitSize(row.unitsPerCase)?{receivedUnits:units,damagedUnits:damaged}:{}),receiptCountHistory:[...(row.receiptCountHistory ?? []),{cases:selection.receivedCases!,...(validUnitSize(row.unitsPerCase)?{looseUnits:selection.receivedLooseUnits ?? 0,units,damagedUnits:damaged,unitsPerCase:size}:{}),notes:selection.issueNotes?.trim() || 'Receipt quantity confirmed',recordedAt:now,recordedBy:actorId}]} as RequestShipment;
        const quantities=shipmentQuantities({...request,shipments:rows},next);
        const managed=next.issue?.source==='receipt-quantity' || selection.issueNotes!==undefined;
        if (quantities.missingUnits>0 || quantities.damagedHeldUnits>0) {
            if (!next.issue || next.issue.resolvedAt || managed) {
                const {resolvedAt,resolvedBy,...prior}=next.issue ?? {};
                next={...next,issue:{...prior,id:prior.id??crypto.randomUUID(),source:'receipt-quantity',type:quantities.damagedHeldUnits?'damaged':'incomplete',notes:selection.issueNotes!==undefined?selection.issueNotes.trim():prior.notes || 'Quantity discrepancy reported at receipt.',reportedAt:prior.reportedAt ?? now,reportedBy:prior.reportedBy ?? actorId,...(prior.id?{updatedAt:now,updatedBy:actorId}:{}),...(resolvedAt?{reopenedAt:now,reopenedBy:actorId}:{})}};
            }
        } else if (next.issue && managed) next={...next,issue:{...next.issue,...(selection.issueNotes!==undefined?{notes:selection.issueNotes.trim(),updatedAt:now,updatedBy:actorId}:{}),resolvedAt:next.issue.resolvedAt??now,resolvedBy:next.issue.resolvedBy??actorId}};
        return next;
    });
    const allReceived=shipments.every(row=>shipmentFinished(request,row));
    const issue=shipments.find(row=>row.issue && !row.issue.resolvedAt)?.issue;
    if (issue) return {shipments,status:issue.type==='incomplete'?'needs_info':issue.type,receivedStatus:issue.type};
    return {shipments,status:allReceived?'complete':shipments.every(row=>shipmentDispatched(request,row))?'shipped':'in_progress',receivedStatus:allReceived?'received':'shipped'};
}

export function preserveShipmentReceipts(previous:RequestRecord,rows:RequestShipment[]):RequestShipment[] {
    const originals=requestShipments(previous);
    const shippingCore=(row:RequestShipment)=>JSON.stringify([row.eta,row.casesShipped,row.carrier,row.trackingNumbers,row.etaSentAt ?? '',row.looseUnitsShipped??0]);
    if (originals.some((row,index)=>(shipmentReceived(previous,row) || row.issue || row.deletedIssues?.length || row.receivedCases!==undefined || row.dispositions?.length) && (!rows[index] || shippingCore(rows[index]!)!==shippingCore(row)))) {
        const message='Received shipments and shipments with reported issues cannot be changed or removed.';
        throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});
    }
    for (const [index,row] of rows.entries()) {
        const old=originals[index];
        if (old && (old.receivedUnits!==undefined || old.dispositions?.some(d=>d.units!==undefined) || (validUnitSize(old.unitsPerCase) && (old.receivedCases!==undefined || old.receivedAt || old.receiptConfirmed))) && old.unitsPerCase!==row.unitsPerCase) throw Object.assign(new Error('Units per Case is locked after unit quantities are recorded. Preserve the shipment packaging snapshot.'),{statusCode:409});
        if (row.replacementFor!==originals[index]?.replacementFor) throw Object.assign(new Error('Replacement links cannot be changed. Save without moving replacement shipments.'),{statusCode:409});
    }
    return rows.map((row,index)=>{
        const original=originals[index];
        row={...row,receiptMode:original?.receiptMode,replacementBasis:original?.replacementFor!==undefined && !shipmentReceived(previous,original) && original.receivedCases===undefined && !original.receivedAt && !original.issue && !original.deletedIssues?.length?row.distributorPolicy?.replacementBasis:original?.replacementBasis,replacementIssueId:original?.replacementIssueId,policyHistory:row.policyHistory??original?.policyHistory,...(original && (shipmentReceived(previous,original)||original.receivedAt||original.receivedCases!==undefined||original.issue||original.deletedIssues?.length||((original.etaSentAt||original.dispatched)&&row.distributorId===original.distributorId))?{distributorId:original.distributorId,distributorPolicy:original.distributorPolicy}:{} )};
        return original && shipmentReceived(previous,original) ? {...row,receivedUnits:original.receivedUnits ?? row.receivedUnits,damagedUnits:original.damagedUnits ?? row.damagedUnits,replacedAt:original.replacedAt,replacedBy:original.replacedBy,replacementClosureNote:original.replacementClosureNote,replacementFor:original.replacementFor,receivedCases:original.receivedCases ?? row.receivedCases,dispositions:original.dispositions,receiptCountHistory:original.receiptCountHistory,issue:original.issue,deletedIssues:original.deletedIssues,dispatched:original.dispatched,receiptConfirmed:true,receivedAt:original.receivedAt,receivedBy:original.receivedBy} : {...row,receivedUnits:original?.receivedUnits ?? row.receivedUnits,damagedUnits:original?.damagedUnits ?? row.damagedUnits,replacedAt:original?.replacedAt,replacedBy:original?.replacedBy,replacementClosureNote:original?.replacementClosureNote,replacementFor:original?.replacementFor,receivedCases:original?.receivedCases ?? row.receivedCases,dispositions:original?.dispositions,receiptCountHistory:original?.receiptCountHistory,issue:original?.issue,deletedIssues:original?.deletedIssues,dispatched:original?.dispatched};
    });
}
