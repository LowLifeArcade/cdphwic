import {it,expect} from 'vitest';
import {shipmentFeatureFlags,shipmentCaseActionEnabled,shipmentFeatureDefaults} from '../shared/featureFlags';
it('disables over-delivery tracking and case reconciliation by default',()=>{
 expect(shipmentFeatureFlags(shipmentFeatureDefaults)).toEqual({quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
 expect(shipmentFeatureFlags({})).toEqual({quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
 expect(shipmentFeatureFlags({shipmentPotentialOverDelivery:'false',shipmentCaseReconciliation:'false'})).toEqual({quantityTracking:false,potentialOverDelivery:false,caseReconciliation:false});
});
it('allows independent explicit flags and gates reconciliation mutations',()=>{
 const flags=shipmentFeatureFlags({shipmentQuantityTracking:true,shipmentPotentialOverDelivery:'true',shipmentCaseReconciliation:true});expect(flags).toEqual({quantityTracking:true,potentialOverDelivery:true,caseReconciliation:true});
 for(const action of ['returned','destroyed','received-count'])expect(shipmentCaseActionEnabled(action,shipmentFeatureFlags({}))).toBe(false);
 for(const action of ['replacement','close-replaced'])expect(shipmentCaseActionEnabled(action,shipmentFeatureFlags({}))).toBe(false);
 expect(shipmentCaseActionEnabled('returned',flags)).toBe(true);
});

it('keeps every detailed feature disabled when the master flag is off',()=>{
 const flags=shipmentFeatureFlags({shipmentQuantityTracking:false,shipmentCaseReconciliation:true,shipmentPotentialOverDelivery:true});
 expect(flags).toEqual({quantityTracking:false,caseReconciliation:false,potentialOverDelivery:false});
 for(const action of ['replacement','close-replaced','returned','destroyed','received-count'])expect(shipmentCaseActionEnabled(action,flags)).toBe(false);
});
