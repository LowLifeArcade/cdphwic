import type {SurplusLot} from './surplus';
import {availableUnits,normalizeVariantText} from './surplus';

export interface SurplusLotGroup {
 key:string;
 agencyId:number;
 formulaName:string;
 form:string;
 flavor:string;
 packaging?:string;
 clinicId?:string;
 clinicName?:string;
 lots:SurplusLot[];
 onHand:number;
 reserved:number;
 available:number;
 expiredUnits:number;
 total:number;
 earliestExpiration:string;
}

export function groupSurplusLots(lots:SurplusLot[]):SurplusLotGroup[]{
 const groups=new Map<string,SurplusLot[]>();
 for(const lot of lots){
  const key=JSON.stringify([lot.agencyId,normalizeVariantText(lot.formulaName),lot.form,normalizeVariantText(lot.flavor),normalizeVariantText(lot.packaging??''),lot.clinicId??'']);
  const rows=groups.get(key)??[];
  rows.push(lot);
  groups.set(key,rows);
 }
 return Array.from(groups,([key,rows])=>{
  const sorted=[...rows].sort((a,b)=>a.expirationDate.localeCompare(b.expirationDate)||a.id.localeCompare(b.id));
  const first=sorted[0]!;
  const onHand=sorted.reduce((sum,lot)=>sum+lot.onHand,0);
  const expiredUnits=sorted.reduce((sum,lot)=>sum+lot.expiredUnits,0);
  return {
   key,agencyId:first.agencyId,formulaName:first.formulaName,form:first.form,flavor:first.flavor,packaging:first.packaging,
   ...(first.clinicId?{clinicId:first.clinicId,clinicName:first.clinicName}:{}),lots:sorted,onHand,
   reserved:sorted.reduce((sum,lot)=>sum+lot.reserved,0),
   available:sorted.reduce((sum,lot)=>sum+availableUnits(lot),0),expiredUnits,total:onHand+expiredUnits,
   earliestExpiration:first.expirationDate,
  };
 }).sort((a,b)=>a.formulaName.localeCompare(b.formulaName)||a.form.localeCompare(b.form)||a.flavor.localeCompare(b.flavor)||a.agencyId-b.agencyId||(a.clinicName??'').localeCompare(b.clinicName??''));
}
