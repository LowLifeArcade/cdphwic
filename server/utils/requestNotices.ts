import type {SessionUser,RequestRecord} from '../../shared/domain';
import {isReviewer,canSeeAgency} from '../../shared/surplus';
export async function requestNotices(db:D1Database,user:SessionUser){
 const reviewer=isReviewer(user);
 if(!reviewer&&(user.memberType!=='agency'||!user.agencyId))return [];
 const records=await (reviewer?db.prepare('SELECT request_json FROM surplus_submissions'):db.prepare('SELECT request_json FROM surplus_submissions WHERE agency_id=?').bind(user.agencyId)).all<{request_json:string}>();
 const reads=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE user_id=?').bind(user.id).all<{notice_id:string}>();
 const seen=new Set(reads.results.map(row=>row.notice_id));
 const notices:Array<{id:string;kind:string;title:string;request_id:number;notes:string;version_id?:string;transfer_id?:string;is_read:number}>=[];
 for(const row of records.results){
  const request=JSON.parse(row.request_json) as RequestRecord;
  if(!canSeeAgency(user,request.agencyId))continue;
  if(reviewer){
   for(const note of request.moreInfoRequests??[])if(!note.deletedAt)for(const response of note.responses??[]){const id=`followup-response:${response.id}`;notices.push({id,kind:'request-response',title:'Local Agency Response — More Info Requested',request_id:request.id,notes:response.notes,is_read:seen.has(id)?1:0});}
   continue;
  }
  const followup=request.moreInfoRequests?.findLast(entry=>!entry.deletedAt&&!entry.resubmittedAt);
  if(request.status==='needs_info'&&followup&&!followup.resubmittedAt){const id=`followup:${followup.id}`;notices.push({id,kind:'request-info',title:'More Info Requested — Pending LA',request_id:request.id,notes:followup.notes,is_read:seen.has(id)?1:0});}
  for(const version of request.authorizationVersions??[]){const id=`authorization:${version.id}`;notices.push({id,kind:'request-eta',title:'Shipment ETA and Authorization Available',request_id:request.id,version_id:version.id,notes:`ETA sent ${version.sentAt.slice(0,10)}. Review the shipment details and print the State-Issued Formula Authorization.`,is_read:seen.has(id)?1:0});}
 }
 if(reviewer){
  const pickups=await db.prepare("SELECT id,request_id,source_agency_id,formula_name,quantity,shipped_date FROM surplus_transfers WHERE request_id IS NOT NULL AND status IN ('shipped','received') AND shipped_date IS NOT NULL ORDER BY shipped_date DESC").all<{id:string;request_id:number;source_agency_id:number;formula_name:string;quantity:number;shipped_date:string}>();
  for(const pickup of pickups.results){const id=`transfer-pickup:${pickup.id}`;notices.push({id,kind:'transfer-pickup',title:'Transfer Picked Up',request_id:pickup.request_id,transfer_id:pickup.id,notes:`The sending agency confirmed GSO pickup on ${pickup.shipped_date}: ${pickup.formula_name}, ${pickup.quantity} Unit(s).`,is_read:seen.has(id)?1:0});}
 }
 return notices;
}
