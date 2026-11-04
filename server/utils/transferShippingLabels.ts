import type {SessionUser} from '../../shared/domain';
import {isReviewer} from '../../shared/surplus';
import {validateShippingLabel,type TransferShippingLabel} from '../../shared/transferShippingLabels';
import {linkedTransfer,transferError} from './requestTransferInventory';
async function access(db:D1Database,user:SessionUser,id:string){
 const transfer=await linkedTransfer(db,id);
 if(!transfer||!isReviewer(user)&&user.agencyId!==transfer.source_agency_id&&user.agencyId!==transfer.destination_agency_id)throw transferError('Transfer not found.',404);
 return transfer;
}
export async function listTransferLabels(db:D1Database,user:SessionUser,id:string){
 await access(db,user,id);
 return (await db.prepare('SELECT id,file_name AS fileName,content_type AS contentType,file_size AS size,uploaded_at AS uploadedAt FROM transfer_shipping_labels WHERE transfer_id=? ORDER BY uploaded_at,id').bind(id).all<TransferShippingLabel>()).results;
}
export async function storeTransferLabel(db:D1Database,bucket:R2Bucket,environment:string,user:SessionUser,id:string,file:{filename:string;type:string;data:Uint8Array}){
 if(!isReviewer(user))throw transferError('Only CDPH/WIC or Admin can upload shipping labels.',403);
 const transfer=await access(db,user,id);if(transfer.status!=='reserved')throw transferError('Shipping labels can only be added before pickup.');
 if(!transfer.stock_confirmed_at)throw transferError('The sending Local Agency must confirm product availability before labels are provided.');
 const contentType=validateShippingLabel(file.data,file.type);const labelId=crypto.randomUUID();const key=`${environment}/transfer-labels/${id}/${labelId}`;
 const label={id:labelId,fileName:file.filename.replace(/[\r\n]/g,'').slice(0,180)||'shipping-label',contentType,size:file.data.length,uploadedAt:new Date().toISOString()};
 await bucket.put(key,file.data,{httpMetadata:{contentType}});
 try{await db.batch([
  db.prepare("INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND status='reserved' AND stock_confirmed_at IS NOT NULL) AND (SELECT COUNT(*) FROM transfer_shipping_labels WHERE transfer_id=?)<10 THEN 1 ELSE 0 END").bind(id,id),
  db.prepare('INSERT INTO transfer_shipping_labels(id,transfer_id,file_name,content_type,storage_key,file_size,uploaded_at,uploaded_by) VALUES(?,?,?,?,?,?,?,?)').bind(label.id,id,label.fileName,label.contentType,key,label.size,label.uploadedAt,user.id),
  db.prepare('DELETE FROM surplus_notice_reads WHERE notice_id=?').bind(`transfer-ready:${id}`),
  db.prepare('DELETE FROM surplus_guard')
 ]);}catch{await bucket.delete(key);throw transferError('Transfer changed or the 10-label limit was reached. Refresh before uploading.');}
 return label;
}
export async function readTransferLabel(db:D1Database,bucket:R2Bucket,user:SessionUser,id:string,labelId:string){
 await access(db,user,id);
 const label=await db.prepare('SELECT file_name AS fileName,content_type AS contentType,storage_key AS storageKey FROM transfer_shipping_labels WHERE transfer_id=? AND id=?').bind(id,labelId).first<{fileName:string;contentType:string;storageKey:string}>();
 if(!label)throw transferError('Shipping label not found.',404);
 const object=await bucket.get(label.storageKey);if(!object?.body)throw transferError('Shipping label not found.',404);
 return {label,body:object.body};
}
