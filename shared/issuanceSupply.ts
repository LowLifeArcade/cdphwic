import type {RequestRecord} from './domain';
import type {FormulaAuthorization} from './formulaAuthorizations';
import {resolveShipmentFormula,shipmentFormulaKey} from './shipmentFormulas';
import {validUnitSize} from './shipmentQuantities';

/** Approved supply excludes replacements, which restore an existing allocation. */
export function issuanceSupply(request:Partial<RequestRecord>,authorization:FormulaAuthorization){
 const local=(authorization.localSurplusAllocations??[]).reduce((sum,row)=>sum+row.units,0);
 const total=authorization.totalUnitsIssued??authorization.benefitIssuances.reduce((sum,row)=>sum+row.quantity,0);
 let transferred=0,orderedCases=0,orderedLooseUnits=0,orderedUnits=0,unknownOrderSize=false;
 const sizes=new Set<number>();
 for(const row of request.shipments??[]){
  if(row.replacementFor!==undefined||shipmentFormulaKey(resolveShipmentFormula(request,row))!==shipmentFormulaKey(authorization))continue;
  if(row.shipmentSource==='agency'){
   if(!row.transferId)continue;
   const size=row.unitsPerCase??authorization.unitsPerCase;
   if(row.unitsToTransfer!==undefined)transferred+=row.unitsToTransfer;
   else if(validUnitSize(size))transferred+=row.casesShipped*size+(row.looseUnitsShipped??0);
   continue;
  }
  if(!row.etaSentAt&&!row.dispatched&&!row.receivedAt&&!row.receiptConfirmed)continue;
  const size=row.unitsPerCase??authorization.unitsPerCase;
  if(row.casesShipped>0&&!validUnitSize(size)){unknownOrderSize=true;continue;}
  if(validUnitSize(size))sizes.add(size);
  orderedCases+=row.casesShipped;
  orderedLooseUnits+=row.looseUnitsShipped??0;
  orderedUnits+=row.casesShipped*(size??0)+(row.looseUnitsShipped??0);
 }
 const supplied=local+transferred+orderedUnits;
 return {local,transferred,orderedCases,orderedLooseUnits,orderedUnits,orderSizes:[...sizes],unknownOrderSize,total,surplus:Math.max(0,supplied-total),pending:Math.max(0,total-supplied)};
}

/** Live whole-case order recommendation from the staff's current allocations. */
export function issuanceSupplyPlan(request:Partial<RequestRecord>,authorization:FormulaAuthorization,unitsPerCase=authorization.unitsPerCase){
 const total=Math.max(0,authorization.totalUnitsIssued??authorization.benefitIssuances.reduce((sum,row)=>sum+row.quantity,0));
 const local=(authorization.localSurplusAllocations??[]).reduce((sum,row)=>sum+Math.max(0,row.units),0);
 let transferred=0,unknownTransferSize=false;
 for(const row of request.shipments??[]){
  if(row.shipmentSource!=='agency'||(!row.transferId&&!row.sourceLotId)||row.replacementFor!==undefined||shipmentFormulaKey(resolveShipmentFormula(request,row))!==shipmentFormulaKey(authorization))continue;
  if(row.unitsToTransfer!==undefined){transferred+=Math.max(0,row.unitsToTransfer);continue;}
  const size=row.unitsPerCase??unitsPerCase;
  if(row.casesShipped>0&&!validUnitSize(size)){unknownTransferSize=true;continue;}
  transferred+=row.casesShipped*(size??0)+(row.looseUnitsShipped??0);
 }
 const needed=Math.max(0,total-local-transferred);
 const cases=needed===0?0:validUnitSize(unitsPerCase)?Math.ceil(needed/unitsPerCase):undefined;
 const orderedUnits=cases===0?0:cases!==undefined&&validUnitSize(unitsPerCase)?cases*unitsPerCase:undefined;
 const surplus=orderedUnits===undefined?undefined:Math.max(0,local+transferred+orderedUnits-total);
 return {total,local,transferred,needed,cases,orderedUnits,surplus,unitsPerCase,unknownTransferSize};
}
