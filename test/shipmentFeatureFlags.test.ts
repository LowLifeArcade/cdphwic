import {it,expect} from 'vitest';
import {shipmentFeatureFlags,shipmentCaseActionEnabled,shipmentFeatureDefaults} from '../shared/featureFlags';
it('disables over-delivery tracking and case reconciliation by default',()=>{
 expect(shipmentFeatureFlags(shipmentFeatureDefaults)).toEqual({casesShipped:true,receiptQuantities:true,quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
 expect(shipmentFeatureFlags({})).toEqual({casesShipped:true,receiptQuantities:true,quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
 expect(shipmentFeatureFlags({shipmentPotentialOverDelivery:'false',shipmentCaseReconciliation:'false'})).toEqual({casesShipped:true,receiptQuantities:true,quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
});
it('allows independent explicit flags and gates reconciliation mutations',()=>{
 const flags=shipmentFeatureFlags({shipmentQuantityTracking:true,shipmentPotentialOverDelivery:'true',shipmentCaseReconciliation:true});expect(flags).toEqual({casesShipped:true,receiptQuantities:true,quantityTracking:true,potentialOverDelivery:true,caseReconciliation:true});
 for(const action of ['returned','destroyed','received-count'])expect(shipmentCaseActionEnabled(action,shipmentFeatureFlags({}))).toBe(false);
 for(const action of ['replacement','close-replaced'])expect(shipmentCaseActionEnabled(action,shipmentFeatureFlags({}))).toBe(false);
 expect(shipmentCaseActionEnabled('returned',flags)).toBe(true);
});

it('keeps reconciliation and overage disabled while receipts remain available',()=>{
 const flags=shipmentFeatureFlags({shipmentQuantityTracking:false,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true});
 expect(flags).toEqual({casesShipped:true,receiptQuantities:true,quantityTracking:false,caseReconciliation:false,potentialOverDelivery:false});
 for(const action of ['replacement','close-replaced','returned','destroyed','received-count'])expect(shipmentCaseActionEnabled(action,flags)).toBe(false);
});

it('can disable receipt quantities independently',()=>{expect(shipmentFeatureFlags({shipmentReceiptQuantities:false}).receiptQuantities).toBe(false);expect(shipmentFeatureFlags({shipmentReceiptQuantities:'false'}).receiptQuantities).toBe(false);});

it('controls Cases Shipped independently of reconciliation and overage',()=>{
 const flags=shipmentFeatureFlags({shipmentCasesShipped:true,shipmentQuantityTracking:false});
 expect(flags.casesShipped).toBe(true);expect(flags.caseReconciliation).toBe(false);expect(flags.potentialOverDelivery).toBe(false);
 expect(shipmentFeatureFlags({shipmentCasesShipped:false,shipmentQuantityTracking:true}).casesShipped).toBe(false);
 expect(shipmentFeatureFlags({shipmentCasesShipped:'false'}).casesShipped).toBe(false);
});
