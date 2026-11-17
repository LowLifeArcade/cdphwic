import type {FormulaAuthorization} from '../../shared/formulaAuthorizations';
import type {RequestRecord,SessionUser} from '../../shared/domain';
import {isReviewer,localDate} from '../../shared/surplus';
import {requestFormulas} from '../../shared/requestPresentation';

function conflict(message:string,statusCode=409):never{throw Object.assign(new Error(message),{statusCode,statusMessage:message});}
function normalized(value:string|undefined){return (value??'').trim().replace(/\s+/g,' ').toLowerCase();}

/** Reconciles request-linked reservations atomically with the receiving agency's own inventory. */
export async function syncRequestLocalSurplus(db:D1Database,request:RequestRecord,authorizations:FormulaAuthorization[],user:SessionUser){
 if(!isReviewer(user))conflict('Only CDPH/WIC or Admin can assign local surplus.',403);
 const old=(await db.prepare('SELECT * FROM surplus_request_allocations WHERE request_id=?').bind(request.id).all<any>()).results;
 const desired=new Map<string,{index:number;lotId:string;units:number;lot:any}>();
 for(const [index,auth] of authorizations.entries()){
  const assigned=(auth.localSurplusAllocations??[]).reduce((sum,row)=>sum+(Number.isSafeInteger(row.units)?row.units:0),0);
  const planned=(auth.benefitIssuances??[]).reduce((sum,row)=>sum+(Number.isSafeInteger(row.quantity)?row.quantity:0),0);
  if(assigned>planned)conflict('Assigned local surplus cannot exceed the total planned participant issuance.',400);
  for(const allocation of auth.localSurplusAllocations??[]){
  if(!allocation||!allocation.lotId||!Number.isSafeInteger(allocation.units)||allocation.units<0)conflict('Enter valid whole units for each assigned surplus lot.',400);
  if(!allocation.units)continue;
  const key=`${index}:${allocation.lotId}`;if(desired.has(key))conflict('A surplus lot can only be assigned once per formula.',400);
  const lot=await db.prepare('SELECT * FROM surplus_lots WHERE id=?').bind(allocation.lotId).first<any>();
  const requested=requestFormulas(request)[index];const formulaName=requested?.otherFormulaName||requested?.productName||auth.productName;
  if(!lot||lot.agency_id!==request.agencyId||normalized(formulaName)!==normalized(lot.formula_name)||auth.productForm!==lot.form||normalized(requested?.flavor||auth.flavor)!==normalized(lot.flavor))conflict('Select a matching surplus lot from the requesting Local Agency.',400);
  if(lot.expiration_date<localDate()||lot.expired_units>0)conflict('Expired inventory cannot be assigned.',400);
  desired.set(key,{index,lotId:allocation.lotId,units:allocation.units,lot});
  }
 }
 for(const [index,auth] of authorizations.entries()){
  let remaining=(auth.localSurplusAllocations??[]).reduce((sum,row)=>sum+row.units,0);
  const lots=(auth.localSurplusAllocations??[]).map(row=>desired.get(`${index}:${row.lotId}`)?.lot).filter(Boolean).sort((a,b)=>a.expiration_date.localeCompare(b.expiration_date));
  const stock=lots.map(lot=>({lot,remaining:(auth.localSurplusAllocations??[]).find(row=>row.lotId===lot.id)?.units??0}));
  for(const issuance of [...(auth.benefitIssuances??[])].filter(row=>row.month&&row.quantity>0).sort((a,b)=>a.month.localeCompare(b.month))){
   let use=Math.min(issuance.quantity,remaining);remaining-=use;
   while(use>0){const candidate=stock.find(row=>row.remaining>0);if(!candidate)break;if(candidate.lot.expiration_date<`${issuance.month}-01`)conflict('A selected surplus lot expires before the month it would be issued. Assign later-expiring stock for later months.',400);const take=Math.min(use,candidate.remaining);candidate.remaining-=take;use-=take;}
  }
 }
 const oldByKey=new Map(old.map((row:any)=>[`${row.formula_index}:${row.lot_id}`,row]));
 const changes:Array<{lot:any;delta:number;index:number;lotId:string;units:number;issued:number}>=[];
 for(const [key,row] of oldByKey){
  const next=desired.get(key);const units=next?.units??0;const issued=Number(row.issued_units??0);
  if(units<issued)conflict('Assigned surplus cannot be reduced below units already issued.');
  const lot=next?.lot??await db.prepare('SELECT * FROM surplus_lots WHERE id=?').bind(row.lot_id).first<any>();
  changes.push({lot,delta:units-Number(row.units),index:Number(row.formula_index),lotId:row.lot_id,units,issued});
 }
 for(const [key,row] of desired)if(!oldByKey.has(key))changes.push({lot:row.lot,delta:row.units,index:row.index,lotId:row.lotId,units:row.units,issued:0});
 if(!changes.some(change=>change.delta!==0))return;
 const op=crypto.randomUUID();const pending="EXISTS(SELECT 1 FROM surplus_commands WHERE id=? AND status='pending')";
 const steps:D1PreparedStatement[]=[db.prepare('INSERT INTO surplus_commands(id,actor_id,payload) VALUES(?,?,?)').bind(op,user.id,JSON.stringify({kind:'request-allocation',requestId:request.id}))];
 for(const change of changes){if(!change.delta)continue;
  const condition=change.delta>0?'id=? AND version=? AND expiration_date>=? AND expired_units=0 AND on_hand-reserved>=?':'id=? AND version=? AND reserved>=?';
  const args=change.delta>0?[change.lotId,change.lot.version,localDate(),change.delta]:[change.lotId,change.lot.version,-change.delta];
  steps.push(db.prepare(`INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_lots WHERE ${condition}) THEN 1 ELSE 0 END WHERE ${pending}`).bind(...args,op));
  steps.push(db.prepare(`UPDATE surplus_lots SET reserved=reserved+?,version=version+1 WHERE id=? AND version=? AND ${pending}`).bind(change.delta,change.lotId,change.lot.version,op));
  steps.push(db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?,?,id,?,?,?, ?,?,on_hand,reserved,expired_units FROM surplus_lots WHERE id=? AND ${pending}`).bind(crypto.randomUUID(),op,change.delta>0?'reserve':'release',Math.abs(change.delta),user.id,String(request.id),JSON.stringify({reason:change.delta>0?'Assigned to participant request':'Released from participant request',formulaIndex:change.index}),change.lotId,op));
  if(change.units===0)steps.push(db.prepare('DELETE FROM surplus_request_allocations WHERE request_id=? AND formula_index=? AND lot_id=? AND issued_units=0').bind(request.id,change.index,change.lotId));
  else steps.push(db.prepare('INSERT INTO surplus_request_allocations(request_id,formula_index,lot_id,units,issued_units) VALUES(?,?,?,?,?) ON CONFLICT(request_id,formula_index,lot_id) DO UPDATE SET units=excluded.units').bind(request.id,change.index,change.lotId,change.units,change.issued));
 }
 steps.push(db.prepare("UPDATE surplus_commands SET status='done',result='{}' WHERE id=? AND status='pending'").bind(op),db.prepare('DELETE FROM surplus_guard'));
 try{await db.batch(steps);}catch{conflict('Surplus changed while it was being assigned. Refresh inventory and try again.');}
}

/** Deducts a participant's monthly issue from reserved lots in earliest-expiration order. */
export async function issueRequestLocalSurplus(db:D1Database,request:RequestRecord,index:number,month:string,units:number,user:SessionUser){
 if(user.memberType!=='agency'||user.agencyId!==request.agencyId)conflict('Only the requesting Local Agency can record its monthly surplus issue.',403);
 if(!Number.isSafeInteger(index)||index<0||!/^\d{4}-\d{2}$/.test(month)||!Number.isSafeInteger(units)||units<1)conflict('Enter a valid issuance month and positive whole unit quantity.',400);
 const auth=request.formulaAuthorizations?.[index];if(!auth||!auth.benefitIssuances.some(row=>row.month===month))conflict('Select a month in the saved issuance plan.',400);
 const already=await db.prepare('SELECT units FROM surplus_request_issuances WHERE request_id=? AND formula_index=? AND month=?').bind(request.id,index,month).first<{units:number}>();
 if(already)conflict('A surplus issue has already been recorded for this formula and month.');
 const assignmentTotal=(auth.localSurplusAllocations??[]).reduce((sum,row)=>sum+row.units,0);
 let remainingForIssue=assignmentTotal;let target=0;
 const schedule=[...auth.benefitIssuances].filter(row=>row.month&&row.quantity>0).sort((a,b)=>a.month.localeCompare(b.month));
 for(const entry of schedule){const amount=Math.min(entry.quantity,remainingForIssue);remainingForIssue-=amount;if(entry.month===month)target=amount;if(entry.month<month&&amount>0){const prior=await db.prepare('SELECT 1 FROM surplus_request_issuances WHERE request_id=? AND formula_index=? AND month=?').bind(request.id,index,entry.month).first();if(!prior)conflict('Record the earlier month’s assigned Local Agency surplus issue first.');}}
 if(target!==units)conflict(`Record the planned ${target} Local Agency surplus unit(s) for this month.`,400);
 const rows=(await db.prepare('SELECT a.*,l.expiration_date,l.on_hand,l.reserved,l.version,l.expired_units FROM surplus_request_allocations a JOIN surplus_lots l ON l.id=a.lot_id WHERE a.request_id=? AND a.formula_index=? AND l.agency_id=? AND l.expiration_date>=? AND l.expired_units=0 ORDER BY l.expiration_date,l.id').bind(request.id,index,request.agencyId,`${month}-01`).all<any>()).results;
 let remainder=units;const spends:Array<{row:any;units:number}>=[];
 for(const row of rows){const available=Number(row.units)-Number(row.issued_units);if(available<=0)continue;const take=Math.min(available,remainder);spends.push({row,units:take});remainder-=take;if(!remainder)break;}
 if(remainder)conflict('There are not enough assigned Local Agency surplus units for this month.',400);
 if(spends.some(({row})=>row.expiration_date<localDate()||row.expired_units>0))conflict('Assigned surplus includes expired stock. Correct the assignment before recording an issue.');
 const op=crypto.randomUUID();const pending="EXISTS(SELECT 1 FROM surplus_commands WHERE id=? AND status='pending')";
 const steps:D1PreparedStatement[]=[db.prepare('INSERT INTO surplus_commands(id,actor_id,payload) VALUES(?,?,?)').bind(op,user.id,JSON.stringify({kind:'request-issue',requestId:request.id,index,units}))];
 for(const spend of spends){const {row,units:take}=spend;
  steps.push(db.prepare(`INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND on_hand>=? AND reserved>=?) THEN 1 ELSE 0 END WHERE ${pending}`).bind(row.lot_id,row.version,take,take,op));
  steps.push(db.prepare(`UPDATE surplus_lots SET on_hand=on_hand-?,reserved=reserved-?,version=version+1 WHERE id=? AND version=? AND ${pending}`).bind(take,take,row.lot_id,row.version,op));
  steps.push(db.prepare('UPDATE surplus_request_allocations SET issued_units=issued_units+? WHERE request_id=? AND formula_index=? AND lot_id=?').bind(take,request.id,index,row.lot_id));
  steps.push(db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?,?,id,'request-issue',?,?,?, ?,on_hand,reserved,expired_units FROM surplus_lots WHERE id=?`).bind(crypto.randomUUID(),op,take,user.id,String(request.id),JSON.stringify({reason:'Monthly issue to participant from reserved Local Agency surplus',month,formulaIndex:index}),row.lot_id));
 }
 steps.push(db.prepare('INSERT INTO surplus_request_issuances(request_id,formula_index,month,units,actor_id) VALUES(?,?,?,?,?)').bind(request.id,index,month,units,user.id),db.prepare("UPDATE surplus_commands SET status='done',result='{}' WHERE id=? AND status='pending'").bind(op),db.prepare('DELETE FROM surplus_guard'));
 try{await db.batch(steps);}catch{conflict('Surplus changed while recording the issue. Refresh inventory and try again.');}
 return [...(auth.localSurplusIssued??[]),{month,units}];
}
