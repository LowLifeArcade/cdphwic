import {surplusContext} from '../../utils/surplusContext';
import {isReviewer} from '../../../shared/surplus';
import type {RequestAgencyTransfer} from '../../../shared/requestTransfers';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);
 const query=isReviewer(user)?db.prepare('SELECT * FROM surplus_transfers WHERE request_id IS NOT NULL ORDER BY created_at DESC'):db.prepare('SELECT * FROM surplus_transfers WHERE request_id IS NOT NULL AND (source_agency_id=? OR destination_agency_id=?) ORDER BY created_at DESC').bind(user.agencyId??-1,user.agencyId??-1);
 return {user,transfers:(await query.all<RequestAgencyTransfer>()).results};
});
