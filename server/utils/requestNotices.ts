import {unitLabel} from '../../shared/quantityLabels';
import {formatDisplayDate} from '../../shared/requestPresentation';
import type {SessionUser,RequestRecord} from '../../shared/domain';
import {isReviewer,canSeeAgency} from '../../shared/surplus';
import {resolveShipmentFormula,shipmentFormulaLabel} from '../../shared/shipmentFormulas';
import {requestFormulas} from '../../shared/requestPresentation';
import {fulfillmentProgress,shipmentFulfillmentType} from '../../shared/fulfillmentAllocations';
import {shipmentQuantities,formatShipmentUnits} from '../../shared/shipmentQuantities';
import {requestShipments} from '../../shared/requestShipments';
export async function requestNotices(db:D1Database,user:SessionUser){
 const reviewer=isReviewer(user);
 if(!reviewer&&(user.memberType!=='agency'||!user.agencyId))return [];
 const records=await (reviewer?db.prepare('SELECT request_json FROM surplus_submissions'):db.prepare('SELECT request_json FROM surplus_submissions WHERE agency_id=?').bind(user.agencyId)).all<{request_json:string}>();
 const reads=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE user_id=?').bind(user.id).all<{notice_id:string}>();
 const seen=new Set(reads.results.map(row=>row.notice_id));
 const notices:Array<{id:string;kind:string;title:string;request_id:number;participant_name:string;submission_date?:string;formula_label?:string;notes:string;version_id?:string;transfer_id?:string;is_read:number}>=[];
 for(const row of records.results){
  const request=JSON.parse(row.request_json) as RequestRecord;
  if(!canSeeAgency(user,request.agencyId))continue;
  const formulaLabel=requestFormulas(request).map(formula=>shipmentFormulaLabel({productName:formula.otherFormulaName||formula.productName,productForm:formula.productForm,flavor:formula.flavor})).join(' + ');
  if(reviewer){
   for(const note of request.moreInfoRequests??[])if(!note.deletedAt)for(const response of note.responses??[])if(response.respondedAs!=='reviewer'){const id=`followup-response:${response.id}`;notices.push({id,kind:'request-response',title:'Local Agency Response — Request More Info',request_id:request.id,participant_name:request.participantName,submission_date:request.submissionDate,formula_label:formulaLabel,notes:response.notes,is_read:seen.has(id)?1:0});}
   continue;
  }
  for(const note of request.moreInfoRequests??[])if(!note.deletedAt)for(const response of note.responses??[])if(response.respondedAs==='reviewer'){const id=`followup-response:${response.id}`;notices.push({id,kind:'request-response',title:'CDPH/WIC Response — Request More Info',request_id:request.id,participant_name:request.participantName,submission_date:request.submissionDate,formula_label:formulaLabel,notes:response.notes,is_read:seen.has(id)?1:0});}
  const followup=request.moreInfoRequests?.findLast(entry=>!entry.deletedAt&&(!entry.resubmittedAt||entry.resubmissionOpen)&&!entry.resolvedAt);
  if(request.status==='needs_info'&&followup){const id=followup.resubmissionOpen?`followup:${followup.id}:reopen:${followup.resubmissionOpenedAt}`:`followup:${followup.id}`;notices.push({id,kind:'request-info',title:followup.resubmissionOpen?'Request Reopened for Resubmission':'Request More Info — Pending LA',request_id:request.id,participant_name:request.participantName,submission_date:request.submissionDate,formula_label:formulaLabel,notes:followup.notes,is_read:seen.has(id)?1:0});}
  for(const version of request.authorizationVersions??[]){
   const id=`authorization:${version.id}`;const record=version.record;const shipment=requestShipments(record)[version.shipmentIndex];
   const formula=shipment?resolveShipmentFormula(record,shipment):undefined;const orderType=shipment?shipmentFulfillmentType(record,shipment):undefined;
   const typeLabel=orderType==='special'?'Special Order':'Standard';
   const quantity=shipment?formatShipmentUnits(shipmentQuantities(record,shipment).expectedUnits,shipmentQuantities(record,shipment).size):'';
   const progress=fulfillmentProgress(record).find(row=>row.formula===shipmentFormulaLabel(formula));
   const remaining=[
    progress?.standard.pending?`${progress.standard.pending} Standard ${progress.standard.pending===1?'case':'cases'} still pending.`:'',
    progress?.special.pending?`${progress.special.pending} Special Order ${progress.special.pending===1?'case':'cases'} still pending.`:'',
   ].filter(Boolean).join(' ');
   const title=shipment?`${typeLabel} Shipment ETA and Authorization Available`:'Shipment ETA and Authorization Available';
   const details=shipment?`${shipmentFormulaLabel(formula)} · ${typeLabel} · ${quantity}. `:'';
   const pending=remaining?` ${remaining}`:'';
   notices.push({id,kind:'request-eta',title,request_id:request.id,participant_name:request.participantName,submission_date:request.submissionDate,formula_label:formula?shipmentFormulaLabel(formula):formulaLabel,version_id:version.id,notes:`${details}ETA sent ${formatDisplayDate(version.sentAt)}.${pending} Review the shipment details and print the State-Issued Formula Authorization.`,is_read:seen.has(id)?1:0});
  }
 }
 if(reviewer){
  const pickups=await db.prepare("SELECT t.id,t.request_id,t.source_agency_id,t.formula_name,t.form,t.quantity,t.shipped_date,COALESCE(json_extract(s.request_json,'$.participantName'),'') AS participant_name,json_extract(s.request_json,'$.submissionDate') AS submission_date FROM surplus_transfers t LEFT JOIN surplus_submissions s ON json_extract(s.request_json,'$.id')=t.request_id WHERE t.request_id IS NOT NULL AND t.status IN ('shipped','received') AND t.shipped_date IS NOT NULL ORDER BY t.shipped_date DESC").all<{id:string;request_id:number;source_agency_id:number;formula_name:string;form:string;quantity:number;shipped_date:string;participant_name:string;submission_date?:string}>();
  for(const pickup of pickups.results){const id=`transfer-pickup:${pickup.id}`;notices.push({id,kind:'transfer-pickup',title:'Transfer Picked Up',request_id:pickup.request_id,participant_name:pickup.participant_name,submission_date:pickup.submission_date,formula_label:shipmentFormulaLabel({productName:pickup.formula_name,productForm:pickup.form as import('../../shared/domain').ProductForm}),transfer_id:pickup.id,notes:`The sending agency confirmed GSO pickup on ${formatDisplayDate(pickup.shipped_date)}: ${pickup.formula_name}, ${pickup.quantity} ${unitLabel(pickup.quantity)}.`,is_read:seen.has(id)?1:0});}
 }
 return notices;
}
