import type {RequestRecord} from './domain';
export interface DamageImage {id:string;fileName:string;contentType:string;storageKey:string;uploadedAt:string;uploadedBy:number}
export function validateDamageImage(data:Uint8Array,type:string):string {
 const fail=():never=>{throw Object.assign(new Error('Choose a JPEG, PNG or WebP image of 10 MB or less.'),{statusCode:400,statusMessage:'Choose a JPEG, PNG or WebP image of 10 MB or less.'});};
 if(!data.length||data.length>10*1024*1024)fail();
 const matches=type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v)||type==='image/jpeg'&&data[0]===255&&data[1]===216&&data[2]===255||type==='image/webp'&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP';
 if(!matches)fail();return type;
}
export function findDamageImage(request:RequestRecord,id:string):DamageImage|undefined {for(const row of request.shipments??[]){const found=[...(row.issue?.images??[]),...(row.deletedIssues??[]).flatMap(d=>d.issue.images??[])].find(i=>i.id===id);if(found)return found;}}
