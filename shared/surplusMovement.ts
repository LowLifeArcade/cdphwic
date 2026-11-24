import {formatDisplayDate} from './requestPresentation';

export interface SurplusMovementHistoryRow {
 id:string;
 kind:string;
 quantity:number;
 reason:string;
 created_at?:string;
 corrects_movement_id?:string|null;
 corrected_quantity?:number|null;
 command_payload?:string;
 agency_authored?:boolean;
 correctable?:boolean;
 effective_quantity?:number;
 correction_target?:{id:string;created_at?:string;kind:string;quantity:number};
}

export function decorateSurplusMovements(rows:SurplusMovementHistoryRow[],canCorrect:boolean):SurplusMovementHistoryRow[]{
 const latestCorrection=new Map<string,number>();
 for(const row of rows){
  if(row.corrects_movement_id&&!latestCorrection.has(row.corrects_movement_id)&&row.corrected_quantity!==null&&row.corrected_quantity!==undefined)
   latestCorrection.set(row.corrects_movement_id,row.corrected_quantity);
 }
 const rowsById=new Map(rows.map(row=>[row.id,row]));
 return rows.map(row=>{
  const {command_payload,...publicRow}=row;
  let payload:{kind?:string;reportId?:string}|undefined;
  try{payload=JSON.parse(command_payload??'{}') as {kind?:string;reportId?:string};}catch{payload=undefined;}
  let details:{reason?:string;correctedFormulaName?:string;correctedForm?:string;correctedFlavor?:string}|undefined;
  try{details=JSON.parse(row.reason) as {reason?:string;correctedFormulaName?:string;correctedForm?:string;correctedFlavor?:string};}catch{details=undefined;}
  const agencyCount=row.kind==='reconcile'&&payload?.kind==='reconcile'&&!payload.reportId;
  const agencyAdjustment=row.kind==='deduct'&&payload?.kind==='deduct'&&['Donation','Destruction'].includes(details?.reason??'');
  return {
   ...publicRow,
   correctable:canCorrect&&!row.corrects_movement_id&&(agencyCount||(row.agency_authored===true&&agencyAdjustment)),
   corrected_formula_details:row.corrects_movement_id&&details?.correctedFormulaName?{formulaName:details.correctedFormulaName,form:details.correctedForm??'',flavor:details.correctedFlavor??''}:undefined,
   effective_quantity:latestCorrection.get(row.id)??row.quantity,
   correction_target:row.corrects_movement_id&&rowsById.has(row.corrects_movement_id)
    ? (()=>{const target=rowsById.get(row.corrects_movement_id)!;return {id:target.id,created_at:target.created_at,kind:target.kind,quantity:target.quantity};})()
    : undefined,
  };
 });
}

export function surplusMovementReason(value:unknown):string{
 if(typeof value!=='string'||!value)return '';
 try{
  const details=JSON.parse(value) as {reason?:string;staff?:string;date?:string;note?:string}|null;
  if(!details||typeof details!=='object'||Array.isArray(details))return value;
  if(details.reason==='Correction')return [`Correction${details.note?`: ${details.note}`:''}`,details.staff?`Corrected by ${details.staff}`:'',details.date?`Correction date ${details.date}`:''].filter(Boolean).join(' · ')||value;
  const adjustment = ['Donation','Destruction'].includes(details.reason??'');
  const dateLabel = details.reason === 'Donation' ? 'Donation date' : details.reason === 'Destruction' ? 'Destruction date' : 'Count date';
  return [details.reason,details.staff?`${adjustment?'Recorded':'Counted'} by ${details.staff}`:'',details.date?`${dateLabel} ${formatDisplayDate(details.date)}`:''].filter(Boolean).join(' · ')||value;
 }catch{return value;}
}
