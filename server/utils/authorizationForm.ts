import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {formatIssuanceMonth,formulaAuthorizations} from '../../shared/formulaAuthorizations';
import {formatDisplayDate as date,requestFormulas,formulaFormLabel,foodRestrictionLabel,insuranceDetails,requestedMonthLabels} from '../../shared/requestPresentation';
import type {AgencyMemberRecord,AgencyRecord,RequestRecord} from '../../shared/domain';
export async function createAuthorizationFormPdf(request:RequestRecord,agency?:AgencyRecord,rep?:AgencyMemberRecord):Promise<Uint8Array>{
 const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const blue=rgb(0,37/255,149/255),ink=rgb(.08,.12,.16),muted=rgb(.42,.44,.45);
 let page=doc.addPage([612,792]);let y=728;
 const pageHeader=()=>{page.drawText('State-Issued Formula Authorization',{x:42,y:754,size:17,font:bold,color:blue});y=720;};pageHeader();
 const ensure=(height:number)=>{if(y-height<46){page=doc.addPage([612,792]);pageHeader();}};
 const wrap=(text:string,width:number,size=9)=>{
  const lines:string[]=[];
  for(const paragraph of String(text).split(/\r?\n/)){
   let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
    if(line&&regular.widthOfTextAtSize(`${line} ${word}`,size)>width){lines.push(line);line='';}
    for(const char of (line?' ':'')+word){if(regular.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}
   }lines.push(line);
  }return lines;
 };
 const section=(title:string)=>{ensure(48);y-=12;page.drawText(title,{x:42,y,size:11,font:bold,color:blue});y-=8;page.drawLine({start:{x:42,y},end:{x:570,y},thickness:.5,color:rgb(.78,.81,.85)});y-=16;};
 const row=(label:string,input?:string|number)=>{
  const lines=wrap(input===undefined||input===''?'—':String(input),376);
  ensure(15);page.drawText(`${label}:`,{x:46,y,size:9,font:bold,color:ink});
  for(const line of lines){ensure(13);page.drawText(line,{x:190,y,size:9,font:regular,color:ink});y-=13;}y-=3;
 };
 const columns=(leftTitle:string,leftRows:Array<[string,string|number|undefined]>,rightTitle:string,rightRows:Array<[string,string|number|undefined]>)=>{
  let leftIndex=0,rightIndex=0;
  while(leftIndex<leftRows.length||rightIndex<rightRows.length){
   if(y<190){page=doc.addPage([612,792]);pageHeader();}
   const headerY=y-10;
   page.drawText(leftTitle,{x:42,y:headerY,size:10,font:bold,color:blue});
   page.drawText(rightTitle,{x:318,y:headerY,size:10,font:bold,color:blue});
   page.drawLine({start:{x:42,y:headerY-7},end:{x:300,y:headerY-7},thickness:.5,color:rgb(.78,.81,.85)});
   page.drawLine({start:{x:318,y:headerY-7},end:{x:570,y:headerY-7},thickness:.5,color:rgb(.78,.81,.85)});
   let leftY=headerY-22,rightY=headerY-22;
   const drawColumnRow=(items:Array<[string,string|number|undefined]>,index:number,x:number,currentY:number)=>{
    const [label,input]=items[index]!;const value=input===undefined||input===''?'—':String(input);const lines=wrap(value,158,8.5);const height=Math.max(1,lines.length)*11+4;
    if(!label&&!input)return currentY-8;
    page.drawText(`${label}:`,{x:x+4,y:currentY,size:8,font:bold,color:ink});
    lines.forEach((line,lineIndex)=>page.drawText(line,{x:x+91,y:currentY-lineIndex*11,size:8.5,font:regular,color:ink}));
    return currentY-height;
   };
   while(leftIndex<leftRows.length&&leftY>56){const next=drawColumnRow(leftRows,leftIndex,42,leftY);if(next<46)break;leftY=next;leftIndex++;}
   while(rightIndex<rightRows.length&&rightY>56){const next=drawColumnRow(rightRows,rightIndex,318,rightY);if(next<46)break;rightY=next;rightIndex++;}
   y=Math.min(leftY,rightY)-8;
   if(leftIndex<leftRows.length||rightIndex<rightRows.length){page=doc.addPage([612,792]);pageHeader();}
  }
 };
 const authorizations=request.formulaAuthorizations?.length?request.formulaAuthorizations:formulaAuthorizations(request);
 const fullFormulaName=(formula:{productName?:string;productForm?:string;flavor?:string})=>[formula.productName,formulaFormLabel(formula.productForm),formula.flavor].filter(Boolean).join(' ');
 const formulaKey=(value:{productName?:string;productForm?:string;flavor?:string})=>JSON.stringify([(value.productName??'').trim().toLowerCase(),value.productForm??'',(value.flavor??'').trim().toLowerCase()]);
 const shipmentsFor=(authorization:typeof authorizations[number])=>{
  return (request.shipments??[]).filter(shipment=>shipment.etaSentAt||shipment.transferEtaSentAt||shipment.dispatched).filter(shipment=>{
   const formula=shipment.shipmentFormula??(shipment.transferFormulaName?{productName:shipment.transferFormulaName,productForm:shipment.transferForm,flavor:shipment.transferFlavor}:undefined);
   return formula?formulaKey(formula)===formulaKey(authorization):authorizations.length===1;
  });
 };
 const shippedUnits=(authorization:typeof authorizations[number]):number|undefined=>{
  const rows=shipmentsFor(authorization);
  let total=0;
  for(const shipment of rows){
   if(typeof shipment.unitsToTransfer==='number'){total+=shipment.unitsToTransfer;continue;}
   if(typeof shipment.unitsPerCase==='number'&&shipment.unitsPerCase>0){total+=shipment.casesShipped*shipment.unitsPerCase+(shipment.looseUnitsShipped??0);continue;}
   if(shipment.casesShipped===0){total+=shipment.looseUnitsShipped??0;continue;}
   return undefined;
  }
  return total;
 };
 const phone=(value?:string)=>{
  if(!value)return undefined;
  let digits=value.replace(/\D/g,'');if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
  return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:value;
 };
 const quantityLabel=(quantity:number|undefined,unit?:'units'|'cases')=>quantity===undefined?'—':`${quantity} ${unit==='cases'?'case(s)':'unit(s)'}`;
 ensure(42);
 const participantLines=wrap(request.participantName||'—',528,15);
 for(const line of participantLines){ensure(18);page.drawText(line,{x:42,y,size:15,font:bold,color:ink});y-=16;}
 const familyId=`WIC Family ID: ${request.participantFamilyId||'—'}`;page.drawText(familyId,{x:42,y,size:9,font:regular,color:muted});y-=12;
 for(const authorization of authorizations){for(const line of wrap(fullFormulaName(authorization),528,11)){ensure(14);page.drawText(line,{x:42,y,size:11,font:bold,color:blue});y-=13;}}
 section('MONTHLY FORMULA ISSUANCE');
 for(const authorization of authorizations){
  const titleLines=wrap(fullFormulaName(authorization),500,10);
  ensure(titleLines.length*13+94);
  for(const line of titleLines){page.drawText(line,{x:46,y,size:10,font:bold,color:blue});y-=13;}
  const shipmentRows=shipmentsFor(authorization);const caseCount=shipmentRows.reduce((total,shipment)=>total+shipment.casesShipped,0);const caseSizes=[...new Set(shipmentRows.map(shipment=>shipment.unitsPerCase).filter((value):value is number=>typeof value==='number'&&value>0))];
  const unitsPerCase=shipmentRows.length?(caseSizes.length===1&&shipmentRows.every(shipment=>typeof shipment.unitsPerCase==='number')?quantityLabel(caseSizes[0]):caseSizes.length>1?'Varies':'—'):'—';
  const metrics:[string,string][]=[['Cases Shipped',quantityLabel(caseCount,'cases')],['Units per Case',unitsPerCase],['Units Shipped',quantityLabel(shippedUnits(authorization))],['On Hand',quantityLabel(authorization.agencyUnitsOnHand,authorization.agencyUnitsOnHandUnit)],['Surplus',quantityLabel(authorization.expectedSurplus,authorization.expectedSurplusUnit)]];
  const metricWidth=528/5;
  for(const [metricIndex,[label,value]] of metrics.entries()){
   const x=42+metricIndex*metricWidth;
   page.drawRectangle({x,y:y-39,width:metricWidth-4,height:37,color:metricIndex===1?rgb(.91,.94,1):rgb(.95,.96,.98)});
   page.drawText(label,{x:x+8,y:y-14,size:8,font:bold,color:muted});
   page.drawText(value,{x:x+8,y:y-31,size:11,font:bold,color:blue});
  }
  y-=46;
  const issuances=authorization.benefitIssuances.filter(row=>row.month);
  if(!issuances.length){ensure(26);page.drawRectangle({x:42,y:y-10,width:528,height:24,color:rgb(.93,.95,.98)});page.drawText('Monthly quantities not specified',{x:54,y,size:9,font:regular,color:muted});y-=30;continue;}
  for(const issuance of issuances){
   ensure(34);
   page.drawRectangle({x:42,y:y-30,width:528,height:29,color:rgb(.91,.94,1)});
   page.drawText(formatIssuanceMonth(issuance.month),{x:54,y:y-20,size:11,font:bold,color:blue});
   const quantity=`${issuance.quantity} unit(s) per month`;
   const quantitySize=14;
   page.drawText(quantity,{x:558-bold.widthOfTextAtSize(quantity,quantitySize),y:y-21,size:quantitySize,font:bold,color:blue});
   y-=35;
  }
  y-=18;
 }
 const shipping=request.shipping;const shipmentRows=(request.shipments??[]).filter(s=>s.etaSentAt||s.transferEtaSentAt||s.dispatched);
 const shipmentDetails:Array<[string,string|number|undefined]>=shipmentRows.length?shipmentRows.flatMap((shipment,index)=>[
  [`Shipment ${index+1}`,shipment.shipmentFormula?fullFormulaName(shipment.shipmentFormula):request.productName],
  ['Source',shipment.shipmentSource==='agency'?shipment.sourceAgencyName:shipment.supplier],
  ['Cases Shipped',`${shipment.casesShipped} case(s)`],
  ['Units per Case',shipment.unitsPerCase===undefined?undefined:`${shipment.unitsPerCase} unit(s)`],
  ['Loose Units',shipment.looseUnitsShipped?`${shipment.looseUnitsShipped} unit(s)`:undefined],
  ['ETA',date(shipment.eta)],['Carrier',shipment.carrier?.toUpperCase()],['Tracking',shipment.trackingNumbers.join(', ')],
  ['',undefined],
 ]):[['Shipment','ETA has not been sent.']];
 const address=shipping?[agency?.name,shipping.attention?`Attn: ${shipping.attention}`:'',shipping.addressLine1,shipping.addressLine2,`${shipping.city}, ${shipping.state} ${shipping.postalCode}`].filter(Boolean).join('\n'):agency?`${agency.shippingAddress}\n${agency.city}, ${agency.state} ${agency.postalCode}`:undefined;
 const agencyDetails:Array<[string,string|number|undefined]>=[['Agency',agency?.name],['Representative',request.shipping?.attention||rep?.name],['Email',request.shipping?.email||rep?.email],['Phone',phone(request.shipping?.phone||rep?.phone)],['Shipping Address',address]];
 columns('Shipment Details',shipmentDetails,'Local Agency',agencyDetails);
 section('Inventory Handling');
 const inventoryNote='Use the oldest formula first (first in, first out). Store formula as directed on its package label. Keep inventory counts and expiration dates up to date, and record every receipt, issue, and adjustment.';
 const inventoryLines=wrap(inventoryNote,500,10);ensure(inventoryLines.length*14+10);page.drawRectangle({x:42,y:y-inventoryLines.length*14-7,width:528,height:inventoryLines.length*14+12,color:rgb(.94,.96,1)});y-=14;
 for(const line of inventoryLines){page.drawText(line,{x:52,y,size:10,font:regular,color:ink});y-=14;}y-=5;
 section('Participant and Request');row('Participant Name',request.participantName);row('Date of Birth',date(request.participantDob));row('WIC Family ID',request.participantFamilyId);row('WIC Individual ID',request.wicIndividualId);row('Request Type',request.requestKind==='extension'?'Extension':'New');row('Submitted',date(request.submissionDate));row('Approved',date(request.approvalDate));row('Product Ordered',date(request.dateOrdered));row('Benefits Start Date',date(request.benefitsStartDate));row('Benefit Month(s)',requestedMonthLabels(request.benefitMonthsRequested));row('Health Insurance',insuranceDetails(request));row('Breastfeeding',request.breastfeedingStatus);if(request.breastfeedingDiscontinuedDate)row('Date BF Discontinued',date(request.breastfeedingDiscontinuedDate));
 section('Medical Formula/Nutritionals');for(const [index,formula] of requestFormulas(request).entries()){row(`Formula ${index+1}`,formula.otherFormulaName||formula.productName);row('Form',formulaFormLabel(formula.productForm));if(formula.flavor)row('Flavor',formula.flavor);row('Amount (ounces/day)',formula.ouncesPrescribed);if(formula.readyToFeedJustification)row('Justification',formula.readyToFeedJustification);}row('Duration (months)',request.durationMonths);row('Qualifying Diagnosis(es)',request.diagnosis);
 section('WIC Food Restrictions');row('Restrictions',foodRestrictionLabel(request.wicFoodRestrictions));if(request.wicStaffFoodRestrictions)row('WIC Staff Decision',foodRestrictionLabel(request.wicStaffFoodRestrictions));if(request.wicNutritionStaffNotes)row('WIC Nutrition Staff Notes',request.wicNutritionStaffNotes);if(request.wicNutritionStaffName)row('WIC Nutrition Staff Name',request.wicNutritionStaffName);
 section('Issuance Details');for(const authorization of authorizations){row('Formula',fullFormulaName(authorization));row('Approved Cases',authorization.approvedCases);row('Approved Months',authorization.approvedMonths);}
 section('Next Steps');if(request.nextSteps&&wrap(request.nextSteps,376).length>8&&y-wrap(request.nextSteps,376).length*13<46){page=doc.addPage([612,792]);pageHeader();}row('Instructions',request.nextSteps);
 section('Monthly Receipt Confirmation');
 const signatureIssuances=authorizations.flatMap(authorization=>authorization.benefitIssuances.filter(issuance=>issuance.month).map(issuance=>({month:issuance.month,formula:fullFormulaName(authorization),quantity:issuance.quantity}))).sort((a,b)=>a.month.localeCompare(b.month));
 for(const issuance of signatureIssuances.length?signatureIssuances:[{month:'',formula:'',quantity:undefined as number|undefined}]){
  const label=issuance.month?`${formatIssuanceMonth(issuance.month)} ${issuance.formula} ${issuance.quantity} unit(s)`: 'Issuance month and quantity not specified';
  const labelLines=wrap(label,520,9);ensure(labelLines.length*11+42);
  for(const line of labelLines){page.drawText(line,{x:46,y,size:9,font:bold,color:ink});y-=11;}
  page.drawLine({start:{x:46,y:y-2},end:{x:300,y:y-2},thickness:.6,color:ink});page.drawLine({start:{x:330,y:y-2},end:{x:410,y:y-2},thickness:.6,color:ink});y-=13;
  page.drawText('Parent/Guardian Signature',{x:46,y,size:8,font:regular,color:muted});page.drawText('Date',{x:462,y,size:8,font:regular,color:muted});y-=22;
 }
 if(request.genericFields?.additionalNotes){section('Additional Information');row('Notes',request.genericFields.additionalNotes);}
 const pages=doc.getPages();for(const [index,p] of pages.entries())p.drawText(`Page ${index+1} of ${pages.length}`,{x:42,y:26,size:8,font:regular,color:muted});
 return doc.save();
}
