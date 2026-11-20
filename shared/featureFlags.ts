export interface ShipmentFeatures {casesShipped:boolean;receiptQuantities:boolean;quantityTracking:boolean;potentialOverDelivery:boolean;caseReconciliation:boolean;compactRows:boolean;splitOrderTypes:boolean}
export const shipmentFeatureDefaults={shipmentCasesShipped:true,shipmentReceiptQuantities:true,shipmentQuantityTracking:false,shipmentPotentialOverDelivery:false,shipmentCaseReconciliation:false,shipmentCompactRows:false,shipmentSplitOrderTypes:false};
const enabled=(value:unknown)=>value===true||value==='true';
export function shipmentFeatureFlags(config:Record<string,unknown>):ShipmentFeatures {const quantityTracking=enabled(config.shipmentQuantityTracking);return {casesShipped:config.shipmentCasesShipped===undefined?true:enabled(config.shipmentCasesShipped),receiptQuantities:config.shipmentReceiptQuantities===undefined?true:enabled(config.shipmentReceiptQuantities),quantityTracking,potentialOverDelivery:quantityTracking&&enabled(config.shipmentPotentialOverDelivery),caseReconciliation:quantityTracking&&enabled(config.shipmentCaseReconciliation),compactRows:enabled(config.shipmentCompactRows),splitOrderTypes:enabled(config.shipmentSplitOrderTypes)};}
export function shipmentCaseActionEnabled(action:string,flags:ShipmentFeatures):boolean {return flags.quantityTracking && (!['received-count','returned','destroyed'].includes(action)||flags.caseReconciliation);}

export const reportFeatureDefaults = { mckessonReport: false };
export function reportFeatureFlags(config: Record<string, unknown>) {
    return { mckessonReport: enabled(config.mckessonReport) };
}
