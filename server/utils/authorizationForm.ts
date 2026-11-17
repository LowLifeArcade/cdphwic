import {unitLabel} from '../../shared/quantityLabels';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {formatIssuanceMonth,formulaAuthorizations} from '../../shared/formulaAuthorizations';
import {formatDisplayDate as date,formulaFormLabel} from '../../shared/requestPresentation';
import type {AgencyMemberRecord,AgencyRecord,RequestRecord} from '../../shared/domain';
import {issuanceSupplySources,supplyCaseDetails} from '../../shared/issuanceSupply';
import {shipmentQuantities} from '../../shared/shipmentQuantities';
export async function createAuthorizationFormPdf(request:RequestRecord,agency?:AgencyRecord,rep?:AgencyMemberRecord,kind:'authorization'|'shipment-confirmation'='authorization'):Promise<Uint8Array>{
 const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const blue=rgb(0,37/255,149/255),ink=rgb(.08,.12,.16),muted=rgb(.42,.44,.45);
 let page=doc.addPage([612,792]);let y=728;
 const title=kind==='shipment-confirmation'?'State-Issued Formula Shipment Confirmation':'State-Issued Formula Authorization';
 const pageHeader=()=>{page.drawText(title,{x:42,y:754,size:17,font:bold,color:blue});y=720;};pageHeader();
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
 const section=(title:string)=>{ensure(42);y-=8;page.drawText(title,{x:42,y,size:11,font:bold,color:blue});y-=6;page.drawLine({start:{x:42,y},end:{x:570,y},thickness:.5,color:rgb(.78,.81,.85)});y-=13;};
 const authorizations=request.formulaAuthorizations?.length?request.formulaAuthorizations:formulaAuthorizations(request);
 const fullFormulaName=(formula:{productName?:string;productForm?:string;flavor?:string})=>[formula.productName,formulaFormLabel(formula.productForm),formula.flavor].filter(Boolean).join(' ');
 const phone=(value?:string)=>{
  if(!value)return undefined;
  let digits=value.replace(/\D/g,'');if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
  return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:value;
 };
 const headerLeftX=42,headerLeftWidth=174,headerMiddleX=234,headerMiddleWidth=144,headerRightX=396,headerRightWidth=174;
 const participantLines=wrap(request.participantName||'—',headerLeftWidth,15);
 const formulaLines=authorizations.flatMap(authorization=>wrap(fullFormulaName(authorization),headerLeftWidth,11));
 const insurance=request.medicalStatus==='yes'?`Medi-Cal: ${request.mediCalStatus??'Yes'}`:request.medicalStatus==='no'?'Insurance: Private Insurance':request.medicalStatus==='pending'?'Insurance: Pending':'Insurance: —';
 const middleLines=[`WIC Family ID: ${request.participantFamilyId||'—'}`,insurance,`Reviewed by: ${request.approvedByName||'—'}`].flatMap(line=>wrap(line,headerMiddleWidth,8.5));
 const shipping=request.shipping;
 const agencyContactLines=[shipping?.attention?`Attn: ${shipping.attention}`:rep?.name,shipping?.email||rep?.email,phone(shipping?.phone||rep?.phone),...(shipping?[shipping.addressLine1,shipping.addressLine2,`${shipping.city}, ${shipping.state} ${shipping.postalCode}`]:agency?[agency.shippingAddress,`${agency.city}, ${agency.state} ${agency.postalCode}`]:[])].filter((line):line is string=>Boolean(line)).flatMap(line=>wrap(line,headerRightWidth,8.5));
 const agencyNameLines=wrap(agency?.name||'Local Agency',headerRightWidth,9);
 const leftHeight=participantLines.length*17+3+formulaLines.length*13;
 const headerHeight=Math.max(leftHeight,middleLines.length*12,agencyNameLines.length*12+agencyContactLines.length*11);
 ensure(headerHeight+8);
 const headerTop=y;
 participantLines.forEach((line,index)=>page.drawText(line,{x:headerLeftX,y:headerTop-index*17,size:15,font:bold,color:ink}));
 formulaLines.forEach((line,index)=>page.drawText(line,{x:headerLeftX,y:headerTop-participantLines.length*17-2-index*13,size:11,font:bold,color:blue}));
 middleLines.forEach((line,index)=>page.drawText(line,{x:headerMiddleX,y:headerTop-index*12,size:8.5,font:regular,color:muted}));
 agencyNameLines.forEach((line,index)=>page.drawText(line,{x:headerRightX,y:headerTop-index*12,size:9,font:bold,color:blue}));
 agencyContactLines.forEach((line,index)=>page.drawText(line,{x:headerRightX,y:headerTop-agencyNameLines.length*12-index*11,size:8.5,font:regular,color:muted}));
 y=headerTop-headerHeight-5;
 section('MONTHLY FORMULA ISSUANCE');
 for(const authorization of authorizations){
  const issuances=authorization.benefitIssuances.filter(row=>row.month);
  const supply=issuanceSupplySources(request,authorization);
  type PlanRow={label:string;quantity:number|undefined;rule:boolean;lines:string[];notes:string[];height:number};
  const planRows:PlanRow[]=supply.rows.map(row=>{
   const lines=wrap(row.label,139,8.5),detail=supplyCaseDetails(row),notes=detail?wrap(detail,208,8):[];
   return {label:row.label,quantity:row.units,rule:row.kind==='surplus',lines,notes,height:Math.max(22,lines.length*10+10)+notes.length*10};
  });
  const notes=[supply.pending?`${supply.pending} approved ${unitLabel(supply.pending)} still ${supply.pending===1?'awaits':'await'} an order or transfer.`:'',supply.unknown?'Confirm Units Per Case to complete supply quantities.':''].filter(Boolean).flatMap(note=>wrap(note,208,8));
  const planHeight=43+planRows.reduce((sum,row)=>sum+row.height,0)+(notes.length?notes.length*10+9:0)+8;
  const monthHeight=Math.max(35,issuances.length*35)+18;
  // Keep the complete panel and at least one month together. Long schedules continue below it.
  const headingHeight=wrap(fullFormulaName({...authorization,productName:authorization.formulaName||authorization.productName}),500,10).length*13+wrap(`Product Number: ${authorization.productCode||'—'}   |   Units Per Case: ${authorization.unitsPerCase??'—'}   |   Yield: ${authorization.yield===undefined?'—':`${authorization.yield} fl oz`}`,510,8.5).length*11+9;
  ensure(Math.max(planHeight,Math.min(monthHeight,158))+headingHeight+8);
  const titleLines=wrap(fullFormulaName({...authorization,productName:authorization.formulaName||authorization.productName}),500,10);
  for(const line of titleLines){page.drawText(line,{x:46,y,size:10,font:bold,color:blue});y-=13;}
  const metadata=`Product Number: ${authorization.productCode||'—'}   |   Units Per Case: ${authorization.unitsPerCase??'—'}   |   Yield: ${authorization.yield===undefined?'—':`${authorization.yield} fl oz`}`;
  for(const line of wrap(metadata,510,8.5)){page.drawText(line,{x:46,y:y-1,size:8.5,font:regular,color:muted});y-=11;}
  y-=9;

  const top=y;
  const panelX=338,panelWidth=232;
  page.drawRectangle({x:panelX,y:top-planHeight,width:panelWidth,height:planHeight,color:rgb(.96,.97,.99),borderColor:rgb(.82,.85,.9),borderWidth:.5});
  page.drawText('Supply Plan',{x:panelX+10,y:top-17,size:10,font:bold,color:blue});
  page.drawText(`${supply.total} ${unitLabel(supply.total)} Approved`,{x:panelX+10,y:top-30,size:8,font:regular,color:muted});
  let planY=top-43;
  for(const row of planRows){
   if(row.rule)page.drawLine({start:{x:panelX+10,y:planY},end:{x:panelX+panelWidth-10,y:planY},thickness:.5,color:rgb(.72,.77,.84)});
   const baseline=planY-13;
   row.lines.forEach((line,index)=>page.drawText(line,{x:panelX+10,y:baseline-index*10,size:8.5,font:regular,color:ink}));
   const value=row.quantity===undefined?'—':String(row.quantity);
   page.drawText(value,{x:510-bold.widthOfTextAtSize(value,9),y:baseline,size:9,font:bold,color:ink});
   page.drawText(unitLabel(row.quantity),{x:522,y:baseline,size:8.5,font:regular,color:muted});
   const noteTop=planY-Math.max(22,row.lines.length*10+10);
   row.notes.forEach((line,index)=>page.drawText(line,{x:panelX+10,y:noteTop-index*10-3,size:8,font:regular,color:muted}));
   planY-=row.height;
  }
  if(notes.length){planY-=5;for(const line of notes){page.drawText(line,{x:panelX+10,y:planY-10,size:8,font:regular,color:muted});planY-=10;}}
  page.drawText('Monthly approved quantities',{x:54,y:top-11,size:8.5,font:regular,color:muted});
  y=top-18;
  if(!issuances.length){page.drawText('Monthly quantities not specified',{x:54,y:y-15,size:9,font:regular,color:muted});y-=35;}
  let continued=false;
  for(const issuance of issuances){
   if(y-35<46){page=doc.addPage([612,792]);pageHeader();continued=true;for(const line of wrap(`${fullFormulaName(authorization)} - Monthly issuance (continued)`,510,9)){page.drawText(line,{x:46,y:y-10,size:9,font:bold,color:blue});y-=12;}y-=11;}
   page.drawRectangle({x:42,y:y-31,width:282,height:29,color:rgb(.91,.94,1)});
   page.drawText(formatIssuanceMonth(issuance.month),{x:52,y:y-21,size:10,font:bold,color:blue});
   const quantity=`${issuance.quantity} ${unitLabel(issuance.quantity)} per month`;
   const quantitySize=bold.widthOfTextAtSize(quantity,14)<=190?14:11;
   page.drawText(quantity,{x:314-bold.widthOfTextAtSize(quantity,quantitySize),y:y-21,size:quantitySize,font:bold,color:blue});
   y-=35;
  }
  y=(continued?y:Math.min(y,top-planHeight))-12;
 }
 const shipmentRows=(request.shipments??[]).filter(s=>s.etaSentAt||s.transferEtaSentAt||s.dispatched);
 section('Shipment Details');
 if(!shipmentRows.length){page.drawText('ETA has not been sent.',{x:46,y,size:9,font:regular,color:muted});y-=16;}
 for(const [index,shipment] of shipmentRows.entries()){
  const source=shipment.shipmentSource==='agency'?shipment.sourceAgencyName:shipment.supplier;
  const heading=wrap(`Shipment ${index+1}: ${shipment.shipmentFormula?fullFormulaName(shipment.shipmentFormula):request.productName}`,520,10);
  const summary=[`${shipment.casesShipped} case(s)`,shipment.looseUnitsShipped?`${shipment.looseUnitsShipped} loose ${unitLabel(shipment.looseUnitsShipped)}`:undefined,shipment.eta?`ETA: ${date(shipment.eta)}`:undefined,shipment.carrier?.toUpperCase(),source?`Source: ${source}`:undefined].filter(Boolean).join(' | ');
  const details=wrap(summary,520,9);
  const tracking=shipment.trackingNumbers.length?wrap(`Tracking: ${shipment.trackingNumbers.join(', ')}`,520,9):[];
  const receipt=kind==='shipment-confirmation'?wrap(`Units Received: ${shipmentQuantities(request,shipment).receivedUnits} ${unitLabel(shipmentQuantities(request,shipment).receivedUnits)} | Damaged Units: ${shipmentQuantities(request,shipment).damagedUnits} ${unitLabel(shipmentQuantities(request,shipment).damagedUnits)}${shipment.receivedAt?` | Receipt Confirmed: ${date(shipment.receivedAt)}`:''}`,520,9):[];
  ensure(heading.length*13+(details.length+tracking.length+receipt.length)*12+10);
  for(const line of heading){page.drawText(line,{x:46,y,size:10,font:bold,color:blue});y-=13;}
  for(const line of [...details,...tracking,...receipt]){page.drawText(line,{x:46,y,size:9,font:regular,color:ink});y-=12;}
  y-=4;
 }
 section('Next Steps');
 const nextSteps=request.nextSteps||'Follow the approved monthly issuance schedule above.';
 const nextStepLines=wrap(nextSteps,510,11);ensure(nextStepLines.length*15+10);
 for(const line of nextStepLines){page.drawText(line,{x:46,y,size:11,font:regular,color:ink});y-=15;}
 y-=3;
 section('Monthly Receipt Confirmation');
 const signatureIssuances=authorizations.flatMap(authorization=>authorization.benefitIssuances.filter(issuance=>issuance.month).map(issuance=>({month:issuance.month,formula:fullFormulaName(authorization),quantity:issuance.quantity}))).sort((a,b)=>a.month.localeCompare(b.month));
 const signatureRows=signatureIssuances.length?signatureIssuances:[{month:'',formula:'',quantity:undefined as number|undefined}];
 const gridX=42,gridWidth=528,monthWidth=180,unitsWidth=60,signatureWidth=208;
 const gridRows=signatureRows.map(issuance=>{const label=issuance.month?`${formatIssuanceMonth(issuance.month)}\n${issuance.formula}`:'Issuance month and quantity not specified';const lines=wrap(label,monthWidth-16,8.5);return {labelLines:lines,height:Math.max(38,lines.length*10+12)};});
 const columnsX=[gridX,gridX+monthWidth,gridX+monthWidth+unitsWidth,gridX+monthWidth+unitsWidth+signatureWidth,gridX+gridWidth];
 for(const [index,issuance] of signatureRows.entries()){
  const {labelLines,height}=gridRows[index]!;
  if(y-height<52){page=doc.addPage([612,792]);pageHeader();}
  const top=y;
  page.drawRectangle({x:gridX,y:top-height,width:gridWidth,height,borderColor:rgb(.78,.81,.85),borderWidth:.6});
  for(const x of columnsX.slice(1,-1))page.drawLine({start:{x,y:top},end:{x,y:top-height},thickness:.6,color:rgb(.78,.81,.85)});
  labelLines.forEach((line,lineIndex)=>page.drawText(line,{x:gridX+8,y:top-13-lineIndex*10,size:8.5,font:lineIndex===0?bold:regular,color:ink}));
  page.drawText(issuance.quantity===undefined?'—':`${issuance.quantity} ${unitLabel(issuance.quantity)}`,{x:columnsX[1]+7,y:top-height/2-4,size:11,font:regular,color:ink});
  const signatureLineY=top-height+14;
  page.drawLine({start:{x:columnsX[2]+9,y:signatureLineY},end:{x:columnsX[3]-9,y:signatureLineY},thickness:.6,color:ink});
  page.drawLine({start:{x:columnsX[3]+8,y:signatureLineY},end:{x:columnsX[4]-8,y:signatureLineY},thickness:.6,color:ink});
  page.drawText('Parent/Guardian Signature',{x:columnsX[2]+9,y:top-height+4,size:6.5,font:regular,color:muted});
  page.drawText('Date',{x:columnsX[3]+8,y:top-height+4,size:6.5,font:regular,color:muted});
  y=top-height;
  if(index<signatureRows.length-1)y-=4;
 }
 y-=12;
 const inventoryNote='Use the oldest formula first (first in, first out). Store formula as directed on its package label. Keep inventory counts and expiration dates up to date, and record every receipt, issue, and adjustment.';
 const inventoryLines=wrap(inventoryNote,528,8.5);ensure(14+inventoryLines.length*11);
 page.drawText('Inventory Handling',{x:42,y:y-8,size:8.5,font:bold,color:muted});y-=19;
 for(const line of inventoryLines){page.drawText(line,{x:42,y,size:8.5,font:regular,color:muted});y-=11;}
 const pages=doc.getPages();for(const [index,p] of pages.entries())p.drawText(`Page ${index+1} of ${pages.length}`,{x:42,y:26,size:8,font:regular,color:muted});
 return doc.save();
}
