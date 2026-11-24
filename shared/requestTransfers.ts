import {unitLabel} from './quantityLabels';
import type {RequestRecord} from './domain';
import type {SurplusLot,SurplusTransfer} from './surplus';
import {localDate,daysRemaining,normalizeVariantText,surplusProductPackaging} from './surplus';
import {shipmentFormulaOptions} from './shipmentFormulas';
import type {ProductRecord} from './domain';
import type {RequestShipment} from './requestShipments';
export interface RequestAgencyTransfer extends SurplusTransfer {
 request_id:number;units_per_case:number;eta?:string;carrier?:string;destination_shipping?:string;received_units?:number;damaged_units?:number;
}
export function transferLotFormulaLabel(lot:{formulaName:string;form:string}){
 const form=lot.form==='ready-to-feed'?'RTF':lot.form==='powder'?'PWD':lot.form==='concentrate'?'CONC':lot.form;
 return `${lot.formulaName} ${form}`.trim();
}
const formKey=(value:string)=>normalizeVariantText(value).replace(/[^a-z]/g,'').replace('liquidconcentrate','concentrate');
const flavorKey=(value:string|undefined)=>{const key=normalizeVariantText(value??'');return key==='unflavored'?'':key;};
export function surplusShipmentDraft(request:Partial<RequestRecord>,lot:SurplusLot,products:ProductRecord[]):RequestShipment|undefined {
 if(request.status==='incomplete'||request.status==='denied'||!matchingTransferLot(request,lot)||daysRemaining(lot.expirationDate,localDate())<=60||lot.expiredUnits>0||lot.onHand<=lot.reserved)return;
 const formula=shipmentFormulaOptions(request).find(f=>normalizeVariantText(f.productName)===normalizeVariantText(lot.formulaName)&&formKey(f.productForm??'')===formKey(lot.form)&&normalizeVariantText(f.flavor??'')===normalizeVariantText(lot.flavor));
 if(!formula)return;
 return {shipmentSource:'agency',sourceAgencyId:lot.agencyId,sourceClinicId:lot.clinicId,sourceClinicName:lot.clinicName,sourceClinicAddress:lot.clinicAddress,sourceLotId:lot.id,shipmentFormula:{...formula},unitsPerCase:transferCatalogUnitsPerCase(lot,products),casesShipped:0,looseUnitsShipped:0,eta:'',carrier:'gso',trackingNumbers:[]};
}
export function matchingTransferLot(request:Partial<RequestRecord>,lot:SurplusLot):boolean{
 return lot.agencyId!==request.agencyId && shipmentFormulaOptions(request).some(formula=>normalizeVariantText(formula.productName)===normalizeVariantText(lot.formulaName)&&formKey(formula.productForm??'')===formKey(lot.form)&&normalizeVariantText(formula.flavor??'')===normalizeVariantText(lot.flavor));
}

export function matchingLocalSurplusLot(formula:import('./domain').RequestedFormula,lot:SurplusLot,agencyId:number,flavor= formula.flavor??'',catalogName?:string):boolean{
 return lot.agencyId===agencyId
  &&normalizeVariantText(catalogName||formula.otherFormulaName||formula.productName)===normalizeVariantText(lot.formulaName)
  &&formKey(formula.productForm)===formKey(lot.form)
  &&flavorKey(flavor)===flavorKey(lot.flavor);
}

export function transferCatalogUnitsPerCase(lot:{formulaName:string;form:string;flavor?:string;packaging?:string},products:import('./domain').ProductRecord[]):number|undefined {
 const matches=products.filter(p=>normalizeVariantText(p.name)===normalizeVariantText(lot.formulaName)&&formKey(p.form)===formKey(lot.form)&&(!(p.flavor??p.genericFields?.flavor)||normalizeVariantText(p.flavor??p.genericFields?.flavor??'')===normalizeVariantText(lot.flavor??''))&&(!lot.packaging||normalizeVariantText(surplusProductPackaging(p))===normalizeVariantText(lot.packaging)));
 if(matches.some(product=>!Number.isSafeInteger(product.unitsPerCase)||!product.unitsPerCase||product.unitsPerCase<1))return undefined;
 const sizes=[...new Set(matches.map(p=>p.unitsPerCase).filter((n):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0))];return sizes.length===1?sizes[0]:undefined;
}

export function transferEntryQuantity(row:{casesShipped:number;looseUnitsShipped?:number;unitsPerCase?:number}):number|undefined {
 const cases=row.casesShipped;const units=row.looseUnitsShipped??0;const size=row.unitsPerCase;
 if(!Number.isSafeInteger(size)||!size||size<1||!Number.isSafeInteger(cases)||cases<0||!Number.isSafeInteger(units)||units<0||units>=size)return undefined;
 const total=cases*size+units;return Number.isSafeInteger(total)?total:undefined;
}

export function transferAuthorizationError(request:Partial<RequestRecord>,row:import('./requestShipments').RequestShipment,lots:SurplusLot[]):string {
 if(!row.sourceAgencyId)return 'Select a Sending Local Agency.';
 const available=lots.filter(l=>l.agencyId===row.sourceAgencyId&&matchingTransferLot(request,l)&&daysRemaining(l.expirationDate,localDate())>60&&!l.expiredUnits&&l.onHand>l.reserved);
 if(!available.length)return 'No verified surplus is available for this formula at the selected agency. Add or confirm the sending agency’s surplus before authorizing the transfer.';
 const lot=available.find(l=>l.id===row.sourceLotId);if(!lot)return 'Select Available Surplus from the sending agency.';
 if(!Number.isSafeInteger(row.unitsPerCase)||!row.unitsPerCase||row.unitsPerCase<1)return 'Enter Units per Case.';
 const quantity=transferEntryQuantity(row);
 if(quantity===undefined||quantity<1)return 'Enter a positive transfer quantity using whole cases and additional units. Additional units must be fewer than Units per Case.';
 if(quantity>lot.onHand-lot.reserved)return `Only ${lot.onHand-lot.reserved} ${unitLabel(lot.onHand-lot.reserved)} ${lot.onHand-lot.reserved===1?'is':'are'} available at the sending agency. Reduce the transfer quantity.`;
 return '';
}
