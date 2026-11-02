import type {RequestRecord} from './domain';
export function publishAuthorization(request:RequestRecord,shipmentIndex:number,now=new Date().toISOString()):RequestRecord {
 const {authorizationVersions,shipmentDrafts,deletedShipments,moreInfoRequests,...record}=request;
 return {...request,authorizationVersions:[...(authorizationVersions??[]),{id:crypto.randomUUID(),sentAt:now,shipmentIndex,record:structuredClone(record)}]};
}
