import {shipmentQuantities,shipmentUnitSize,receiptQuantityKey,inputShipmentUnits,validUnitSize} from './shipmentQuantities';
import type {RequestRecord} from './domain';
import {blankShipment,requestShipments,type RequestShipment} from './requestShipments';
import {shipmentDispatched,shipmentReceived,shipmentReceiptKey,shipmentFinished,confirmShipmentReceipts} from './shipmentReceipts';
import {shipmentIssueSummary} from './shipmentIssues';
export interface ShipmentCaseCommand {index:number;key:string;expectedCases:string;expectedReplacements?:number;action:'replacement'|'received-count'|'returned'|'destroyed'|'close-replaced';cases?:number;looseUnits?:number;fromDamaged?:boolean;notes?:string}
export function shipmentReceivedCases(request:Partial<RequestRecord>,row:RequestShipment):number {const q=shipmentQuantities(request,row);return q.receivedUnits/q.size;}
export function shipmentDisposedCases(row:RequestShipment):number {const q=shipmentQuantities({},row);return q.disposedUnits/q.size;}
export function shipmentCaseKey(row:RequestShipment):string {return receiptQuantityKey(row);}
export function caseBalance(request:Partial<RequestRecord>) {
    const rows=requestShipments(request);
    const received=rows.reduce((sum,row)=>sum+shipmentReceivedCases(request,row),0);
    const disposed=rows.reduce((sum,row)=>sum+shipmentDisposedCases(row),0);
    const damaged=rows.reduce((sum,row)=>{const q=shipmentQuantities(request,row);return sum+q.damagedHeldUnits/q.size;},0);
    const approved=request.originalApprovedCases ?? request.approvedCases;
    const hasApproval=typeof approved==='number' && Number.isFinite(approved) && approved>=0;
    const outstanding=rows.filter(row=>!shipmentFinished(request,row)).reduce((sum,row)=>sum+Math.max(0,shipmentQuantities(request,row).missingUnits/shipmentUnitSize(row)),0);
    return {outstanding,projectedExcess:hasApproval?(received-disposed-damaged+outstanding-approved>1e-9?received-disposed-damaged+outstanding-approved:0):0,received,disposed,damaged,retained:received-disposed-damaged,approved:hasApproval?approved:undefined,excess:hasApproval?(received-disposed-damaged-approved>1e-9?received-disposed-damaged-approved:0):0,needsApproval:!hasApproval && rows.some(row=>shipmentDispatched(request,row)||row.replacementFor!==undefined)};
}
export function originalCaseApproval(request:Partial<RequestRecord>):number|undefined {
    const approved=request.originalApprovedCases ?? request.approvedCases;
    return typeof approved==='number' && Number.isFinite(approved) && approved>=0?approved:undefined;
}
export function shipmentListSummary(request:Partial<RequestRecord>,today:string) {
    const hasShipment=!!request.shipments?.length || !!request.eta || !!request.trackingNumbers?.length || !!request.unitsIssued;
    const rows=hasShipment?requestShipments(request):[];
    const received=rows.filter(row=>shipmentReceived(request,row)).length;
    const pending=rows.filter(row=>!shipmentFinished(request,row));
    const replaced=rows.filter(row=>row.replacedAt && !shipmentReceived(request,row)).length;
    const nextEta=pending.filter(row=>shipmentDispatched(request,row)).map(row=>row.eta).filter(Boolean).sort()[0] ?? '';
    return {total:rows.length,received,replaced,awaiting:pending.length,nextEta,overdue:!!nextEta && nextEta<today};
}
export function applyShipmentCaseCommand(request:RequestRecord,command:ShipmentCaseCommand,actorId:number,now=new Date().toISOString()):Partial<RequestRecord> {
    const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
    const rows=requestShipments(request);
    if (!command || !Number.isSafeInteger(command.index) || command.index<0 || !rows[command.index]) fail('Select a valid shipment.');
    const row=rows[command.index]!;
    if (shipmentReceiptKey(row)!==command.key || shipmentCaseKey(row)!==command.expectedCases) fail('Shipment case details have changed. Refresh before saving.');
    let shipments=rows;
    if (command.action==='replacement') {
        if (command.expectedReplacements!==rows.filter(r=>r.replacementFor===command.index).length) fail('Replacement shipments have changed. Refresh before creating another.');
        if (!row.issue) fail('Report the shipping issue before creating its replacement.');
        shipments=rows.map(r=>({...r,dispatched:shipmentDispatched(request,r),...(shipmentReceived(request,r)?{receiptConfirmed:true}:{})}));
        shipments.push({...blankShipment(),shipmentFormula:row.shipmentFormula,carrier:row.carrier,supplier:row.supplier,distributorId:row.distributorId,distributorPolicy:row.distributorPolicy,unitsPerCase:row.unitsPerCase,replacementBasis:row.distributorPolicy?.replacementBasis,replacementIssueId:row.issue?.id??`${request.id}:${command.index}:${row.issue!.reportedAt}`,replacementFor:command.index,dispatched:false});
    } else if (command.action==='close-replaced') {
        if (shipmentReceived(request,row) || row.replacedAt) fail('Only an unreceived original shipment can be closed as replaced.');
        if (!rows.some(r=>r.replacementFor===command.index && (r.replacedAt || (shipmentReceived(request,r) && shipmentQuantities(request,r).usableUnits>0)))) fail('Receive a linked replacement before closing the original.');
        if (typeof command.notes!=='string' || !command.notes.trim() || command.notes.length>4000) fail('Document why the original shipment is being closed as replaced.');
        shipments=rows.map((r,index)=>index===command.index?{...r,dispatched:shipmentDispatched(request,r),replacedAt:now,replacedBy:actorId,replacementClosureNote:command.notes!.trim(),...(r.issue && !r.issue.resolvedAt?{issue:{...r.issue,resolvedAt:now,resolvedBy:actorId}}:{})}:r);
        return {shipments,...(originalCaseApproval(request)!==undefined?{originalApprovedCases:originalCaseApproval(request)}:{}),...shipmentIssueSummary({...request,shipments,receivedStatus:'shipped'},shipments)};
    } else {
        if (!shipmentDispatched(request,row)) fail('Record cases only for a shipped delivery.');
        const units=inputShipmentUnits(row,command.cases,command.looseUnits ?? 0);
        if (typeof command.notes!=='string' || !command.notes.trim() || command.notes.length>4000) fail('Enter notes or a document reference of 4,000 characters or fewer.');
        const quantity=shipmentQuantities(request,row);
        if (command.action==='received-count') {
            const damage=row.damagedUnits ?? 0;const size=shipmentUnitSize(row);
            const update=confirmShipmentReceipts(request,[{index:command.index,key:command.key,expectedReceipt:command.expectedCases,receivedCases:command.cases,receivedLooseUnits:command.looseUnits ?? 0,damagedCases:Math.floor(damage/size),damagedLooseUnits:damage%size}],actorId,now);
            const last=update.shipments![command.index]!.receiptCountHistory!.at(-1)!;last.notes=command.notes!.trim();
            return {...update,...(originalCaseApproval(request)!==undefined?{originalApprovedCases:originalCaseApproval(request)}:{})};
        } else if (command.action==='returned' || command.action==='destroyed') {
            const damagedRemoved=command.fromDamaged?Math.min(units,quantity.damagedHeldUnits):0;
            if (!units || units>quantity.receivedUnits-quantity.disposedUnits || units-damagedRemoved>quantity.usableUnits) fail('The disposition exceeds the available usable/damaged product.');
            shipments=rows.map((r,index)=>index===command.index?{...r,dispositions:[...(r.dispositions ?? []),{kind:command.action as 'returned'|'destroyed',cases:command.cases!,looseUnits:command.looseUnits ?? 0,...(validUnitSize(row.unitsPerCase)?{units,damagedUnits:damagedRemoved}:{}),notes:command.notes!.trim(),recordedAt:now,recordedBy:actorId}]}:r);
        } else fail('Select a valid case tracking action.');
    }
    const originalApprovedCases=originalCaseApproval(request);
    if (command.action==='replacement') return {shipments,...(originalApprovedCases!==undefined?{originalApprovedCases}:{}),...shipmentIssueSummary({...request,shipments,receivedStatus:'shipped'},shipments)};
    return {shipments,...(originalApprovedCases!==undefined?{originalApprovedCases}:{})};
}
