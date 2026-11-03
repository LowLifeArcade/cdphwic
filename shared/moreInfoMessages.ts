import type {RequestRecord} from './domain';
export type MoreInfoConversation=NonNullable<RequestRecord['moreInfoRequests']>[number];
export function unreadOutgoingMessage(note:MoreInfoConversation,reviewer:boolean){
 if(note.deletedAt||note.resolvedAt)return undefined;
 const last=note.responses?.at(-1);
 if(last)return !last.readAt && (last.respondedAs==='reviewer')===reviewer?{id:last.id,type:'response' as const,notes:last.notes}:undefined;
 return reviewer&&!note.readAt&&!note.deletionLocked?{id:note.id,type:'initial' as const,notes:note.notes}:undefined;
}
export function sameRequestOutsideMessages(a:Partial<RequestRecord>,b:Partial<RequestRecord>){
 const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 return Array.from(keys).filter(key=>key!=='revision'&&key!=='moreInfoRequests').every(key=>JSON.stringify(a[key as keyof RequestRecord])===JSON.stringify(b[key as keyof RequestRecord]));
}
