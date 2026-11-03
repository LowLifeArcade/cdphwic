import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {formatIssuanceMonth,formulaAuthorizations} from '../../shared/formulaAuthorizations';
import {requestFormulas,formulaFormLabel,foodRestrictionLabel,insuranceDetails,requestedMonthLabels} from '../../shared/requestPresentation';
import type {AgencyMemberRecord,AgencyRecord,RequestRecord} from '../../shared/domain';
const date=(value?:string)=>{const [y,m,d]=(value??'').slice(0,10).split('-');return y&&m&&d?`${m}/${d}/${y}`:'—';};
export async function createAuthorizationFormPdf(request:RequestRecord,agency?:AgencyRecord,rep?:AgencyMemberRecord):Promise<Uint8Array>{
 const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const blue=rgb(0,37/255,149/255),ink=rgb(.08,.12,.16),muted=rgb(.42,.44,.45);
 let page=doc.addPage([612,792]);let y=728;
 const pageHeader=()=>{page.drawText('State-Issued Formula Authorization',{x:42,y:754,size:17,font:bold,color:blue});page.drawText(`CDPH/WIC  |  Request #${request.id}`,{x:42,y:735,size:9,font:regular,color:muted});y=708;};pageHeader();
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
 section('Local Agency');row('Agency',agency?.name);row('Representative',request.shipping?.attention||rep?.name);row('Email',request.shipping?.email||rep?.email);row('Phone',request.shipping?.phone||rep?.phone);
 const shipping=request.shipping;row('Shipping Address',shipping?[agency?.name,shipping.attention?`Attn: ${shipping.attention}`:'',shipping.addressLine1,shipping.addressLine2,`${shipping.city}, ${shipping.state} ${shipping.postalCode}`].filter(Boolean).join('\n'):agency?`${agency.shippingAddress}\n${agency.city}, ${agency.state} ${agency.postalCode}`:undefined);
 section('Participant and Request');row('Participant Name',request.participantName);row('Date of Birth',date(request.participantDob));row('WIC Family ID',request.participantFamilyId);row('WIC Individual ID',request.wicIndividualId);row('Request Type',request.requestKind==='extension'?'Extension':'New');row('Submitted',date(request.submissionDate));row('Approved',date(request.approvalDate));row('Product Ordered',date(request.dateOrdered));row('Benefits Start Date',date(request.benefitsStartDate));row('Benefit Month(s)',requestedMonthLabels(request.benefitMonthsRequested));row('Health Insurance',insuranceDetails(request));row('Breastfeeding',request.breastfeedingStatus);if(request.breastfeedingDiscontinuedDate)row('Date BF Discontinued',date(request.breastfeedingDiscontinuedDate));
 section('Medical Formula/Nutritionals');for(const [index,formula] of requestFormulas(request).entries()){row(`Formula ${index+1}`,formula.otherFormulaName||formula.productName);row('Form',formulaFormLabel(formula.productForm));if(formula.flavor)row('Flavor',formula.flavor);row('Amount (ounces/day)',formula.ouncesPrescribed);if(formula.readyToFeedJustification)row('Justification',formula.readyToFeedJustification);}row('Duration (months)',request.durationMonths);row('Qualifying Diagnosis(es)',request.diagnosis);
 section('WIC Food Restrictions');row('Restrictions',foodRestrictionLabel(request.wicFoodRestrictions));if(request.wicStaffFoodRestrictions)row('WIC Staff Decision',foodRestrictionLabel(request.wicStaffFoodRestrictions));if(request.wicNutritionStaffNotes)row('WIC Nutrition Staff Notes',request.wicNutritionStaffNotes);if(request.wicNutritionStaffName)row('WIC Nutrition Staff Name',request.wicNutritionStaffName);
 section('Health Care Provider');row('Provider Name',request.doctorPrintedName);row('Provider Signature',request.doctorHasSignedOff?'Verified on medical documentation':'Not verified');row('Date Signed',date(request.prescriptionSignedDate));row('Medical Office/Clinic',[request.doctorOfficeName,request.doctorOfficeAddress,request.doctorOfficePhone].filter(Boolean).join('\n'));
 section('Issuance');for(const [index,authorization] of (request.formulaAuthorizations?.length?request.formulaAuthorizations:formulaAuthorizations(request)).entries()){row(`Formula ${index+1}`,authorization.productName);row('Form',formulaFormLabel(authorization.productForm));if(authorization.flavor)row('Flavor',authorization.flavor);row('Approved Cases',authorization.approvedCases);row('Approved Months',authorization.approvedMonths);row('Agency Unit(s) On Hand',`${authorization.agencyUnitsOnHand??0} ${authorization.agencyUnitsOnHandUnit??'units'}`);row('Expected Surplus',`${authorization.expectedSurplus??0} ${authorization.expectedSurplusUnit??'units'}`);for(const issuance of authorization.benefitIssuances)row(formatIssuanceMonth(issuance.month),`${issuance.quantity} units`);}
 section('Next Steps');row('Instructions',request.nextSteps);
 section('Shipment Details');const shipments=(request.shipments??[]).filter(s=>s.etaSentAt||s.transferEtaSentAt||s.dispatched);if(!shipments.length)row('Shipment','ETA has not been sent.');for(const [index,shipment] of shipments.entries()){row(`Shipment ${index+1}`,shipment.shipmentFormula?[shipment.shipmentFormula.productName,formulaFormLabel(shipment.shipmentFormula.productForm),shipment.shipmentFormula.flavor].filter(Boolean).join(' · '):request.productName);row('Source',shipment.shipmentSource==='agency'?shipment.sourceAgencyName:shipment.supplier);row('Cases / Unit(s)',`${shipment.casesShipped} cases${shipment.looseUnitsShipped?` + ${shipment.looseUnitsShipped} Unit(s)`:''}`);row('ETA',date(shipment.eta));row('Carrier',shipment.carrier?.toUpperCase());row('Tracking Numbers',shipment.trackingNumbers.join(', '));}
 if(request.genericFields?.additionalNotes){section('Additional Information');row('Notes',request.genericFields.additionalNotes);}
 ensure(185);section('Signature(s) Confirming Receipt of Formula (Single Issue Only)');
 for(let month=1;month<=3;month++){y-=14;page.drawText(`Month ${month}`,{x:46,y,size:10,font:bold,color:ink});page.drawLine({start:{x:112,y:y-2},end:{x:424,y:y-2},thickness:.6,color:ink});page.drawLine({start:{x:462,y:y-2},end:{x:566,y:y-2},thickness:.6,color:ink});y-=13;page.drawText('Parent/Guardian Signature',{x:112,y,size:8,font:regular,color:muted});page.drawText('Date',{x:462,y,size:8,font:regular,color:muted});y-=17;}
 const pages=doc.getPages();for(const [index,p] of pages.entries())p.drawText(`Request #${request.id}  |  Page ${index+1} of ${pages.length}`,{x:42,y:26,size:8,font:regular,color:muted});
 return doc.save();
}
