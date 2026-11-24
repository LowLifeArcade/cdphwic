import {unitLabel} from './quantityLabels';
import type {RequestRecord} from './domain';
import type {ShipmentFormula} from './shipmentFormulas';
import type {RequestShipment} from './requestShipments';
import type {SurplusLot} from './surplus';
import {daysRemaining} from './surplus';
import {matchingTransferLot} from './requestTransfers';
import {validUnitSize} from './shipmentQuantities';
export function issuanceTransferLots(request:Partial<RequestRecord>,formula:ShipmentFormula,lots:SurplusLot[],today:string){
 return lots.filter(lot=>matchingTransferLot({...request,requestedFormulas:[{...formula,productForm:formula.productForm!,ouncesPrescribed:0}]},lot)&&daysRemaining(lot.expirationDate,today)>60&&!lot.expiredUnits&&lot.onHand>lot.reserved).sort((a,b)=>a.expirationDate.localeCompare(b.expirationDate));
}
export function setIssuanceTransferUnits(rows:RequestShipment[],formula:ShipmentFormula,lot:SurplusLot,units:number,size?:number):RequestShipment[]{
 let index=rows.findIndex(row=>row.sourceLotId===lot.id&&row.shipmentSource==='agency'&&row.replacementFor===undefined&&!row.transferId);
 if(!Number.isSafeInteger(units)||units<0)throw new Error('Enter a whole, nonnegative number of units.');
 if(units>lot.onHand-lot.reserved)throw new Error(`Only ${lot.onHand-lot.reserved} ${unitLabel(lot.onHand-lot.reserved)} ${lot.onHand-lot.reserved===1?'is':'are'} available.`);
 if(units===0)return rows.filter((_,i)=>i!==index);
 if(!validUnitSize(size))throw new Error('Enter Units Per Case before selecting transfer stock.');
 if(index<0)index=rows.findIndex(row=>!row.shipmentSource&&!row.transferId&&!row.etaSentAt&&!row.shipmentFormula&&!row.sourceLotId&&!row.distributorId&&!row.supplier&&!row.casesShipped&&!row.looseUnitsShipped&&!row.eta&&!row.trackingNumbers.length&&!row.issue&&!row.receivedAt&&!row.receiptConfirmed&&row.receivedUnits===undefined&&row.receivedCases===undefined&&row.replacementFor===undefined);
 const row:RequestShipment={...(index>=0?rows[index]:{}),shipmentSource:'agency',sourceAgencyId:lot.agencyId,sourceClinicId:lot.clinicId,sourceClinicName:lot.clinicName,sourceClinicAddress:lot.clinicAddress,sourceLotId:lot.id,shipmentFormula:{...formula},unitsPerCase:size,casesShipped:Math.floor(units/size),looseUnitsShipped:units%size,unitsToTransfer:units,eta:'',carrier:'gso',trackingNumbers:[]};
 return index>=0?rows.map((existing,i)=>i===index?row:existing):[...rows,row];
}
