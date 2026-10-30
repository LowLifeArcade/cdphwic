import type {RequestRecord,ProductForm} from './domain';
import {requestFormulas,formulaFormLabel} from './requestPresentation';
export interface ShipmentFormula {productName:string;productForm?:ProductForm;flavor?:string}
type Selection={shipmentFormula?:ShipmentFormula;transferFormulaName?:string;transferForm?:string;transferFlavor?:string};
export function shipmentFormulaKey(formula?:ShipmentFormula):string {return formula?JSON.stringify([(formula.productName??'').trim().toLowerCase(),formula.productForm,formula.flavor?.trim().toLowerCase()??'']):'';}
export function shipmentFormulaOptions(request:Partial<RequestRecord>):ShipmentFormula[]{return requestFormulas(request).map(f=>({productName:f.otherFormulaName||f.productName,productForm:f.productForm,...(f.flavor?{flavor:f.flavor}:{})}));}
export function resolveShipmentFormula(request:Partial<RequestRecord>,row:Selection):ShipmentFormula|undefined {
 const options=shipmentFormulaOptions(request);
 if(row.shipmentFormula)return options.find(f=>shipmentFormulaKey(f)===shipmentFormulaKey(row.shipmentFormula));
 if(row.transferFormulaName){const key=shipmentFormulaKey({productName:row.transferFormulaName,productForm:row.transferForm as ProductForm,flavor:row.transferFlavor});return options.find(f=>shipmentFormulaKey(f)===key);}
 return options.length===1?options[0]:undefined;
}
export function requireShipmentFormula(request:Partial<RequestRecord>,row:Selection):ShipmentFormula {
 const selected=resolveShipmentFormula(request,row);if(!selected){const message='Select the formula for this shipment.';throw Object.assign(new Error(message),{statusCode:400,statusMessage:message});}return {...selected};
}
export function shipmentFormulaLabel(formula?:ShipmentFormula):string {return formula?[formula.productName,formulaFormLabel(formula.productForm),formula.flavor].filter(Boolean).join(' · '):'Formula not recorded';}
