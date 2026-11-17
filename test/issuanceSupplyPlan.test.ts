import {expect,it} from 'vitest';
import {issuanceSupplyPlan} from '../shared/issuanceSupply';
import type {FormulaAuthorization} from '../shared/formulaAuthorizations';
const formula={productName:'Fortini',productForm:'ready-to-feed' as const};
const row:FormulaAuthorization={...formula,totalUnitsIssued:18,benefitIssuances:[]};
const transfer={shipmentSource:'agency' as const,sourceLotId:'lot',casesShipped:0,unitsToTransfer:2,eta:'',carrier:'agency' as const,trackingNumbers:[]};
it('rounds eighteen needed units to five four-unit cases and shows two surplus units',()=>{
 expect(issuanceSupplyPlan(formula,row,4)).toMatchObject({total:18,local:0,transferred:0,needed:18,cases:5,orderedUnits:20,surplus:2});
});
it('updates the order plan from draft local surplus and transfer allocations',()=>{
 expect(issuanceSupplyPlan({...formula,shipments:[transfer]},{...row,localSurplusAllocations:[{lotId:'local',units:4}]},4)).toMatchObject({needed:12,cases:3,orderedUnits:12,surplus:0});
});
it('excludes other formulas, unselected transfer drafts, and replacement transfers',()=>{
 const shipments=[{...transfer,shipmentFormula:{productName:'Other',productForm:'powder' as const}},{...transfer,sourceLotId:undefined},{...transfer,replacementFor:0}];
 expect(issuanceSupplyPlan({...formula,shipments},row,4).transferred).toBe(0);
});
it('does not invent a case conversion when size is unknown',()=>{
 expect(issuanceSupplyPlan(formula,row)).toMatchObject({needed:18,cases:undefined,orderedUnits:undefined,surplus:undefined});
});
it('does not order more units when allocated stock exceeds the approved total',()=>{
 expect(issuanceSupplyPlan(formula,{...row,localSurplusAllocations:[{lotId:'local',units:20}]},4)).toMatchObject({needed:0,cases:0,orderedUnits:0,surplus:2});
});
