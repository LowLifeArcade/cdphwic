import {validateDistributor,type DistributorProfile} from '../../shared/distributors';
export async function listDistributors(db:D1Database):Promise<DistributorProfile[]> {const rows=await db.prepare('SELECT id,name,revision,policy_json FROM distributors ORDER BY name').all<{id:string;name:string;revision:number;policy_json:string}>();return rows.results.map(r=>({...JSON.parse(r.policy_json),id:r.id,name:r.name,revision:r.revision}));}
export async function getDistributor(db:D1Database,id:string){return (await listDistributors(db)).find(d=>d.id===id);}
export async function saveDistributor(db:D1Database,input:Partial<DistributorProfile>,actor:number) {
 const error=validateDistributor(input);if(error)throw Object.assign(new Error(error),{statusCode:400,statusMessage:error});
 const id=input.id||crypto.randomUUID();const policy=JSON.stringify({labelsRequired:input.labelsRequired,imagesRequired:input.imagesRequired,replacementBasis:input.replacementBasis,instructions:input.instructions!.trim()});
 try {
 if(input.id){const result=await db.prepare('UPDATE distributors SET name=?,policy_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=?').bind(input.name!.trim(),policy,actor,new Date().toISOString(),id,input.revision??-1).run();if(!result.meta.changes)throw Object.assign(new Error('Distributor changed. Reload before saving.'),{statusCode:409});}
 else await db.prepare('INSERT INTO distributors(id,name,revision,policy_json,updated_by,updated_at) VALUES(?,?,1,?,?,?)').bind(id,input.name!.trim(),policy,actor,new Date().toISOString()).run();
 }catch(e){if(String(e).includes('UNIQUE'))throw Object.assign(new Error('A distributor with this name already exists.'),{statusCode:409,statusMessage:'A distributor with this name already exists.'});throw e;}
 return (await getDistributor(db,id))!;
}
