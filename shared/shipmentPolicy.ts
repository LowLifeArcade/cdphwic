import type {RequestRecord} from './domain';
import type {DistributorSnapshot} from './distributors';
import {validateDistributor} from './distributors';
import {requestShipments} from './requestShipments';
import {shipmentReceiptKey} from './shipmentReceipts';
export interface ShipmentPolicyCommand {index:number;key:string;expectedPolicy:string;policy:DistributorSnapshot;reason:string}
export function applyShipmentPolicy(request:RequestRecord,command:ShipmentPolicyCommand,actor:number,now=new Date().toISOString()):Partial<RequestRecord>{
 const rows=requestShipments(request);const row=rows[command.index];
 const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
 if(!row||shipmentReceiptKey(row)!==command.key||JSON.stringify(row.distributorPolicy??null)!==command.expectedPolicy)fail('Shipment requirements changed. Refresh before saving.');
 if(!command.policy||validateDistributor({...command.policy,name:command.policy.distributorName})||typeof command.reason!=='string'||!command.reason.trim()||command.reason.length>4000)fail('Enter valid requirements and a reason for this exception.');
 if(command.policy.distributorId!==row.distributorPolicy?.distributorId||command.policy.revision!==row.distributorPolicy?.revision||command.policy.distributorName!==row.distributorPolicy?.distributorName)fail('Preserve the selected distributor identity.');
 rows[command.index]={...row,distributorPolicy:{...command.policy},policyHistory:[...(row.policyHistory??[]),{policy:row.distributorPolicy,reason:command.reason.trim(),changedBy:actor,changedAt:now}]};
 return {shipments:rows};
}
