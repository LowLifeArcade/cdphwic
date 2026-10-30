import type {RequestRecord,ProductForm} from './domain';
import {requestFormulas} from './requestPresentation';
import {validateBenefitIssuances} from './requestOperations';
import {validateRequestDetailNumbers} from './requestDetailFields';
export interface FormulaAuthorization {
 productName:string;productForm?:ProductForm;flavor?:string;
 approvedCases?:number;approvedMonths?:number;agencyUnitsOnHand?:number;agencyUnitsOnHandUnit?:'units'|'cases';expectedSurplus?:number;expectedSurplusUnit?:'units'|'cases';benefitIssuances:Array<{month:string;quantity:number}>;
}
const key=(row:{productName:string;productForm?:ProductForm;flavor?:string})=>JSON.stringify([row.productName.trim().toLowerCase(),row.productForm,row.flavor?.trim().toLowerCase()??'']);
export function formulaAuthorizations(request:Partial<RequestRecord>,initialMonth:string):FormulaAuthorization[]{
 return requestFormulas(request).map((formula,index)=>{
  const saved=request.formulaAuthorizations?.find(row=>key(row)===key(formula));
  const source:Partial<FormulaAuthorization>=saved??(!request.formulaAuthorizations?.length&&index===0?request:{});
  return {productName:formula.productName,productForm:formula.productForm,flavor:formula.flavor,approvedCases:source.approvedCases,approvedMonths:source.approvedMonths,agencyUnitsOnHand:source.agencyUnitsOnHand,agencyUnitsOnHandUnit:source.agencyUnitsOnHandUnit??'units',expectedSurplus:source.expectedSurplus,expectedSurplusUnit:source.expectedSurplusUnit??'units',benefitIssuances:source.benefitIssuances?.map(row=>({...row}))??[{month:initialMonth,quantity:0}]};
 });
}
export function formatIssuanceMonth(value:string){const [year,month]=value.split('-').map(Number);return year&&month>=1&&month<=12?`${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][month-1]} ${year}`:value;}
export function validateFormulaAuthorizations(rows:FormulaAuthorization[]):string[]{
 if(!Array.isArray(rows)||rows.length<1||rows.length>2)return ['Provide issuance for one or two formulas.'];
 return rows.flatMap((row,index)=>{
  if(!row||typeof row.productName!=='string'||!Array.isArray(row.benefitIssuances))return [`Formula ${index+1}: Invalid issuance details.`];
  if(row.benefitIssuances.some(item=>!item||typeof item.month!=='string'||typeof item.quantity!=='number'))return [`Formula ${index+1}: Invalid month or quantity.`];
  return [...validateRequestDetailNumbers(row),...validateBenefitIssuances(row.benefitIssuances)].map(error=>`Formula ${index+1}: ${error}`);
 });
}
