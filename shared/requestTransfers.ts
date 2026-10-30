import type {RequestRecord} from './domain';
import type {SurplusLot,SurplusTransfer} from './surplus';
import {localDate,normalizeVariantText} from './surplus';
import {requestFormulas} from './requestPresentation';
export interface RequestAgencyTransfer extends SurplusTransfer {
 request_id:number;units_per_case:number;eta?:string;carrier?:string;destination_shipping?:string;received_units?:number;damaged_units?:number;
}
const formKey=(value:string)=>normalizeVariantText(value).replace(/[^a-z]/g,'').replace('liquidconcentrate','concentrate');
export function matchingTransferLot(request:Partial<RequestRecord>,lot:SurplusLot):boolean{
 return lot.agencyId!==request.agencyId && requestFormulas(request).some(formula=>normalizeVariantText(formula.otherFormulaName||formula.productName)===normalizeVariantText(lot.formulaName)&&formKey(formula.productForm??'')===formKey(lot.form)&&normalizeVariantText(formula.flavor??'')===normalizeVariantText(lot.flavor));
}

export function transferCatalogUnitsPerCase(lot:{formulaName:string;form:string;flavor?:string},products:import('./domain').ProductRecord[]):number|undefined {
 const matches=products.filter(p=>normalizeVariantText(p.name)===normalizeVariantText(lot.formulaName)&&formKey(p.form)===formKey(lot.form)&&(!p.genericFields?.flavor||normalizeVariantText(p.genericFields.flavor)===normalizeVariantText(lot.flavor??'')));
 const sizes=[...new Set(matches.map(p=>p.unitsPerCase).filter(n=>Number.isSafeInteger(n)&&n>0))];return sizes.length===1?sizes[0]:undefined;
}

export function transferEntryQuantity(row:{casesShipped:number;looseUnitsShipped?:number;unitsPerCase?:number}):number|undefined {
 const cases=row.casesShipped;const units=row.looseUnitsShipped??0;const size=row.unitsPerCase;
 if(!Number.isSafeInteger(size)||!size||size<1||!Number.isSafeInteger(cases)||cases<0||!Number.isSafeInteger(units)||units<0||units>=size)return undefined;
 const total=cases*size+units;return Number.isSafeInteger(total)?total:undefined;
}

export function transferAuthorizationError(request:Partial<RequestRecord>,row:import('./requestShipments').RequestShipment,lots:SurplusLot[]):string {
 if(!row.sourceAgencyId)return 'Select a Sending Local Agency.';
 const available=lots.filter(l=>l.agencyId===row.sourceAgencyId&&matchingTransferLot(request,l)&&l.expirationDate>=localDate()&&!l.expiredUnits&&l.onHand>l.reserved);
 if(!available.length)return 'No verified surplus is available for this formula at the selected agency. Add or confirm the sending agency’s surplus before authorizing the transfer.';
 const lot=available.find(l=>l.id===row.sourceLotId);if(!lot)return 'Select Available Surplus from the sending agency.';
 if(!Number.isSafeInteger(row.unitsPerCase)||!row.unitsPerCase||row.unitsPerCase<1)return 'Enter Units per Case.';
 const quantity=transferEntryQuantity(row);
 if(quantity===undefined||quantity<1)return 'Enter a positive transfer quantity using whole cases and additional units. Additional units must be fewer than Units per Case.';
 if(quantity>lot.onHand-lot.reserved)return `Only ${lot.onHand-lot.reserved} units are available at the sending agency. Reduce the transfer quantity.`;
 return '';
}
