import type {RequestRecord} from './domain';
import type {SurplusLot,SurplusTransfer} from './surplus';
import {normalizeVariantText} from './surplus';
import {requestFormulas} from './requestPresentation';
export interface RequestAgencyTransfer extends SurplusTransfer {
 request_id:number;units_per_case:number;eta?:string;carrier?:string;destination_shipping?:string;received_units?:number;damaged_units?:number;
}
const formKey=(value:string)=>normalizeVariantText(value).replace(/[^a-z]/g,'').replace('liquidconcentrate','concentrate');
export function matchingTransferLot(request:Partial<RequestRecord>,lot:SurplusLot):boolean{
 return lot.agencyId!==request.agencyId && requestFormulas(request).some(formula=>normalizeVariantText(formula.otherFormulaName||formula.productName)===normalizeVariantText(lot.formulaName)&&formKey(formula.productForm??'')===formKey(lot.form)&&normalizeVariantText(formula.flavor??'')===normalizeVariantText(lot.flavor));
}
