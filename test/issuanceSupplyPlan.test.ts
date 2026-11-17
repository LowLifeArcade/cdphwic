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

it('recommends remaining distributor cases before Shipping and includes projected surplus',async()=>{
 const {remainingSupplyOrder}=await import('../shared/issuanceSupply');
 expect(remainingSupplyOrder(formula,row,4)).toMatchObject({needed:18,cases:5,orderUnits:20,surplus:2});
 const allocated={...row,localSurplusAllocations:[{lotId:'local',units:4}]};
 expect(remainingSupplyOrder({...formula,shipments:[transfer]},allocated,4)).toMatchObject({needed:12,cases:3,orderUnits:12,surplus:0});
});
it('subtracts recorded distributor units and keeps a visible zero recommendation when covered',async()=>{
 const {remainingSupplyOrder}=await import('../shared/issuanceSupply');
 const shipment={casesShipped:2,unitsPerCase:4,eta:'',etaSentAt:'2026-11-17',carrier:'ups' as const,trackingNumbers:[]};
 expect(remainingSupplyOrder({...formula,shipments:[shipment]},row,4)).toMatchObject({needed:10,cases:3,orderUnits:12,surplus:2});
 expect(remainingSupplyOrder({...formula,shipments:[{...shipment,casesShipped:5}]},row,4)).toMatchObject({needed:0,cases:0,orderUnits:0,surplus:2});
});
it('withholds recommendations if a recorded source has an unknown unit quantity',async()=>{
 const {remainingSupplyOrder}=await import('../shared/issuanceSupply');
 const shipment={casesShipped:1,eta:'',etaSentAt:'now',carrier:'ups' as const,trackingNumbers:[]};
 expect(remainingSupplyOrder({...formula,shipments:[shipment]},row)).toMatchObject({cases:undefined,orderUnits:undefined,surplus:undefined});
});

it('shows draft coverage without reducing the recommended supply before Send ETA',async()=>{
 const {remainingSupplyOrder}=await import('../shared/issuanceSupply');
 const shipment={supplier:'McKesson',shipmentSource:'distributor' as const,casesShipped:5,unitsPerCase:4,eta:'',carrier:'ups' as const,trackingNumbers:[]};
 expect(remainingSupplyOrder({...formula,shipments:[shipment]},row,4)).toMatchObject({needed:18,cases:5,orderUnits:20,stillToPlan:0,supply:{plannedUnits:20,pending:18}});
});
it('keeps published quantities separate from an unsent edit to that shipment',async()=>{
 const {remainingSupplyOrder}=await import('../shared/issuanceSupply');
 const published={supplier:'McKesson',shipmentSource:'distributor' as const,casesShipped:2,unitsPerCase:4,eta:'',etaSentAt:'now',carrier:'ups' as const,trackingNumbers:[]};
 const result=remainingSupplyOrder({...formula,shipments:[{...published,casesShipped:5}]},row,4,[published]);
 expect(result).toMatchObject({needed:10,cases:3,orderUnits:12,stillToPlan:0,supply:{plannedUnits:12}});
 expect(result.supply.rows.filter(source=>source.kind==='distributor')).toMatchObject([{units:8,stage:'eta-sent'},{units:20,stage:'planned',draftUpdate:true}]);
});
