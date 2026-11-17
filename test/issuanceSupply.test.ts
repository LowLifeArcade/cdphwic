import {expect,it} from 'vitest';
import {issuanceSupply} from '../shared/issuanceSupply';
import type {RequestRecord} from '../shared/domain';
import type {FormulaAuthorization} from '../shared/formulaAuthorizations';
const formula={productName:'Fortini',productForm:'ready-to-feed' as const};
const authorization:FormulaAuthorization={...formula,totalUnitsIssued:18,unitsPerCase:4,benefitIssuances:[{month:'2026-11',quantity:18}]};
const order={casesShipped:5,unitsPerCase:4,carrier:'ups' as const,trackingNumbers:['ONE'],etaSentAt:'2026-11-17'};
const request=(shipments:RequestRecord['shipments']):Partial<RequestRecord>=>({...formula,shipments});
it('shows five ordered cases and deducts two excess units from eighteen approved',()=>{
 expect(issuanceSupply(request([order]),authorization)).toMatchObject({orderedCases:5,orderedUnits:20,orderedLooseUnits:0,orderSizes:[4],surplus:2,pending:0,total:18});
});
it('adds local surplus, authorized transfers, and distributor orders without counting replacements',()=>{
 const row={...authorization,totalUnitsIssued:54,localSurplusAllocations:[{lotId:'local',units:12}]};
 const shipments=[{...order,casesShipped:6},{...order,shipmentSource:'agency' as const,transferId:'transfer',unitsToTransfer:18},{...order,replacementFor:0}];
 expect(issuanceSupply(request(shipments),row)).toMatchObject({local:12,transferred:18,orderedUnits:24,pending:0,surplus:0,total:54});
});
it('keeps unpublished shipments and unallocated units pending',()=>{
 expect(issuanceSupply(request([{...order,etaSentAt:undefined}]),authorization)).toMatchObject({orderedUnits:0,pending:18,surplus:0});
});
it('matches formulas and excludes unknown case sizes rather than inventing unit quantities',()=>{
 const other={...order,shipmentFormula:{productName:'Other',productForm:'powder' as const}};
 expect(issuanceSupply(request([other,{...order,unitsPerCase:undefined}]),{...authorization,unitsPerCase:undefined})).toMatchObject({orderedUnits:0,pending:18,unknownOrderSize:true});
});
it('uses confirmed authorization case size when shipment size is absent and includes loose units',()=>{
 expect(issuanceSupply(request([{...order,unitsPerCase:undefined,casesShipped:4,looseUnitsShipped:2}]),authorization)).toMatchObject({orderedCases:4,orderedLooseUnits:2,orderedUnits:18,surplus:0,pending:0});
});
