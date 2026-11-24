import {it,expect} from 'vitest';
import {issuanceSupply,issuanceSupplySources,remainingSupplyOrder,supplyCaseDetails} from '../shared/issuanceSupply';
const formula={productName:'Nutramigen',productForm:'powder' as const};
const authorization={...formula,totalUnitsIssued:18,unitsPerCase:4,localSurplusAllocations:[{lotId:'local',units:2}],benefitIssuances:[]};
const base={eta:'',carrier:'ups' as const,trackingNumbers:[],casesShipped:1,unitsPerCase:4,shipmentFormula:formula};
it('lists each source by name with distributor units and cases',()=>{
 const request={...formula,shipments:[{...base,shipmentSource:'agency' as const,transferId:'a',sourceAgencyName:'Mendocino County',unitsToTransfer:3},{...base,shipmentSource:'agency' as const,transferId:'b',sourceAgencyName:'Lake County',unitsToTransfer:1},{...base,shipmentSource:'distributor' as const,supplier:'McKesson',etaSentAt:'2026-11-17',dispatched:true,casesShipped:3},{...base,shipmentSource:'distributor' as const,supplier:'Second Distributor',etaSentAt:'2026-11-17',dispatched:true,casesShipped:1}]};
 expect(issuanceSupplySources(request,authorization).rows).toMatchObject([
  {label:'On Hand',units:2},
  {label:'Transfer from Mendocino',units:3},
  {label:'Transfer from Lake',units:1},
  {label:'Shipped from McKesson',units:12,cases:3,unitsPerCase:4},
  {label:'Shipped from Second Distributor',units:4,cases:1},
  {label:'Expected Surplus',units:4},
 ]);
});
it('omits replacements, unrelated formulas, and unpublished orders',()=>{
 const request={...formula,shipments:[{...base,supplier:'Replacement',etaSentAt:'now',replacementFor:0},{...base,supplier:'Other',etaSentAt:'now',shipmentFormula:{productName:'Other',productForm:'powder' as const}},{...base,supplier:'Unpublished'}]};
 expect(issuanceSupplySources(request,authorization).rows.map(row=>row.label)).toEqual(['On Hand','Expected Surplus']);
});
it('includes selected transfers only in the staff draft view',()=>{
 const request={...formula,shipments:[{...base,shipmentSource:'agency' as const,sourceLotId:'lot',sourceAgencyName:'Sonoma County',unitsToTransfer:1}]};
 expect(issuanceSupplySources(request,authorization).rows).toHaveLength(2);
 expect(issuanceSupplySources(request,authorization,true).rows[1]).toMatchObject({label:'Transfer from Sonoma',units:1,pending:true});
});
it('counts a transfer under the formula whose authorized catalog name differs from the request name', () => {
 const selected = {...authorization, formulaName:'Nutramigen Catalog Variant'};
 const other = {productName:'Fortini', productForm:'ready-to-feed' as const, benefitIssuances:[]};
 const shipment = {...base, shipmentFormula:{...formula,productName:selected.formulaName}, shipmentSource:'agency' as const, sourceLotId:'lot', unitsToTransfer:6};
 const request = {...formula, requestedFormulas:[{...formula,ouncesPrescribed:24},{productName:other.productName, productForm:other.productForm, ouncesPrescribed:24}], formulaAuthorizations:[selected,other], shipments:[shipment]};
 expect(remainingSupplyOrder(request,selected)).toMatchObject({needed:10,supply:{rows:expect.arrayContaining([expect.objectContaining({kind:'transfer',units:6,pending:true})])}});
 expect(issuanceSupplySources(request,other,true).rows.some(row=>row.kind==='transfer')).toBe(false);
 const reserved = {...request,shipments:[{...shipment,transferId:'reserved'}]};
 expect(issuanceSupply(reserved,selected).transferred).toBe(6);
 expect(issuanceSupplySources(reserved,selected).rows[1]).toMatchObject({kind:'transfer',units:6,pending:false});
});
it('shows unknown unit quantities without treating one case as one unit',()=>{
 const request={...formula,shipments:[{...base,unitsPerCase:undefined,supplier:'McKesson',etaSentAt:'now'}]};
 expect(issuanceSupplySources(request,{...authorization,unitsPerCase:undefined}).rows[1]).toMatchObject({label:'ETA sent for McKesson',units:undefined,cases:1});
});

it('keeps case packaging and loose units visible with correct singular labels',()=>{
 expect(supplyCaseDetails({key:'one',kind:'distributor',label:'Shipped from McKesson',units:7,cases:1,unitsPerCase:6,looseUnits:1})).toBe('1 Case x 6 Units + 1 loose Unit');
});

it('shows distributor drafts to staff without counting them as confirmed supply',()=>{
 const request={...formula,shipments:[{...base,shipmentSource:'distributor' as const,supplier:'McKesson',casesShipped:4}]};
 const result=issuanceSupplySources(request,authorization,true);
 expect(result.rows[1]).toMatchObject({label:'Planned from McKesson',units:16,pending:true,stage:'planned'});
 expect(result.pending).toBe(16);expect(result.plannedUnits).toBe(16);
 expect(issuanceSupplySources(request,authorization).rows).toHaveLength(2);
});
it('distinguishes ETA publication, a recorded order date, and actual dispatch',()=>{
 const shipment={...base,supplier:'McKesson',etaSentAt:'2026-11-17'};
 expect(issuanceSupplySources({...formula,shipments:[shipment]},authorization).rows[1]?.label).toBe('ETA sent for McKesson');
 expect(issuanceSupplySources({...formula,dateOrdered:'2026-11-17',shipments:[shipment]},authorization).rows[1]?.label).toBe('Ordered from McKesson');
 expect(issuanceSupplySources({...formula,shipments:[{...shipment,dispatched:true}]},authorization).rows[1]?.label).toBe('Shipped from McKesson');
 expect(issuanceSupplySources({...formula,shipments:[{...shipment,receiptConfirmed:true}]},authorization).rows[1]?.label).toBe('Shipped from McKesson');
});
