import type {RequestRecord,ProductForm} from './domain';
import {requestFormulas} from './requestPresentation';
import {validateBenefitIssuances} from './requestOperations';
import {validateRequestDetailNumbers} from './requestDetailFields';
export interface FormulaAuthorization {
 productName:string;productForm?:ProductForm;flavor?:string;
 formulaName?:string;productCode?:string;unitsPerCase?:number;yield?:number;
 totalUnitsIssued?:number;unitsToOrder?:number;
 localSurplusAllocations?:Array<{lotId:string;units:number}>;localSurplusIssued?:Array<{month:string;units:number}>;
 approvedCases?:number;standardCases?:number;specialOrderCases?:number;approvedMonths?:number;agencyUnitsOnHand?:number;agencyUnitsOnHandUnit?:'units'|'cases';expectedSurplus?:number;expectedSurplusUnit?:'units'|'cases';benefitIssuances:Array<{month:string;quantity:number}>;
}
const key=(row:{productName:string;productForm?:ProductForm;flavor?:string})=>JSON.stringify([row.productName.trim().toLowerCase(),row.productForm,row.flavor?.trim().toLowerCase()??'']);
export function formulaAuthorizations(request:Partial<RequestRecord>):FormulaAuthorization[]{
 return requestFormulas(request).map((formula,index)=>{
  const saved=request.formulaAuthorizations?.find(row=>key(row)===key(formula));
  const source:Partial<FormulaAuthorization>=saved??(!request.formulaAuthorizations?.length&&index===0?request:{});
  const specialOrder=request.formulaOrders?.find(order=>key(order)===key(formula))?.specialOrder??(request.specialOrder===true);
  const approvedCases=source.approvedCases;
  const benefitIssuances=source.benefitIssuances?.map(row=>({...row}))??[{month:'',quantity:0}];
  const localSurplusAllocations=source.localSurplusAllocations?.map(row=>({...row}));
  const totalUnitsIssued=source.totalUnitsIssued??benefitIssuances.reduce((sum,row)=>sum+(Number.isSafeInteger(row.quantity)?Math.max(0,row.quantity):0),0);
  const assignedUnits=(localSurplusAllocations??[]).reduce((sum,row)=>sum+(Number.isSafeInteger(row.units)?Math.max(0,row.units):0),0);
  return {productName:formula.productName,productForm:formula.productForm,flavor:formula.flavor,formulaName:source.formulaName,productCode:source.productCode,unitsPerCase:source.unitsPerCase,yield:source.yield,totalUnitsIssued,unitsToOrder:source.unitsToOrder??Math.max(0,totalUnitsIssued-assignedUnits),localSurplusAllocations,localSurplusIssued:source.localSurplusIssued?.map(row=>({...row})),approvedCases,standardCases:source.standardCases??(approvedCases===undefined?undefined:specialOrder?0:approvedCases),specialOrderCases:source.specialOrderCases??(approvedCases===undefined?undefined:specialOrder?approvedCases:0),approvedMonths:source.approvedMonths,agencyUnitsOnHand:source.agencyUnitsOnHand,agencyUnitsOnHandUnit:source.agencyUnitsOnHandUnit??'units',expectedSurplus:source.expectedSurplus,expectedSurplusUnit:source.expectedSurplusUnit??'units',benefitIssuances};
 });
}
export function formatIssuanceMonth(value:string){const [year,month]=value.split('-').map(Number);return year&&month>=1&&month<=12?`${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][month-1]} ${year}`:value;}
export function validateFormulaAuthorizations(rows:FormulaAuthorization[]):string[]{
 if(!Array.isArray(rows)||rows.length<1||rows.length>2)return ['Provide issuance for one or two formulas.'];
 return rows.flatMap((row,index)=>{
  if(!row||typeof row.productName!=='string'||!Array.isArray(row.benefitIssuances))return [`Formula ${index+1}: Invalid issuance details.`];
  if(row.benefitIssuances.some(item=>!item||typeof item.month!=='string'||typeof item.quantity!=='number'))return [`Formula ${index+1}: Invalid month or quantity.`];
  if(row.totalUnitsIssued!==undefined&&(!Number.isSafeInteger(row.totalUnitsIssued)||row.totalUnitsIssued<0))return [`Formula ${index+1}: Enter a whole, nonnegative Total Unit(s) Approved value.`];
  if(row.unitsToOrder!==undefined&&(!Number.isSafeInteger(row.unitsToOrder)||row.unitsToOrder<0))return [`Formula ${index+1}: Enter a whole, nonnegative Unit(s) to Order/Transfer value.`];
  const allocationErrors:string[]=[];
  if(row.standardCases!==undefined||row.specialOrderCases!==undefined){
   if(!Number.isSafeInteger(row.approvedCases)||row.approvedCases!<0)allocationErrors.push('Enter Approved Cases before splitting the order.');
   if(!Number.isSafeInteger(row.standardCases)||row.standardCases!<0||!Number.isSafeInteger(row.specialOrderCases)||row.specialOrderCases!<0)allocationErrors.push('Enter a whole, nonnegative Standard and Special Order case quantity.');
   else if((row.standardCases!+row.specialOrderCases!)!==row.approvedCases)allocationErrors.push('Standard and Special Order cases must equal Approved Cases.');
  }
  return [...validateRequestDetailNumbers(row),...validateBenefitIssuances(row.benefitIssuances),...allocationErrors].map(error=>`Formula ${index+1}: ${error}`);
 });
}
