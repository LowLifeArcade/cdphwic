import type {RequestRecord} from './domain';
import type {FormulaAuthorization} from './formulaAuthorizations';
import {resolveShipmentFormula,shipmentFormulaKey} from './shipmentFormulas';
import {shipmentHasUnsentChanges} from './shipmentPublishing';
import {validUnitSize} from './shipmentQuantities';

function supplyFormulaKey(authorization: FormulaAuthorization) {
    return shipmentFormulaKey({
        ...authorization,
        productName: authorization.formulaName || authorization.productName,
    });
}

/** Approved supply excludes replacements, which restore an existing allocation. */
export function issuanceSupply(request:Partial<RequestRecord>,authorization:FormulaAuthorization){
 const local=(authorization.localSurplusAllocations??[]).reduce((sum,row)=>sum+row.units,0);
 const total=authorization.totalUnitsIssued??authorization.benefitIssuances.reduce((sum,row)=>sum+row.quantity,0);
 let transferred=0,orderedCases=0,orderedLooseUnits=0,orderedUnits=0,unknownOrderSize=false;
 const sizes=new Set<number>();
 for(const row of request.shipments??[]){
  if(row.replacementFor!==undefined||shipmentFormulaKey(resolveShipmentFormula(request,row))!==supplyFormulaKey(authorization))continue;
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
  if(row.shipmentSource!=='agency'||(!row.transferId&&!row.sourceLotId)||row.replacementFor!==undefined||shipmentFormulaKey(resolveShipmentFormula(request,row))!==supplyFormulaKey(authorization))continue;
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

export interface SupplySourceRow {
 key:string;kind:'on-hand'|'transfer'|'distributor'|'surplus';label:string;units:number|undefined;
 cases?:number;looseUnits?:number;unitsPerCase?:number;pending?:boolean;draftUpdate?:boolean;stage?:'planned'|'eta-sent'|'ordered'|'shipped';
}
/** Source-by-source presentation shared by staff, agencies and the Authorization PDF. */
export function issuanceSupplySources(request:Partial<RequestRecord>,authorization:FormulaAuthorization,includeDrafts=false,publishedShipments?:RequestRecord['shipments']){
 const total=authorization.totalUnitsIssued??authorization.benefitIssuances.reduce((sum,row)=>sum+row.quantity,0);
 const local=(authorization.localSurplusAllocations??[]).reduce((sum,row)=>sum+row.units,0);
 const rows:SupplySourceRow[]=[{key:'on-hand',kind:'on-hand',label:'On Hand',units:local}];
 let supplied=local,unknown=false,plannedUnits=0,unknownPlannedUnits=false;
 const shipments=request.shipments??[];
 const matching=shipments.map((row,index)=>({row,index})).filter(({row})=>row.replacementFor===undefined&&shipmentFormulaKey(resolveShipmentFormula(request,row))===supplyFormulaKey(authorization));
 for(const {row,index} of matching.filter(({row})=>row.shipmentSource==='agency')){
  if(!row.transferId&&!(includeDrafts&&row.sourceLotId))continue;
  const size=row.unitsPerCase??authorization.unitsPerCase;
  const units=row.unitsToTransfer??(row.casesShipped===0?(row.looseUnitsShipped??0):validUnitSize(size)?row.casesShipped*size+(row.looseUnitsShipped??0):undefined);
  const name=row.sourceAgencyName?.replace(/ County$/i,'')||`Agency ${row.sourceAgencyId??'not recorded'}`;
  rows.push({key:`transfer-${row.transferId??index}`,kind:'transfer',label:`Transfer from ${name}`,units,pending:!row.transferId});
  if(units===undefined)unknown=true;else supplied+=units;
 }
 const isPublished=(row:NonNullable<RequestRecord['shipments']>[number])=>!!(row.etaSentAt||row.dispatched||row.receivedAt||row.receiptConfirmed);
 const matchesFormula=(row:NonNullable<RequestRecord['shipments']>[number])=>row.shipmentSource!=='agency'&&row.replacementFor===undefined&&shipmentFormulaKey(resolveShipmentFormula(request,row))===supplyFormulaKey(authorization);
 const distributorEntries=publishedShipments===undefined
  ?matching.filter(({row})=>row.shipmentSource!=='agency').map(entry=>({...entry,forceDraft:false,baseline:undefined as NonNullable<RequestRecord['shipments']>[number]|undefined}))
  :[
   ...publishedShipments.map((row,index)=>({row,index,forceDraft:false,baseline:undefined as NonNullable<RequestRecord['shipments']>[number]|undefined})).filter(({row})=>matchesFormula(row)&&isPublished(row)),
   ...(includeDrafts?matching.filter(({row,index})=>matchesFormula(row)&&shipmentHasUnsentChanges(row,publishedShipments[index])).map(entry=>({...entry,forceDraft:true,baseline:publishedShipments[entry.index]})):[]),
  ];
 for(const {row,index,forceDraft,baseline} of distributorEntries){
  const published=!forceDraft&&isPublished(row);
  if(!published&&!(includeDrafts&&(row.supplier||row.distributorId)))continue;
  const size=row.unitsPerCase??authorization.unitsPerCase;
  const units=row.casesShipped===0?(row.looseUnitsShipped??0):validUnitSize(size)?row.casesShipped*size+(row.looseUnitsShipped??0):undefined;
  const stage:NonNullable<SupplySourceRow['stage']>=!published?'planned':row.dispatched||row.receivedAt||row.receiptConfirmed?'shipped':request.dateOrdered?'ordered':'eta-sent';
  const prefix={planned:'Planned from',ordered:'Ordered from','eta-sent':'ETA sent for',shipped:'Shipped from'}[stage];
  rows.push({key:`distributor-${index}${forceDraft?'-draft':''}`,kind:'distributor',label:`${prefix} ${row.supplier||'distributor not recorded'}`,units,cases:row.casesShipped,looseUnits:row.looseUnitsShipped??0,unitsPerCase:size,pending:!published,stage,draftUpdate:forceDraft&&!!baseline&&isPublished(baseline)});
  if(!published){
   const baselineSize=baseline?.unitsPerCase??authorization.unitsPerCase;
   const baselineUnits=baseline&&isPublished(baseline)&&matchesFormula(baseline)?baseline.casesShipped===0?(baseline.looseUnitsShipped??0):validUnitSize(baselineSize)?baseline.casesShipped*baselineSize+(baseline.looseUnitsShipped??0):undefined:0;
   if(units===undefined||baselineUnits===undefined)unknownPlannedUnits=true;
   else plannedUnits+=Math.max(0,units-baselineUnits);
  }else if(units===undefined)unknown=true;else supplied+=units;
 }
 const surplus=unknown?undefined:Math.max(0,supplied-total);
 rows.push({key:'surplus',kind:'surplus',label:'Expected Surplus',units:surplus});
 return {rows,total,local,surplus,pending:Math.max(0,total-supplied),unknown,plannedUnits,unknownPlannedUnits};
}
export function supplyCaseDetails(row:SupplySourceRow){
 if(row.kind!=='distributor')return '';
 const cases=row.cases??0;
 const parts=[`${cases} ${cases===1?'Case':'Cases'}`];
 if(row.unitsPerCase)parts[0]+=` x ${row.unitsPerCase} ${row.unitsPerCase===1?'Unit':'Units'}`;
 if(row.looseUnits)parts.push(`${row.looseUnits} loose ${row.looseUnits===1?'Unit':'Units'}`);
 return parts.join(' + ');
}

/** Additional order needed after selected stock and recorded distributor shipments. */
export function remainingSupplyOrder(request:Partial<RequestRecord>,authorization:FormulaAuthorization,unitsPerCase=authorization.unitsPerCase,publishedShipments?:RequestRecord['shipments']){
 const supply=issuanceSupplySources(request,{...authorization,unitsPerCase},true,publishedShipments);
 const cases=supply.unknown?undefined:supply.pending===0?0:validUnitSize(unitsPerCase)?Math.ceil(supply.pending/unitsPerCase):undefined;
 const orderUnits=cases===0?0:cases!==undefined&&validUnitSize(unitsPerCase)?cases*unitsPerCase:undefined;
 const surplus=orderUnits===undefined?undefined:Math.max(0,(supply.surplus??0)+orderUnits-supply.pending);
 const stillToPlan=supply.unknownPlannedUnits?undefined:Math.max(0,supply.pending-supply.plannedUnits);
 return {supply,needed:supply.pending,cases,orderUnits,surplus,unitsPerCase,stillToPlan};
}
