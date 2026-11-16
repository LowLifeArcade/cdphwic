import type {RequestRecord} from './domain';
import {formulaAuthorizations} from './formulaAuthorizations';
import {requestShipments,type RequestShipment} from './requestShipments';
import {resolveShipmentFormula,shipmentFormulaKey,shipmentFormulaLabel} from './shipmentFormulas';
import {shipmentDispatched} from './shipmentReceipts';
import {shipmentQuantities,shipmentUnitSize} from './shipmentQuantities';

export type FulfillmentType='standard'|'special';
export interface FulfillmentProgress {
 formula:string;
 standard:{allocated:number;shipped:number;received:number;pending:number};
 special:{allocated:number;shipped:number;received:number;pending:number};
}
export function hasSplitOrderAllocation(request:Partial<RequestRecord>):boolean {
 return !!request.formulaAuthorizations?.some(row=>(row.standardCases??0)>0&&(row.specialOrderCases??0)>0);
}
const allocatedCases=(authorization:ReturnType<typeof formulaAuthorizations>[number],type:FulfillmentType)=>type==='standard'?authorization.standardCases:authorization.specialOrderCases;
export function shipmentFulfillmentType(request:Partial<RequestRecord>,row:RequestShipment):FulfillmentType|undefined {
 if(row.fulfillmentType)return row.fulfillmentType;
 const formula=resolveShipmentFormula(request,row);if(!formula)return undefined;
 const authorization=formulaAuthorizations(request).find(candidate=>shipmentFormulaKey(candidate)===shipmentFormulaKey(formula));
 if(!authorization)return undefined;
 if((authorization.standardCases??0)>0&&(authorization.specialOrderCases??0)>0)return legacyFulfillmentType(request,formula);
 return (authorization.specialOrderCases??0)>0?'special':'standard';
}
export function validateShipmentAllocations(request:Partial<RequestRecord>,rows:RequestShipment[]):string {
 if(!hasSplitOrderAllocation(request)&&!rows.some(row=>row.fulfillmentType))return '';
 const authorizations=formulaAuthorizations({...request,shipments:rows});
 const used=new Map<string,{standard:number;special:number}>();
 for(const [index,row] of rows.entries()){
  if(row.replacementFor!==undefined)continue;
  const formula=resolveShipmentFormula(request,row);if(!formula)continue;
  const authorization=authorizations.find(candidate=>shipmentFormulaKey(candidate)===shipmentFormulaKey(formula));
  if(!authorization||authorization.standardCases===undefined||authorization.specialOrderCases===undefined)continue;
  const cases=row.casesShipped+(row.looseUnitsShipped??0)/shipmentUnitSize(row);
  const authorizationIsMixed=(authorization.standardCases??0)>0&&(authorization.specialOrderCases??0)>0;
  const old=request.shipments?.[index];
  const hasPublishedHistory=!!old&&(old.etaSentAt!==undefined||old.dispatched===true||old.receivedAt!==undefined||old.receiptConfirmed===true||old.receivedCases!==undefined||old.issue!==undefined);
  if(authorizationIsMixed&&!row.fulfillmentType&&!hasPublishedHistory&&(cases>0||row.eta||row.etaSentAt||row.trackingNumbers.some(value=>value.trim())))return `Shipment ${index+1}: Select Standard or Special Order for this formula.`;
  const type=row.fulfillmentType??(authorizationIsMixed&&hasPublishedHistory?legacyFulfillmentType(request,formula):shipmentFulfillmentType(request,row));
  if(!type){if(cases>0||row.eta||row.etaSentAt||row.trackingNumbers.some(value=>value.trim()))return `Shipment ${index+1}: Select Standard or Special Order for this formula.`;continue;}
  const totals=used.get(shipmentFormulaKey(formula))??{standard:0,special:0};
  totals[type]+=cases;used.set(shipmentFormulaKey(formula),totals);
  const limit=allocatedCases(authorization,type)??0;
  if(totals[type]>limit+1e-9)return `Shipment ${index+1}: Quantity exceeds the ${limit} approved ${type==='standard'?'Standard':'Special Order'} cases for ${formula.productName}.`;
 }
 return '';
}
export function legacyFulfillmentType(request:Partial<RequestRecord>,formula:{productName:string;productForm?:string;flavor?:string}):FulfillmentType {
 const key=shipmentFormulaKey(formula);
 const special=request.formulaOrders?.find(order=>shipmentFormulaKey(order)===key)?.specialOrder??(request.specialOrder===true);
 return special?'special':'standard';
}
export function fulfillmentProgress(request:Partial<RequestRecord>):FulfillmentProgress[] {
 const rows=requestShipments(request);
 return formulaAuthorizations(request).flatMap(authorization=>{
  if(authorization.standardCases===undefined||authorization.specialOrderCases===undefined)return [];
  const formula={productName:authorization.productName,productForm:authorization.productForm,...(authorization.flavor?{flavor:authorization.flavor}:{})};
  const formulaKey=shipmentFormulaKey(formula);
  const progress=(type:FulfillmentType,allocated:number)=>{
   const portion=rows.filter(row=>shipmentFormulaKey(resolveShipmentFormula(request,row))===formulaKey&&shipmentFulfillmentType(request,row)===type);
   const shipped=Math.min(allocated,portion.filter(row=>shipmentDispatched(request,row)).reduce((sum,row)=>sum+row.casesShipped+(row.looseUnitsShipped??0)/shipmentUnitSize(row),0));
   const received=Math.min(allocated,portion.reduce((sum,row)=>sum+shipmentQuantities(request,row).receivedUnits/shipmentUnitSize(row),0));
   return {allocated,shipped,received,pending:Math.max(0,allocated-shipped)};
  };
  return [{formula:shipmentFormulaLabel(formula),standard:progress('standard',authorization.standardCases),special:progress('special',authorization.specialOrderCases)}];
 });
}
export function splitOrderFulfillmentComplete(request:Partial<RequestRecord>):boolean {
 if(!hasSplitOrderAllocation(request))return true;
 const split=fulfillmentProgress(request).filter(row=>row.standard.allocated>0&&row.special.allocated>0);
 return split.every(row=>row.standard.shipped>=row.standard.allocated&&row.standard.received>=row.standard.allocated&&row.special.shipped>=row.special.allocated&&row.special.received>=row.special.allocated);
}
