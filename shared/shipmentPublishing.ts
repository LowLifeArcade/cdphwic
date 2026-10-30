import type {RequestRecord} from './domain';
import {requestShipments,type RequestShipment} from './requestShipments';
import {shipmentReceived} from './shipmentReceipts';
export function shipmentPlan(row:RequestShipment) {
 return {shipmentFormula:row.shipmentFormula,unitsToTransfer:row.unitsToTransfer,shipmentSource:row.shipmentSource,sourceAgencyId:row.sourceAgencyId,sourceLotId:row.sourceLotId,eta:row.eta,casesShipped:row.casesShipped,carrier:row.carrier,trackingNumbers:row.trackingNumbers,unitsPerCase:row.unitsPerCase,distributorId:row.distributorId,supplier:row.supplier,looseUnitsShipped:row.looseUnitsShipped};
}
export function shipmentHasUnsentChanges(row:RequestShipment,published?:RequestShipment) {
 return !published?.etaSentAt || JSON.stringify(shipmentPlan(row))!==JSON.stringify(shipmentPlan(published));
}
export function staffShipmentRows(request:RequestRecord):RequestShipment[] {
 const published=requestShipments(request);
 const rows=request.shipmentDrafts?[...request.shipmentDrafts,...published.slice(request.shipmentDrafts.length)]:published;
 return rows.map((row,index)=>{
  const old=published[index];
  if(old && (shipmentReceived(request,old)||old.receivedCases!==undefined||old.issue||old.deletedIssues?.length))return {...old,trackingNumbers:[...old.trackingNumbers]};
  return {...old,...shipmentPlan(row),etaSentAt:old?.etaSentAt,trackingNumbers:[...row.trackingNumbers]};
 });
}
export function withoutShipmentDrafts<T extends Partial<RequestRecord>>(request:T):T {
 const {shipmentDrafts,deletedShipments,...publicRequest}=request;
 return publicRequest as T;
}
