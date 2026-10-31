import type {SessionUser} from '../../shared/domain';
import {localDate} from '../../shared/surplus';
export async function pendingTransferCount(db:D1Database,user:SessionUser,today=localDate()):Promise<number>{
 if(user.role==='admin'||user.memberType!=='agency'||!user.agencyId)return 0;
 return (await db.prepare(`SELECT COUNT(*) AS count FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id WHERE t.source_agency_id=? AND t.status='reserved' AND l.expiration_date>=? AND l.expired_units=0`).bind(user.agencyId,today).first<number>('count'))??0;
}
