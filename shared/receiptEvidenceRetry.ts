import type {RequestRecord} from './domain';
import {shipmentReceiptKey} from './shipmentReceipts';
/** Refresh concurrent responses without attaching staged files to a different shipment/issue. */
export async function refreshReceiptEvidence(saved:RequestRecord,index:number,load:()=>Promise<RequestRecord>):Promise<RequestRecord>{
 const fresh=await load();const old=saved.shipments?.[index];const current=fresh.shipments?.[index];
 const identity=(issue:NonNullable<typeof old>['issue'])=>issue?.id??(issue?`${issue.reportedAt}:${issue.reportedBy}`:null);
 if(fresh.id!==saved.id||!old?.issue||!current?.issue||shipmentReceiptKey(old)!==shipmentReceiptKey(current)||identity(old.issue)!==identity(current.issue))throw new Error('The shipment or issue changed. Finish later and reopen this request before attaching images.');
 return fresh;
}
