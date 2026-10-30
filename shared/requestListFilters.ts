import {shipmentQuantities} from './shipmentQuantities';
import {shipmentListSummary} from './shipmentCaseTracking';
import type {RequestRecord} from './domain';
import {requestShipments} from './requestShipments';
import {canConfirmShipment,shipmentReceived,shipmentFinished} from './shipmentReceipts';
export type DeliveryFilter='all'|'awaiting'|'partial'|'received'|'issue';
export type RequestTagFilter='all'|'new'|'extension'|'approved'|'special';
export type RequestListSort='eta'|'submitted'|'participant';
export function deliveryCategory(request:RequestRecord):Exclude<DeliveryFilter,'all'>|'none' {
    if (request.shipments?.some(row=>row.issue && !row.issue.resolvedAt)) return 'issue';
    if (['damaged','missing','incomplete'].includes(request.receivedStatus ?? '') || ['damaged','missing'].includes(request.status)) return 'issue';
    const rows=requestShipments(request);
    const received=rows.filter(row=>shipmentReceived(request,row)).length;
    if (rows.every(row=>shipmentFinished(request,row))) return 'received';
    if (received) return 'partial';
    return rows.some(row=>canConfirmShipment(request,row)) ? 'awaiting' : 'none';
}
export function filterAndSortRequests(requests:RequestRecord[],delivery:DeliveryFilter,tag:RequestTagFilter,sort:RequestListSort):RequestRecord[] {
    return requests.filter(r=>(delivery==='all'||deliveryCategory(r)===delivery||delivery==='partial' && requestShipments(r).some(row=>{const q=shipmentQuantities(r,row);return q.receivedUnits>0 && q.missingUnits>0;})) && (tag==='all'||tag==='new' && r.requestKind!=='extension'||tag==='extension' && r.requestKind==='extension'||tag==='approved' && r.approved||tag==='special' && r.specialOrder)).sort((a,b)=>{
        if (sort==='participant') return a.participantName.localeCompare(b.participantName)||a.id-b.id;
        if (sort==='submitted') return (b.submissionDate ?? '').localeCompare(a.submissionDate ?? '')||a.id-b.id;
        return (shipmentListSummary(a,'').nextEta || '9999').localeCompare(shipmentListSummary(b,'').nextEta || '9999')||a.id-b.id;
    });
}
