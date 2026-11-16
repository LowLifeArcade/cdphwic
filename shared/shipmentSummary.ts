import type {RequestRecord} from './domain';
import {formatDisplayDate} from './requestPresentation';
import {shipmentFormulaLabel} from './shipmentFormulas';
import {shipmentQuantities,formatShipmentUnits} from './shipmentQuantities';
import {requestShipments,type RequestShipment} from './requestShipments';
import {shipmentDispatched,shipmentReceived} from './shipmentReceipts';

export function compactShipmentSummary(request:Partial<RequestRecord>,row:RequestShipment) {
 const quantities=shipmentQuantities(request,row);
 const quantity=formatShipmentUnits(quantities.expectedUnits,quantities.size);
 let status='Awaiting shipment';
 if(row.issue&&!row.issue.resolvedAt)status='Shipment issue';
 else if(row.replacedAt)status='Replaced';
 else if(shipmentReceived(request,row))status='Received';
 else if(quantities.receivedUnits>0)status=`Partially received · ${formatShipmentUnits(quantities.receivedUnits,quantities.size)} of ${quantity}`;
 else if(shipmentDispatched(request,row))status=row.eta?`In transit · ETA ${formatDisplayDate(row.eta)}`:'In transit';
 return {formula:shipmentFormulaLabel(row.shipmentFormula ?? (requestShipments(request).length===1?requestShipments(request)[0]?.shipmentFormula:undefined)),quantity,status};
}
