export interface ShipmentFeatures {quantityTracking:boolean;potentialOverDelivery:boolean;caseReconciliation:boolean}
export const shipmentFeatureDefaults={shipmentQuantityTracking:false,shipmentPotentialOverDelivery:false,shipmentCaseReconciliation:false};
const enabled=(value:unknown)=>value===true||value==='true';
export function shipmentFeatureFlags(config:Record<string,unknown>):ShipmentFeatures {const quantityTracking=enabled(config.shipmentQuantityTracking);return {quantityTracking,potentialOverDelivery:quantityTracking&&enabled(config.shipmentPotentialOverDelivery),caseReconciliation:quantityTracking&&enabled(config.shipmentCaseReconciliation)};}
export function shipmentCaseActionEnabled(action:string,flags:ShipmentFeatures):boolean {return flags.quantityTracking && (!['received-count','returned','destroyed'].includes(action)||flags.caseReconciliation);}
